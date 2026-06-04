//! Authentication server core code
use std::collections::HashMap;
use std::ops::{Deref, DerefMut};
use std::rc::Rc;

use actix_web::web;
use sha2::digest::Digest as _;

use crate::servers::{
    self, AppBase, AppCreatorBase, Constellation, DiscoverVerdict, Handle, Server as _,
    constellation, yivi,
};
use crate::{
    api::{self, EndpointDetails as _},
    attr,
    common::{kem, secret::DigestibleSecret as _},
    handle, id, map,
    misc::{crypto, jwt},
    phcrypto,
};

use super::yivi::ChainedSessionsCtl;

/// Authentication server type
pub type Server = servers::ServerImpl<Details>;

/// [`servers::Details`] used to define [`Server`].
pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::AuthenticationServer;

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
            .decap(&constellation.auths_ss_encap)
            .map_err(|_| anyhow::anyhow!("decapsulating shared secret from PHC failed"))?;

        Ok(ExtraRunningState {
            attr_signing_key: phcrypto::attr_signing_key(&phc_ss),
            phc_sealing_secret: phcrypto::sealing_secret(&phc_ss),
            phc_ss,
        })
    }

    fn create_extra_shared_state(_config: &servers::Config) -> anyhow::Result<ExtraSharedState> {
        Ok(ExtraSharedState {})
    }

    fn create_extra_server_state(config: &servers::Config) -> anyhow::Result<ExtraServerState> {
        let xconf = config.auths.as_ref().unwrap();
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
    pub phc_ss: kem::SharedSecret,

    /// Key used to sign [`Attr`]s, shared with pubhubs central.
    ///
    /// [`Attr`]: attr::Attr
    pub attr_signing_key: jwt::HS256,

    /// key used to seal messages to PHC
    #[expect(dead_code)]
    pub phc_sealing_secret: crypto::SealingKey,
}

/// Authentication server per-thread [`App`] that handles incoming requests.
pub struct App {
    pub base: AppBase<Server>,
    pub attribute_types: map::Map<attr::Type>,
    pub yivi: Option<YiviCtx>,
    pub auth_state_secret: crypto::SealingKey,
    pub auth_window: core::time::Duration,
    pub attr_key_secret: Vec<u8>,
    pub chained_sessions_ctl: Option<ChainedSessionsCtl>,
    pub encap_key: kem::EncapKeyBytes,
}

impl Deref for App {
    type Target = AppBase<Server>;

    fn deref(&self) -> &Self::Target {
        &self.base
    }
}

/// Details on the Yivi server trusted by this authentication server.
#[derive(Debug, Clone)]
pub struct YiviCtx {
    pub requestor_url: url::Url,
    pub requestor_creds: yivi::Credentials<yivi::SigningKey>,
    pub server_creds: yivi::Credentials<yivi::VerifyingKey>,

    pub chained_sessions_config: super::yivi::ChainedSessionsConfig,
    pub card_config: super::card::CardConfig,
}

/// # Helper functions
impl App {
    pub fn get_yivi(&self) -> Result<&YiviCtx, api::ErrorCode> {
        self.yivi.as_ref().ok_or_else(|| {
            log::debug!("yivi requested, but not configured");
            api::ErrorCode::BadRequest
        })
    }

    /// Get [`attr::Type`] by [`handle::Handle`], returning [`None`]
    /// when it cannot be found.
    pub fn attr_type_from_handle<'s>(
        &'s self,
        attr_type_handle: &handle::Handle,
    ) -> Option<&'s attr::Type> {
        self.attribute_types.get(attr_type_handle)
    }
}

