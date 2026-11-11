use std::ops::{Deref, DerefMut};
use std::rc::Rc;

use actix_web::web;

use crate::common::{elgamal, kem};
use crate::misc::crypto;
use crate::misc::rate_limit::RateLimiter;
use crate::misc::serde_ext::bytes_wrapper::B64UU;
use crate::phcrypto;
use crate::{
    api::{self, EndpointDetails as _},
    servers::{
        self, AppBase, AppCreatorBase, Constellation, DiscoverVerdict, Handle, Server as _,
        constellation,
    },
};

use api::tr::*;

/// Transcryptor
pub type Server = servers::ServerImpl<Details>;

pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::Transcryptor;
    type AppT = App;
    type AppCreatorT = AppCreator;
    type ExtraRunningState = ExtraRunningState;
    type RunningStateSeed = ();
    type ExtraSharedState = ExtraSharedState;
    type ExtraServerState = ExtraServerState;
    type ObjectStoreT = servers::object_store::UseNone;

    fn create_running_state(
        server: &Server,
        constellation: &Constellation,
        _seed: &(),
    ) -> anyhow::Result<Self::ExtraRunningState> {
        let phc_ss = server
            .extra()
            .decap_key
            .decap(&constellation.transcryptor_ss_encap)
            .map_err(|_| anyhow::anyhow!("decapsulating shared secret from PHC failed"))?;

        Ok(ExtraRunningState {
            phc_sealing_secret: phcrypto::sealing_secret(&phc_ss),
            phc_ss,
        })
    }

    fn create_extra_shared_state(config: &servers::Config) -> anyhow::Result<ExtraSharedState> {
        let limits = &config.transcryptor.as_ref().unwrap().push_limits;
        Ok(ExtraSharedState {
            push_limits: std::sync::Mutex::new(PushLimiters {
                per_hub: RateLimiter::new(limits.per_hub),
                per_blob: RateLimiter::new(limits.per_blob),
                blob_hash_key: crypto::random_32_bytes(),
            }),
        })
    }

    fn create_extra_server_state(config: &servers::Config) -> anyhow::Result<ExtraServerState> {
        let xconf = config.transcryptor.as_ref().unwrap();
        let decap_key = xconf
            .decap_key
            .as_ref()
            .expect("decap_key was not set nor generated")
            .decode()
            .map_err(|_| anyhow::anyhow!("decoding kem decapsulation key"))?;
        Ok(ExtraServerState { decap_key })
    }
}

pub struct ExtraSharedState {
    /// Shared by all workers, so the limits hold for the whole transcryptor.
    push_limits: std::sync::Mutex<PushLimiters>,
}

/// Rate limits for [`PushEP`], see [`crate::servers::config::transcryptor::PushLimits`].
struct PushLimiters {
    per_hub: RateLimiter<crate::handle::Handle>,

    /// Keyed by a hash of the blob, with a key that's random per run, so this map holds no blobs.
    per_blob: RateLimiter<[u8; 32]>,
    blob_hash_key: [u8; 32],
}

impl PushLimiters {
    fn blob_key(&self, blob: &str) -> [u8; 32] {
        use sha2::Digest as _;
        sha2::Sha256::new()
            .chain_update(self.blob_hash_key)
            .chain_update(blob.as_bytes())
            .finalize()
            .into()
    }
}

pub struct ExtraServerState {
    pub(super) decap_key: kem::DecapKey,
}

#[derive(Clone, Debug)]
pub struct ExtraRunningState {
    /// Hybrid post-quantum shared secret with pubhubs central
    #[expect(dead_code)]
    phc_ss: kem::SharedSecret,

    /// Key used to (un)seal messages to and from PHC
    pub(super) phc_sealing_secret: crypto::SealingKey,
}

pub struct App {
    base: AppBase<Server>,
    master_enc_key_part: elgamal::PrivateKey,
    master_enc_key_part_inv: curve25519_dalek::Scalar,
    master_enc_key_part_hash: crate::id::Id,
    pseud_factor_secret: B64UU,
    encap_key: kem::EncapKeyBytes,
}

impl Deref for App {
    type Target = AppBase<Server>;

    fn deref(&self) -> &Self::Target {
        &self.base
    }
}

impl crate::servers::App<Server> for App {
    fn configure_actix_app(self: &Rc<Self>, sc: &mut web::ServiceConfig) {
        EhppEP::add_to(self, sc, App::handle_ehpp);
        PushEP::add_to(self, sc, App::handle_push);
        api::server::HubPingEP::add_to(self, sc, App::handle_hub_ping);
    }

