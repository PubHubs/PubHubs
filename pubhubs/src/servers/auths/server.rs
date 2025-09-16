//! Authentication server core code
use std::collections::HashMap;
use std::ops::{Deref, DerefMut};
use std::rc::Rc;

use actix_web::web;
use digest::Digest as _;

use crate::servers::{self, constellation, yivi, AppBase, AppCreatorBase, Constellation, Handle};
use crate::{
    api::{self, EndpointDetails as _},
    attr,
    common::{elgamal, secret::DigestibleSecret as _},
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
    type ExtraSharedState = ExtraSharedState;
    type ObjectStoreT = servers::object_store::UseNone;

    fn create_running_state(
        server: &Server,
        constellation: &Constellation,
    ) -> anyhow::Result<Self::ExtraRunningState> {
        let phc_ss = server.enc_key.shared_secret(&constellation.phc_enc_key);

        Ok(ExtraRunningState {
            attr_signing_key: phcrypto::attr_signing_key(&phc_ss),
            phc_sealing_secret: phcrypto::sealing_secret(&phc_ss),
            phc_ss,
        })
    }

    fn create_extra_shared_state(_config: &servers::Config) -> anyhow::Result<ExtraSharedState> {
        Ok(ExtraSharedState {})
    }
}

pub struct ExtraSharedState {}

#[derive(Clone, Debug)]
pub struct ExtraRunningState {
    /// Shared secret with pubhubs central
    #[expect(dead_code)]
    pub phc_ss: elgamal::SharedSecret,

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
    pub attr_types: Vec<handle::Handle>,

    /// When this request expires
    pub exp: api::NumericDate,

    pub yivi_chained_session_id: Option<id::Id>,
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
    /// Implements [`api::auths::WelcomeEP`].
    fn cached_handle_welcome(app: &Self) -> api::Result<api::auths::WelcomeResp> {
        let attr_types: HashMap<handle::Handle, attr::Type> = app
            .attribute_types
            .values()
            .map(|attr_type| (attr_type.handles.preferred().clone(), attr_type.clone()))
            .collect();

        Ok(api::auths::WelcomeResp { attr_types })
    }
}

impl crate::servers::App<Server> for App {
    fn configure_actix_app(self: &Rc<Self>, sc: &mut web::ServiceConfig) {
        api::auths::WelcomeEP::caching_add_to(self, sc, App::cached_handle_welcome);

        api::auths::AuthStartEP::add_to(self, sc, App::handle_auth_start);
        api::auths::AuthCompleteEP::add_to(self, sc, App::handle_auth_complete);

        api::auths::AttrKeysEP::add_to(self, sc, App::handle_attr_keys);

        api::auths::YiviWaitForResultEP::add_to(self, sc, App::handle_yivi_wait_for_result);

        // NOTE: the yivi next-session endpoint does conform to our API's endpoint format, so we
        // register it manually, and not via the `add_to` method
        sc.app_data(self.clone()).route(
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
                    auths_enc_key: enc_key,
                    auths_jwt_key: jwt_key,

                    // These fields we don't care about:
                    auths_url: _,
                    transcryptor_jwt_key: _,
                    transcryptor_enc_key: _,
                    transcryptor_url: _,
                    transcryptor_master_enc_key_part: _,
                    phc_jwt_key: _,
                    phc_enc_key: _,
                    phc_url: _,
                    master_enc_key: _,
                    global_client_url: _,
                    ph_version: _, // (already checked)
                },
            id: _,
            created_at: _,
        } = constellation;

        enc_key == self.enc_key.public_key() && **jwt_key == self.jwt_key.verifying_key()
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
    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        let base = AppCreatorBase::<Server>::new(config)?;

        let xconf = &config.auths.as_ref().unwrap();

        let mut attribute_types: crate::map::Map<attr::Type> = Default::default();

        for attr_type in xconf.attribute_types.iter() {
            if let Some(handle_or_id) = attribute_types.insert_new(attr_type.clone()) {
                anyhow::bail!("two attribute types are known as {handle_or_id}");
            }
        }

        let yivi: Option<YiviCtx> = xconf.yivi.as_ref().map(|cfg| YiviCtx {
            requestor_url: cfg.requestor_url.as_ref().clone(),
            requestor_creds: cfg.requestor_creds.clone(),
            server_creds: cfg.server_creds(),
            chained_sessions_config: cfg.chained_sessions.clone(),
        });

        let auth_state_secret: crypto::SealingKey = base
            .enc_key
            .derive_sealing_key(sha2::Sha256::new(), "pubhubs-auths-auth-state");

        let auth_window = xconf.auth_window;

        let attr_key_secret = xconf
            .attr_key_secret
            .as_ref()
            .expect("attr_key_secret not generated")
            .to_vec();

        let chained_sessions_ctl = yivi
            .as_ref()
            .map(|yivi_ctx| ChainedSessionsCtl::new(yivi_ctx.clone()));

        Ok(Self {
            base,
            attribute_types,
            yivi,
            auth_state_secret,
            auth_window,
            attr_key_secret,
            chained_sessions_ctl,
        })
    }

    fn into_app(self, handle: &Handle<Server>) -> App {
        App {
            base: AppBase::new(self.base, handle),
            attribute_types: self.attribute_types,
            yivi: self.yivi,
            auth_state_secret: self.auth_state_secret,
            auth_window: self.auth_window,
            attr_key_secret: self.attr_key_secret,
            chained_sessions_ctl: self.chained_sessions_ctl,
        }
    }
}