/// Plaintext content of [`api::auths::AuthState`].
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub(super) struct AuthState {
    pub source: attr::Source,
    pub attr_type_choices: Vec<Vec<handle::Handle>>,

    /// When this request expires
    pub exp: api::NumericDate,

    /// Set when [`api::auths::AuthStartReq::yivi_chained_session`] is enabled.
    pub yivi_chained_session: Option<ChainedSessionSetup>,

    /// Under [`attr::Source::Yivi`] this will contain for each `AuthState::attr_type_choice`
    /// a map using which the original [`attr::Type`] handle can be recovered from the yivi
    /// attribute type identifier.
    pub yivi_ati2at: Vec<HashMap<yivi::AttributeTypeIdentifier, handle::Handle>>,
}

/// Type of [`AuthState::yivi_chained_session`].
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub(super) struct ChainedSessionSetup {
    pub id: id::Id,
    pub drip: bool,
}

impl AuthState {
    pub fn seal(&self, key: &crypto::SealingKey) -> api::Result<api::auths::AuthState> {
        Ok(api::auths::AuthState::new(
            crypto::seal(&self, key, b"")
                .map_err(|err| {
                    log::warn!("failed to seal AuthState: {err}");
                    api::ErrorCode::InternalError
                })?
                .into(),
        ))
    }

    /// Unseals the given [`AuthState`] returning `None` of the signature is invalid
    /// or the auth state is expired
    pub fn unseal(sealed: &api::auths::AuthState, key: &crypto::SealingKey) -> Option<AuthState> {
        let Ok(state): Result<AuthState, _> = crypto::unseal(&*sealed.inner, key, b"") else {
            log::debug!("failed to unseal AuthState");
            return None;
        };

        if state.exp < api::NumericDate::now() {
            log::debug!("received expired AuthState");
            return None;
        }

        Some(state)
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

    /// Implements [`api::auths::WelcomeEP`].
    fn cached_handle_welcome(app: &Self) -> api::Result<api::auths::WelcomeResp> {
        let attr_types: HashMap<handle::Handle, attr::Type> = app
            .attribute_types
            .values()
            .map(|attr_type| (attr_type.handles.preferred().clone(), attr_type.clone()))
            .collect();

        Ok(api::auths::WelcomeResp {
            attr_types,
            card_validity: app
                .get_yivi()
                .map(|yivi| yivi.card_config.valid_for.to_welcome_ep_format())
                .ok()
                .flatten(),
        })
    }
}

impl crate::servers::App<Server> for App {
    fn configure_actix_app(self: &Rc<Self>, sc: &mut web::ServiceConfig) {
        api::auths::WelcomeEP::caching_add_to(self, sc, App::cached_handle_welcome);
        api::server::HubPingEP::add_to(self, sc, App::handle_hub_ping);

        api::auths::AuthStartEP::add_to(self, sc, App::handle_auth_start);
        api::auths::AuthCompleteEP::add_to(self, sc, App::handle_auth_complete);

        api::auths::AttrKeysEP::add_to(self, sc, App::handle_attr_keys);

        api::auths::CardEP::add_to(self, sc, App::handle_card);

        api::auths::YiviWaitForResultEP::add_to(self, sc, App::handle_yivi_wait_for_result);
        api::auths::YiviReleaseNextSessionEP::add_to(
            self,
            sc,
            App::handle_yivi_release_next_session,
        );

        // NOTE: the yivi next-session endpoint does conform to our API's endpoint format, so we
        // register it manually, and not via the `add_to` method
        sc.app_data(web::Data::new(self.clone())).route(
            api::auths::YIVI_NEXT_SESSION_PATH,
            web::post().to(App::handle_yivi_next_session),
        );
    }

