//! Authentication server core code
use std::rc::Rc;

use actix_web::web;
use digest::Digest as _;

use crate::servers::{
    self, constellation, yivi, AppBase, AppCreatorBase, Constellation, Handle, Server as _,
};
use crate::{
    api::{self, EndpointDetails as _, ResultExt as _},
    attr,
    common::{elgamal, secret::DigestibleSecret as _},
    handle, map,
    misc::{crypto, jwt},
    phcrypto,
};

/// Authentication server type
pub type Server = servers::ServerImpl<Details>;

/// [`servers::Details`] used to define [`Server`].
pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::AuthenticationServer;

    type AppT = Rc<App>;
    type AppCreatorT = AppCreator;
    type ExtraRunningState = ExtraRunningState;
    type ObjectStoreT = servers::object_store::UseNone;

    fn create_running_state(
        server: &Server,
        constellation: &Constellation,
    ) -> anyhow::Result<Self::ExtraRunningState> {
        let base = &server.app_creator().base;

        let phc_ss = base.enc_key.shared_secret(&constellation.phc_enc_key);

        Ok(ExtraRunningState {
            attr_signing_key: phcrypto::attr_signing_key(&phc_ss),
            phc_ss,
        })
    }
}

#[derive(Clone, Debug)]
pub struct ExtraRunningState {
    /// Shared secret with pubhubs central
    phc_ss: elgamal::SharedSecret,

    /// Key used to sign [`Attr`]s, shared with pubhubs central.
    ///
    /// [`Attr`]: attr::Attr
    attr_signing_key: jwt::HS256,
}

/// Authentication server per-thread [`App`] that handles incoming requests.
pub struct App {
    base: AppBase<Server>,
    attribute_types: map::Map<attr::Type>,
    yivi: Option<YiviCtx>,
    auth_state_secret: crypto::SealingKey,
    auth_window: core::time::Duration,
}

/// Details on the Yivi server trusted by this authentication server.
#[derive(Debug, Clone)]
pub struct YiviCtx {
    requestor_url: url::Url,
    requestor_creds: yivi::Credentials<yivi::SigningKey>,
    server_creds: yivi::Credentials<yivi::VerifyingKey>,
}

/// # Helper functions
impl App {
    fn get_yivi(&self) -> Result<&YiviCtx, api::ErrorCode> {
        self.yivi.as_ref().ok_or(api::ErrorCode::YiviNotConfigured)
    }

    /// Get [`attr::Type`] by [`handle::Handle`], returning [`api::ErrorCode::UnknownAttributeType`]
    /// when it cannot be found.
    fn attr_type_from_handle<'s>(
        &'s self,
        attr_type_handle: &handle::Handle,
    ) -> api::Result<&'s attr::Type> {
        self.attribute_types
            .get(attr_type_handle)
            .ok_or(api::ErrorCode::UnknownAttributeType)
    }
}

/// Plaintext content of [`api::auths::AuthState`].
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct AuthState {
    source: attr::Source,
    attr_types: Vec<handle::Handle>,

    /// When this request expires
    exp: jwt::NumericDate,
}

impl AuthState {
    fn seal(&self, key: &crypto::SealingKey) -> api::Result<api::auths::AuthState> {
        Ok(api::auths::AuthState::new(
            crypto::seal(&self, key, b"")
                .map_err(|err| {
                    log::warn!("failed to seal AuthState: {err}");
                    api::ErrorCode::InternalError
                })?
                .into(),
        ))
    }

    fn unseal(sealed: &api::auths::AuthState, key: &crypto::SealingKey) -> api::Result<AuthState> {
        crypto::unseal(&sealed.inner, key, b"").map_err(|err| {
            log::debug!("failed to unseal AuthState: {err}");
            api::ErrorCode::BrokenSeal
        })
    }
}

/// # Implementaton of endpoints
impl App {
    async fn handle_auth_start(
        app: Rc<Self>,
        req: web::Json<api::auths::AuthStartReq>,
    ) -> api::Result<api::auths::AuthStartResp> {
        let state = AuthState {
            source: req.source,
            attr_types: req.attr_types.clone(),
            exp: jwt::NumericDate::now() + app.auth_window,
        };

        match req.source {
            attr::Source::Yivi => Self::handle_auth_start_yivi(app, state).await,
        }
    }

    async fn handle_auth_start_yivi(
        app: Rc<Self>,
        state: AuthState,
    ) -> api::Result<api::auths::AuthStartResp> {
        let yivi = app.get_yivi()?;

        // Create ConDisCon for our attributes
        let mut cdc: servers::yivi::AttributeConDisCon = Default::default(); // empty

        for attr_ty_handle in state.attr_types.iter() {
            let attr_ty = app.attr_type_from_handle(attr_ty_handle)?;

            let dc: Vec<Vec<servers::yivi::AttributeRequest>> = attr_ty
                .yivi_attr_type_ids()
                .map(|attr_type_id| {
                    vec![servers::yivi::AttributeRequest {
                        ty: attr_type_id.clone(),
                    }]
                })
                .collect();

            if dc.is_empty() {
                log::debug!("{}: got yivi authentication start request for {attr_ty}, but yivi is not supported for this attribute type", Server::NAME);
                return Err(api::ErrorCode::MissingAttributeSource);
            }

            cdc.push(dc);
        }

        let disclosure_request: jwt::JWT = servers::yivi::SessionRequest::disclosure(cdc)
            .sign(&yivi.requestor_creds)
            .into_ec(|err| {
                log::error!(
                    "{}: failed to create signed disclosure request: {err}",
                    Server::NAME
                );

                api::ErrorCode::InternalError
            })?;

        Ok(api::auths::AuthStartResp {
            task: api::auths::AuthTask::Yivi {
                disclosure_request,
                yivi_requestor_url: yivi.requestor_url.clone(),
            },
            state: state.seal(&app.auth_state_secret)?,
        })
    }

