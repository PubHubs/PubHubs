//! Authentication server core code
use std::rc::Rc;

use actix_web::web;
use digest::Digest as _;

use crate::servers::{self, yivi, AppBase, AppCreatorBase, Constellation, Handle};
use crate::{
    api::{self, EndpointDetails as _, ResultExt as _},
    attr,
    common::secret::DigestibleSecret as _,
    handle, map,
    misc::{crypto, jwt},
};

/// Authentication server type
pub type Server = servers::ServerImpl<Details>;

/// [`servers::Details`] used to define [`Server`].
pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::AuthenticationServer;

    type AppT = Rc<App>;
    type AppCreatorT = AppCreator;
    type ExtraRunningState = ();
    type ObjectStoreT = servers::object_store::UseNone;

    fn create_running_state(
        _server: &Server,
        _constellation: &Constellation,
    ) -> anyhow::Result<Self::ExtraRunningState> {
        Ok(())
    }
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

impl App {
    fn get_yivi(&self) -> Result<&YiviCtx, api::ErrorCode> {
        self.yivi.as_ref().ok_or(api::ErrorCode::YiviNotConfigured)
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
            crypto::seal(&self, &key, b"")
                .map_err(|err| {
                    log::warn!("failed to seal AuthState: {err}");
                    api::ErrorCode::InternalError
                })?
                .into(),
        ))
    }

    fn unseal(sealed: &api::auths::AuthState, key: &crypto::SealingKey) -> api::Result<AuthState> {
        crypto::unseal(&sealed.inner, &key, b"").map_err(|err| {
            log::debug!("failed to unseal AuthState: {err}");
            api::ErrorCode::BrokenSeal
        })
    }
}

impl App {
    async fn handle_auth_start(
        app: Rc<Self>,
        req: web::Json<api::auths::AuthStartReq>,
    ) -> api::Result<api::auths::AuthStartResp> {
        let attr_types: Vec<attr::Type> = app.attr_types_from_handles(&req.attr_types)?;

        let state = AuthState {
            source: req.source,
            attr_types: req.attr_types.clone(),
            exp: jwt::NumericDate::now() + app.auth_window,
        };

        match req.source {
            attr::Source::Yivi => Self::handle_auth_start_yivi(app, attr_types, state).await,
        }
    }

    fn attr_types_from_handles(
        &self,
        attr_type_handles: &Vec<handle::Handle>,
    ) -> api::Result<Vec<attr::Type>> {
        let mut attr_types = Vec::<attr::Type>::with_capacity(attr_type_handles.len());

        for attr_type_handle in attr_type_handles.iter() {
            if let Some(attr_type) = self.attribute_types.get(attr_type_handle) {
                attr_types.push(attr_type.clone());
            } else {
                log::debug!("got authentication start request with unknown attribute type handle: {attr_type_handle}");
                return Err(api::ErrorCode::UnknownAttributeType);
            }
        }

        Ok(attr_types)
    }

    async fn handle_auth_start_yivi(
        app: Rc<Self>,
        attr_types: Vec<attr::Type>,
        state: AuthState,
    ) -> api::Result<api::auths::AuthStartResp> {
        let yivi = app.get_yivi()?;

        // Create ConDisCon for our attributes
        let mut cdc: servers::yivi::AttributeConDisCon = Default::default(); // empty

        for attr_ty in attr_types.iter() {
            let mut dc: Vec<Vec<servers::yivi::AttributeRequest>> = Default::default();

            for source in attr_ty.sources.iter() {
                let attr_type_id: yivi::AttributeTypeIdentifier = match source {
                    attr::SourceDetails::Yivi { attr_type_id } => attr_type_id.clone(),
                    #[expect(unreachable_patterns)]
                    _ => continue,
                };

                dc.push(vec![servers::yivi::AttributeRequest { ty: attr_type_id }]);
            }

            if dc.is_empty() {
                log::debug!("got yivi authentication start request for {attr_ty}, but yivi is not supported for this attribute type");
                return Err(api::ErrorCode::MissingAttributeSource);
            }

            cdc.push(dc);
        }

        let disclosure_request: jwt::JWT = servers::yivi::SessionRequest::disclosure(cdc)
            .sign(&yivi.requestor_creds)
            .into_ec(|err| {
                log::error!("failed to create signed disclosure request: {err}");

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
        let req: api::auths::AuthCompleteReq = req.into_inner();

        let state: AuthState = AuthState::unseal(&req.state, &app.auth_state_secret)?;

        if state.exp < jwt::NumericDate::now() {
            return Err(api::ErrorCode::Expired);
        }

        let attr_types = app
            .attr_types_from_handles(&state.attr_types)
            .map_err(|err| {
                log::error!("unexpected error: {err}");
                api::ErrorCode::InternalError
            })?;

        match state.source {
            attr::Source::Yivi => {
                Self::handle_auth_complete_yivi(
                    app,
                    attr_types,
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
        _app: Rc<Self>,
        _attr_types: Vec<attr::Type>,
        _state: AuthState,
        _disclosure: jwt::JWT,
    ) -> api::Result<api::auths::AuthCompleteResp> {
        todo! {}
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

        let xconf = &config.auths.as_ref().unwrap().extra;

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