    fn check_constellation(&self, constellation: &Constellation) -> bool {
        // Dear maintainer: this destructuring is intentional, making sure that this `check_constellation` function
        // is updated when new fields are added to the constellation
        let Constellation {
            inner:
                constellation::Inner {
                    // These fields we must check:
                    auths_verifying_key,
                    auths_encap_key_id,

                    // These fields we don't care about:
                    auths_url: _,
                    auths_ss_encap: _,
                    transcryptor_verifying_key: _,
                    transcryptor_url: _,
                    transcryptor_master_enc_key_part_hash: _,
                    transcryptor_encap_key_id: _,
                    transcryptor_ss_encap: _,
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
        if *auths_encap_key_id != self.encap_key.id() {
            return false;
        }

        auths_verifying_key == &self.verifying_key_bytes
    }

    fn encap_key(&self) -> Option<&kem::EncapKeyBytes> {
        Some(&self.encap_key)
    }

    async fn discover(
        self: &Rc<Self>,
        phc_inf: api::DiscoveryInfoResp,
    ) -> api::Result<DiscoverVerdict<()>> {
        self.discover_as_non_phc(phc_inf).await
    }
}

/// Moves accross threads to create [`App`]s.
#[derive(Clone)]
pub struct AppCreator {
    base: AppCreatorBase<Server>,
    attribute_types: map::Map<attr::Type>,
    yivi: Option<YiviCtx>,
    auth_state_secret: crypto::SealingKey,
    auth_window: core::time::Duration,
    attr_key_secret: Vec<u8>,
    chained_sessions_ctl: Option<ChainedSessionsCtl>,
    encap_key: kem::EncapKeyBytes,
}

impl Deref for AppCreator {
    type Target = AppCreatorBase<Server>;

    #[inline]
    fn deref(&self) -> &Self::Target {
        &self.base
    }
}

impl DerefMut for AppCreator {
    #[inline]
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.base
    }
}

impl crate::servers::AppCreator<Server> for AppCreator {
    type ContextT = ();

    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        let base = AppCreatorBase::<Server>::new(config)?;

        let xconf = &config.auths.as_ref().unwrap();

        let mut attribute_types: crate::map::Map<attr::Type> = Default::default();

        for attr_type in xconf.attribute_types.iter() {
            if let Some(handle_or_id) = attribute_types.insert_new(attr_type.clone()) {
                anyhow::bail!("two attribute types are known as {handle_or_id}");
            }
        }

        if let Some(cfg) = xconf.yivi.as_ref() {
            anyhow::ensure!(
                !matches!(cfg.requestor_creds.key, yivi::SigningKey::RS256(_)),
                "rs256 yivi requestor credentials are not supported (due to RUSTSEC-2023-0071); use hs256 instead"
            );
        }

        let yivi: Option<YiviCtx> = xconf.yivi.as_ref().map(|cfg| YiviCtx {
            requestor_url: cfg.requestor_url.as_ref().clone(),
            requestor_creds: cfg.requestor_creds.clone(),
            server_creds: cfg.server_creds(),
            chained_sessions_config: cfg.chained_sessions.clone(),
            card_config: cfg.card.clone(),
        });

        let enc_key: &[u8] = &base.enc_key;
        let auth_state_secret: crypto::SealingKey =
            enc_key.derive_sealing_key(sha2::Sha256::new(), "pubhubs-auths-auth-state");

        let auth_window = xconf.auth_window;

        let attr_key_secret = xconf
            .attr_key_secret
            .as_ref()
            .expect("attr_key_secret not generated")
            .to_vec();

        let chained_sessions_ctl = yivi
            .as_ref()
            .map(|yivi_ctx| ChainedSessionsCtl::new(yivi_ctx.clone()));

        let encap_key = xconf
            .decap_key
            .as_ref()
            .expect("decap_key was not set nor generated")
            .decode()
            .and_then(|dk| dk.encap_key().encode())
            .map_err(|_| anyhow::anyhow!("deriving kem encapsulation key"))?;

        Ok(Self {
            base,
            attribute_types,
            yivi,
            auth_state_secret,
            auth_window,
            attr_key_secret,
            chained_sessions_ctl,
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
            attribute_types: self.attribute_types,
            yivi: self.yivi,
            auth_state_secret: self.auth_state_secret,
            auth_window: self.auth_window,
            attr_key_secret: self.attr_key_secret,
            chained_sessions_ctl: self.chained_sessions_ctl,
            encap_key: self.encap_key,
        }
    }
}