    async fn handle_auth_complete(
        app: Rc<Self>,
        req: web::Json<api::auths::AuthCompleteReq>,
    ) -> api::Result<api::auths::AuthCompleteResp> {
        app.base.running_state_or_not_yet_ready()?;

        let req: api::auths::AuthCompleteReq = req.into_inner();

        let state: AuthState = AuthState::unseal(&req.state, &app.auth_state_secret)?;

        if state.exp < jwt::NumericDate::now() {
            return Err(api::ErrorCode::Expired);
        }

        match state.source {
            attr::Source::Yivi => {
                Self::handle_auth_complete_yivi(
                    app,
                    state,
                    match req.proof {
                        api::auths::AuthProof::Yivi { disclosure } => disclosure,
                        #[expect(unreachable_patterns)]
                        _ => return Err(api::ErrorCode::InvalidAuthProof),
                    },
                )
                .await
            }
        }
    }

    async fn handle_auth_complete_yivi(
        app: Rc<Self>,
        state: AuthState,
        disclosure: jwt::JWT,
    ) -> api::Result<api::auths::AuthCompleteResp> {
        let yivi = app.get_yivi()?;

        let ssr =
            yivi::SessionResult::open_signed(&disclosure, &yivi.server_creds).map_err(|err| {
                log::debug!("invalid yivi signed session result submitted: {err}",);
                api::ErrorCode::InvalidAuthProof
            })?;

        let mut attrs: std::collections::HashMap<handle::Handle, api::Signed<attr::Attr>> =
            std::collections::HashMap::with_capacity(state.attr_types.len());

        let running_state = app.base.running_state_or_internal_error()?;

        for (i, result) in ssr
            .validate_and_extract_raw_singles()
            .map_err(|err| {
                log::debug!("invalid session result submitted: {err}");
                api::ErrorCode::InvalidAuthProof
            })?
            .enumerate()
        {
            let (yati, raw_value): (&yivi::AttributeTypeIdentifier, &str) =
                result.map_err(|err| {
                    log::debug!(
                        "problem with attribute number {i} of submitted session result: {err}",
                    );
                    api::ErrorCode::InvalidAuthProof
                })?;

            let attr_type_handle: &handle::Handle = state.attr_types.get(i).ok_or_else(|| {
                log::debug!("extra attributes disclosed in submitted session result",);
                api::ErrorCode::InvalidAuthProof
            })?;

            let attr_type = app.attr_type_from_handle(attr_type_handle)?;

            if !attr_type
                .yivi_attr_type_ids()
                .any(|allowed_yati| allowed_yati == yati)
            {
                log::debug!("attribute number {i} of submitted session result has unexpected attribute type id {}",  yati);
                return Err(api::ErrorCode::InvalidAuthProof);
            }

            // Disclosure for attribute is OK.

            attrs
                .insert(
                    attr_type_handle.clone(),
                    api::Signed::<attr::Attr>::new(
                        &running_state.extra.attr_signing_key,
                        &attr::Attr {
                            attr_type: attr_type.id,
                            value: raw_value.to_string(),
                        },
                        app.auth_window,
                    )?,
                )
                .into_ec(|_| {
                    log::error!("expected to have already erred on duplicate attribute types");
                    api::ErrorCode::InternalError
                })?;
        }

        Ok(api::auths::AuthCompleteResp { attrs })
    }
}

impl crate::servers::App<Server> for Rc<App> {
    fn configure_actix_app(&self, sc: &mut web::ServiceConfig) {
        api::auths::AuthStartEP::add_to(self, sc, App::handle_auth_start);
        api::auths::AuthCompleteEP::add_to(self, sc, App::handle_auth_complete);
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
                },
            id: _,
        } = constellation;

        enc_key == self.base.enc_key.public_key() && **jwt_key == self.base.jwt_key.verifying_key()
    }

    fn base(&self) -> &AppBase<Server> {
        &self.base
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
        });

        let auth_state_secret: crypto::SealingKey = base
            .enc_key
            .derive_sealing_key(sha2::Sha256::new(), "pubhubs-auths-auth-state");

        let auth_window = xconf.auth_window;

        Ok(Self {
            base,
            attribute_types,
            yivi,
            auth_state_secret,
            auth_window,
        })
    }

    fn into_app(self, handle: &Handle<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(self.base, handle),
            attribute_types: self.attribute_types,
            yivi: self.yivi,
            auth_state_secret: self.auth_state_secret,
            auth_window: self.auth_window,
        })
    }

    fn base(&self) -> &AppCreatorBase<Server> {
        &self.base
    }

    fn base_mut(&mut self) -> &mut AppCreatorBase<Server> {
        &mut self.base
    }
}