    fn check_constellation(&self, constellation: &Constellation) -> bool {
        // Dear maintainer: this destructuring is intentional, making sure that this `check_constellation` function
        // is updated when new fields are added to the constellation
        let Constellation {
            inner:
                constellation::Inner {
                    // These fields we must check:
                    transcryptor_verifying_key,
                    transcryptor_master_enc_key_part_hash,
                    transcryptor_encap_key_id,

                    // These fields we don't care about:
                    transcryptor_url: _,
                    transcryptor_ss_encap: _,
                    auths_verifying_key: _,
                    auths_url: _,
                    auths_encap_key_id: _,
                    auths_ss_encap: _,
                    phc_jwt_key: _,
                    phc_verifying_key: _,
                    phc_master_enc_key_part_hash: _,
                    phc_url: _,
                    global_client_url: _,
                    ph_version: _, // (already checked)
                },
            id: _,
            created_at: _,
        } = constellation;

        // PHC must have encapsulated against our current encapsulation key; otherwise reject so that
        // discovery re-runs and PHC (re)publishes a matching ciphertext.
        if *transcryptor_encap_key_id != self.encap_key.id() {
            return false;
        }

        transcryptor_verifying_key == &self.shared.verifying_key_bytes
            && *transcryptor_master_enc_key_part_hash == self.master_enc_key_part_hash
    }

    fn master_enc_key_part(&self) -> Option<&elgamal::PrivateKey> {
        Some(&self.master_enc_key_part)
    }

    fn encap_key(&self) -> Option<&kem::EncapKeyBytes> {
        Some(&self.encap_key)
    }

    fn master_enc_key_part_sealing_key(&self) -> Option<&api::SealingKey> {
        self.running_state.as_ref().map(|rs| &rs.phc_sealing_secret)
    }

    async fn discover(
        self: &Rc<Self>,
        phc_inf: api::DiscoveryInfoResp,
    ) -> api::Result<DiscoverVerdict<()>> {
        self.discover_as_non_phc(phc_inf).await
    }
}

impl App {
    /// Implements [`api::server::HubPingEP`].
    async fn handle_hub_ping(
        app: Rc<Self>,
        signed_req: web::Json<api::phc::hub::TicketSigned<api::server::PingReq>>,
    ) -> api::Result<api::server::PingResp> {
        crate::servers::AppBase::<Server>::handle_hub_ping(app, signed_req).await
    }

    /// Implements [`PushEP`]: relays a hub's pushes to PHC, without saying which hub they come from.
    ///
    /// Logs no blobs or hubs, and nothing per push (see `docs/app/push.md`).
    async fn handle_push(
        app: Rc<Self>,
        signed_req: web::Json<api::phc::hub::TicketSigned<PushReq>>,
    ) -> api::Result<PushResp> {
        let running_state = app.running_state_or_please_retry()?;

        let (PushReq { pushes }, hub) = match signed_req
            .into_inner()
            .open(&running_state.phc_verifying_key)
        {
            Ok(opened) => opened,
            Err(toe) => return toe.default_verdict(PushResp::RetryWithNewTicket),
        };

        if pushes.is_empty()
            || pushes.len() > MAX_PUSHES_PER_REQ
            || pushes
                .iter()
                .any(|push| push.blob.len() > MAX_PUSH_BLOB_LEN)
        {
            return Err(api::ErrorCode::BadRequest);
        }

        // Which pushes to relay.  Pushes to a blob that was pushed to too often are dropped, and
        // reported as delivered: the device shows one notification for a burst anyway.
        let relay: Vec<usize> = {
            let mut limits = app
                .shared
                .extra
                .push_limits
                .lock()
                .map_err(|_| api::ErrorCode::InternalError)?;
            let limits = &mut *limits;
            // One token per push, not per request: the limit is on how many devices a hub pushes to.
            if !limits.per_hub.allow_n(hub, pushes.len() as u32) {
                return Ok(PushResp::TooManyPushes);
            }
            (0..pushes.len())
                .filter(|&i| {
                    let key = limits.blob_key(&pushes[i].blob);
                    limits.per_blob.allow(key)
                })
                .collect()
        };

        if relay.is_empty() {
            return Ok(PushResp::Success(PushResult::default()));
        }

        let sealed = api::Sealed::new(
            &api::phc::push::SendReq {
                pushes: relay.iter().map(|&i| pushes[i].clone()).collect(),
            },
            &running_state.phc_sealing_secret,
        )?;

        // Gives back the per-blob tokens of pushes that weren't delivered: Synapse retries them, and
        // the retry shouldn't be dropped as if it were one push too many.
        let refund = |indices: &mut dyn Iterator<Item = usize>| {
            if let Ok(mut limits) = app.shared.extra.push_limits.lock() {
                for i in indices {
                    let key = limits.blob_key(&pushes[i].blob);
                    limits.per_blob.refund(&key);
                }
            }
        };

        use api::ApiResultExt as _;
        let result = app
            .client
            .query::<api::phc::push::SendEP>(&running_state.constellation.phc_url, sealed)
            .await
            .into_server_result();
        let result = match result {
            Ok(result) => result,
            Err(err) => {
                refund(&mut relay.iter().copied());
                return Err(err);
            }
        };
        match result {
            // PHC's indices are into `relay`; map them back to the hub's.
            api::phc::push::SendResp::Success(result) => {
                refund(&mut result.failed.iter().filter_map(|&i| relay.get(i).copied()));
                Ok(PushResp::Success(PushResult {
                    rejected: result
                        .rejected
                        .iter()
                        .filter_map(|&i| relay.get(i).copied())
                        .collect(),
                    failed: result
                        .failed
                        .iter()
                        .filter_map(|&i| relay.get(i).copied())
                        .collect(),
                }))
            }
            api::phc::push::SendResp::RetryWithNewSecret => {
                refund(&mut relay.iter().copied());
                log::warn!("PHC could not open our pushes; is our constellation outdated?");
                Err(api::ErrorCode::PleaseRetry)
            }
        }
    }

