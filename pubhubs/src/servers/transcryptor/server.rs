use std::ops::{Deref, DerefMut};
use std::rc::Rc;

use actix_web::web;

use crate::common::{elgamal, kem};
use crate::misc::crypto;
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

    fn create_extra_shared_state(_config: &servers::Config) -> anyhow::Result<ExtraSharedState> {
        Ok(ExtraSharedState {})
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

pub struct ExtraSharedState {}

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

        transcryptor_verifying_key == &self.verifying_key_bytes
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