    /// Implements [`EhppEP`]
    async fn handle_ehpp(app: Rc<Self>, req: web::Json<EhppReq>) -> api::Result<EhppResp> {
        let running_state = app.running_state_or_please_retry()?;

        let EhppReq {
            hub_nonce,
            hub,
            ppp,
            hub_mac_key,
        } = req.into_inner();

        let Ok(api::sso::PolymorphicPseudonymPackage {
            polymorphic_pseudonym,
            nonce: phc_nonce,
        }) = ppp.open(&running_state.phc_sealing_secret)
        else {
            return Ok(EhppResp::RetryWithNewPpp);
        };

        let encrypted_hub_pseudonym: elgamal::Triple = phcrypto::t_encrypted_hub_pseudonym(
            polymorphic_pseudonym,
            &***app.pseud_factor_secret,
            &app.master_enc_key_part_inv,
            hub,
        );

        let hub_id_mac = hub_mac_key.map(|key| key.mac(&hub));

        Ok(EhppResp::Success(api::Sealed::new(
            &api::sso::EncryptedHubPseudonymPackage {
                encrypted_hub_pseudonym,
                hub_nonce,
                phc_nonce,
                hub_id_mac,
            },
            &running_state.phc_sealing_secret,
        )?))
    }
}

#[derive(Clone)]
pub struct AppCreator {
    base: AppCreatorBase<Server>,
    master_enc_key_part: elgamal::PrivateKey,
    master_enc_key_part_inv: curve25519_dalek::Scalar,
    pseud_factor_secret: B64UU,
    encap_key: kem::EncapKeyBytes,
}

impl Deref for AppCreator {
    type Target = AppCreatorBase<Server>;

    fn deref(&self) -> &Self::Target {
        &self.base
    }
}

impl DerefMut for AppCreator {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.base
    }
}

impl crate::servers::AppCreator<Server> for AppCreator {
    type ContextT = ();

    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        let xconf = &config.transcryptor.as_ref().unwrap();

        let master_enc_key_part: elgamal::PrivateKey = xconf
            .master_enc_key_part
            .clone()
            .expect("master_enc_key_part was not generated");

        let pseud_factor_secret = xconf
            .pseud_factor_secret
            .clone()
            .expect("pseud_factor_secret was not generated");

        let encap_key = xconf
            .decap_key
            .as_ref()
            .expect("decap_key was not set nor generated")
            .decode()
            .and_then(|dk| dk.encap_key().encode())
            .map_err(|_| anyhow::anyhow!("deriving kem encapsulation key"))?;

        Ok(Self {
            base: AppCreatorBase::<Server>::new(config)?,
            master_enc_key_part_inv: master_enc_key_part.as_scalar().invert(),
            master_enc_key_part,
            pseud_factor_secret,
            encap_key,
        })
    }

    fn into_app(
        self,
        handle: &Handle<Server>,
        _context: &Self::ContextT,
        generation: usize,
    ) -> App {
        App {
            base: AppBase::new(self.base, handle, generation),
            master_enc_key_part_hash: phcrypto::master_enc_key_part_hash(
                self.master_enc_key_part.public_key(),
            ),
            master_enc_key_part: self.master_enc_key_part,
            master_enc_key_part_inv: self.master_enc_key_part_inv,
            pseud_factor_secret: self.pseud_factor_secret,
            encap_key: self.encap_key,
        }
    }
}
