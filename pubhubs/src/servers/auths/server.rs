//! Authentication server core code
use std::collections::HashMap;
use std::ops::{Deref, DerefMut};
use std::rc::Rc;

use actix_web::web;
use digest::Digest as _;

use crate::servers::{
    self, AppBase, AppCreatorBase, Constellation, Handle, Server as _, constellation, yivi,
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
    phc_ss: elgamal::SharedSecret,

    /// Key used to sign [`Attr`]s, shared with pubhubs central.
    ///
    /// [`Attr`]: attr::Attr
    attr_signing_key: jwt::HS256,

    /// key used to seal messages to PHC
    phc_sealing_secret: crypto::SealingKey,
}

/// Authentication server per-thread [`App`] that handles incoming requests.
pub struct App {
    base: AppBase<Server>,
    attribute_types: map::Map<attr::Type>,
    yivi: Option<YiviCtx>,
    auth_state_secret: crypto::SealingKey,
    auth_window: core::time::Duration,
    attr_key_secret: Vec<u8>,
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
    requestor_url: url::Url,
    requestor_creds: yivi::Credentials<yivi::SigningKey>,
    server_creds: yivi::Credentials<yivi::VerifyingKey>,
}

/// # Helper functions
impl App {
    fn get_yivi(&self) -> Result<&YiviCtx, api::ErrorCode> {
        self.yivi.as_ref().ok_or_else(|| {
            log::debug!("yivi requested, but not configured");
            api::ErrorCode::BadRequest
        })
    }

    /// Get [`attr::Type`] by [`handle::Handle`], returning [`None`]
    /// when it cannot be found.
    fn attr_type_from_handle<'s>(
        &'s self,
        attr_type_handle: &handle::Handle,
    ) -> Option<&'s attr::Type> {
        self.attribute_types.get(attr_type_handle)
    }
}

/// Plaintext content of [`api::auths::AuthState`].
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct AuthState {
    source: attr::Source,
    attr_types: Vec<handle::Handle>,
    wait_for_card: bool,

    /// When this request expires
    exp: api::NumericDate,
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

    fn unseal(sealed: &api::auths::AuthState, key: &crypto::SealingKey) -> Option<AuthState> {
        let Ok(state) = crypto::unseal(&*sealed.inner, key, b"") else {
            log::debug!("failed to unseal AuthState");
            return None;
        };

        Some(state)
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
            wait_for_card: req.wait_for_card,
            exp: api::NumericDate::now() + app.auth_window,
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
        let running_state = app.running_state_or_please_retry()?;

        // Create ConDisCon for our attributes
        let mut cdc: servers::yivi::AttributeConDisCon = Default::default(); // empty

        for attr_ty_handle in state.attr_types.iter() {
            let Some(attr_ty) = app.attr_type_from_handle(attr_ty_handle) else {
                return Ok(api::auths::AuthStartResp::UnknownAttrType(
                    attr_ty_handle.clone(),
                ));
            };

            let dc: Vec<Vec<servers::yivi::AttributeRequest>> = attr_ty
                .yivi_attr_type_ids()
                .map(|attr_type_id| {
                    vec![servers::yivi::AttributeRequest {
                        ty: attr_type_id.clone(),
                    }]
                })
                .collect();

            if dc.is_empty() {
                log::debug!(
                    "{}: got yivi authentication start request for {attr_ty}, but yivi is not supported for this attribute type",
                    Server::NAME
                );
                return Ok(api::auths::AuthStartResp::SourceNotAvailableFor(
                    attr_ty_handle.clone(),
                ));
            }

            cdc.push(dc);
        }

        let disclosure_request: jwt::JWT = {
            let mut dr = servers::yivi::ExtendedSessionRequest::disclosure(cdc);

            if state.wait_for_card {
                let state = api::phc::user::WaitForCardState {
                    server_creds: yivi.server_creds.clone(),
                };

                let state =
                    api::Sealed::new(&state, &running_state.phc_sealing_secret).map_err(|err| {
                        log::error!(
                            "{}: failed to seal wait-for-card state: {err}",
                            Server::NAME
                        );
                        api::ErrorCode::InternalError
                    })?;

                let query = serde_urlencoded::to_string(api::phc::user::WaitForCardQuery { state })
                    .map_err(|err| {
                        log::error!(
                            "{}: failed to url-encode sealed wait-for-card state: {err}",
                            Server::NAME
                        );
                        api::ErrorCode::InternalError
                    })?;

                let mut url: url::Url = running_state
                    .constellation
                    .phc_url
                    .join(api::phc::user::YIVI_WAIT_FOR_CARD_PATH)
                    .map_err(|err| {
                        log::error!(
                            "{}: failed to compute PHC's yivi next session url: {err}",
                            Server::NAME
                        );
                        api::ErrorCode::InternalError
                    })?;

                url.set_query(Some(&query));

                dr = dr.next_session(url);
            }

            dr.sign(&yivi.requestor_creds).into_ec(|err| {
                log::error!(
                    "{}: failed to create signed disclosure request: {err}",
                    Server::NAME
                );

                api::ErrorCode::InternalError
            })?
        };

        Ok(api::auths::AuthStartResp::Success {
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
        app.running_state_or_please_retry()?;

        let req: api::auths::AuthCompleteReq = req.into_inner();

        let Some(state) = AuthState::unseal(&req.state, &app.auth_state_secret) else {
            return Ok(api::auths::AuthCompleteResp::PleaseRestartAuth);
        };

        if state.exp < api::NumericDate::now() {
            return Ok(api::auths::AuthCompleteResp::PleaseRestartAuth);
        }

        match state.source {
            attr::Source::Yivi => {
                Self::handle_auth_complete_yivi(
                    app,
                    state,
                    match req.proof {
                        api::auths::AuthProof::Yivi { disclosure } => disclosure,
                        #[expect(unreachable_patterns)]
                        _ => return Err(api::ErrorCode::BadRequest),
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
                log::debug!("invalid yivi signed session result submitted: {err:#}",);
                api::ErrorCode::BadRequest
            })?;

        let yivi_result_jwt_id = disclosure.id();

        let mut attrs: HashMap<handle::Handle, api::Signed<attr::Attr>> =
            HashMap::with_capacity(state.attr_types.len());

        let running_state = app.running_state_or_internal_error()?;

        for (i, result) in ssr
            .validate_and_extract_raw_singles()
            .map_err(|err| {
                log::debug!("invalid session result submitted: {err}");
                api::ErrorCode::BadRequest
            })?
            .enumerate()
        {
            let (yati, raw_value): (&yivi::AttributeTypeIdentifier, &str) =
                result.map_err(|err| {
                    log::debug!(
                        "problem with attribute number {i} of submitted session result: {err}",
                    );
                    api::ErrorCode::BadRequest
                })?;

            let attr_type_handle: &handle::Handle = state.attr_types.get(i).ok_or_else(|| {
                log::debug!("extra attributes disclosed in submitted session result",);
                api::ErrorCode::BadRequest
            })?;

            let Some(attr_type) = app.attr_type_from_handle(attr_type_handle) else {
                log::warn!(
                    "Attribute type with handle {attr_type_handle} mentioned in authentication state can no longer be found."
                );
                return Ok(api::auths::AuthCompleteResp::PleaseRestartAuth);
            };

            if !attr_type
                .yivi_attr_type_ids()
                .any(|allowed_yati| allowed_yati == yati)
            {
                log::debug!(
                    "attribute number {i} of submitted session result has unexpected attribute type id {yati}"
                );
                return Err(api::ErrorCode::BadRequest);
            }

            // Disclosure for attribute is OK.

            let old_value = attrs.insert(
                attr_type_handle.clone(),
                // TODO: attr_signing_key is constellation-dependent;  provide a mechanism
                // for the client to detect constellation change
                api::Signed::<attr::Attr>::new(
                    &running_state.attr_signing_key,
                    &attr::Attr {
                        attr_type: attr_type.id,
                        value: raw_value.to_string(),
                        bannable: attr_type.bannable,
                        identifying: attr_type.identifying,
                    },
                    app.auth_window,
                )?,
            );

            if old_value.is_some() {
                log::error!("expected to have already erred on duplicate attribute types");
                return Err(api::ErrorCode::InternalError);
            }
        }

        Ok(api::auths::AuthCompleteResp::Success {
            attrs,
            yivi_result_jwt_id: {
                if state.wait_for_card {
                    Some(yivi_result_jwt_id)
                } else {
                    None
                }
            },
        })
    }

    /// Implements [`api::auths::WelcomeEP`].
    fn cached_handle_welcome(app: &Self) -> api::Result<api::auths::WelcomeResp> {
        let attr_types: HashMap<handle::Handle, attr::Type> = app
            .attribute_types
            .values()
            .map(|attr_type| (attr_type.handles.preferred().clone(), attr_type.clone()))
            .collect();

        Ok(api::auths::WelcomeResp { attr_types })
    }

    /// Implements [`api::auths::AttrKeysEP`].
    async fn handle_attr_keys(
        app: Rc<Self>,
        reqs: web::Json<HashMap<handle::Handle, api::auths::AttrKeyReq>>,
    ) -> api::Result<api::auths::AttrKeysResp> {
        let running_state = &app.running_state_or_please_retry()?;

        let reqs = reqs.into_inner();

        let mut resp: HashMap<handle::Handle, api::auths::AttrKeyResp> =
            HashMap::with_capacity(reqs.len());

        let now = api::NumericDate::now();

        for (handle, req) in reqs.into_iter() {
            let attr: attr::Attr = match req
                .attr
                .open(&running_state.attr_signing_key, None) // TODO: constellation 
                {
                    Err(api::OpenError::OtherConstellation(..))
                            | Err(api::OpenError::InvalidSignature)
                            | Err(api::OpenError::Expired) => {
                        return Ok(api::auths::AttrKeysResp::RetryWithNewAttr(handle));
                            }
                    Err(api::OpenError::OtherwiseInvalid) => {
                        return Err(api::ErrorCode::BadRequest);
                    }
                    Err(api::OpenError::InternalError) => {
                        return Err(api::ErrorCode::InternalError);
                    }
                    Ok(attr) => attr
                };

            if !attr.identifying {
                log::debug!(
                    "attribute key denied for non-identifying attribute {value} of type {attr_type}",
                    value = attr.value,
                    attr_type = attr.attr_type
                );
                return Err(api::ErrorCode::BadRequest);
            }

            let timestamps: Vec<api::NumericDate> = if let Some(timestamp) = req.timestamp {
                if timestamp > now {
                    log::warn!(
                        "future attribute key requested for attribute {value} of type {attr_type}",
                        value = attr.value,
                        attr_type = attr.attr_type
                    );
                    return Err(api::ErrorCode::BadRequest);
                }

                vec![timestamp, now]
            } else {
                vec![now]
            };

            let mut attr_keys: Vec<Vec<u8>> =
                phcrypto::auths_attr_keys(attr, app.attr_key_secret.as_slice(), timestamps);

            let latest_key: Vec<u8> = attr_keys.pop().unwrap();
            let old_key: Option<Vec<u8>> = attr_keys.pop();

            assert!(attr_keys.is_empty());

            resp.insert(
                handle.clone(),
                api::auths::AttrKeyResp {
                    latest_key: (serde_bytes::ByteBuf::from(latest_key).into(), now),
                    old_key: old_key.map(|old_key| serde_bytes::ByteBuf::from(old_key).into()),
                },
            )
            .map_or(Ok(()), |_| {
                log::debug!("double handle in attribute keys request: {handle}");
                Err(api::ErrorCode::BadRequest)
            })?;
        }

        Ok(api::auths::AttrKeysResp::Success(resp))
    }
}

impl crate::servers::App<Server> for App {
    fn configure_actix_app(self: &Rc<Self>, sc: &mut web::ServiceConfig) {
        api::auths::WelcomeEP::caching_add_to(self, sc, App::cached_handle_welcome);

        api::auths::AuthStartEP::add_to(self, sc, App::handle_auth_start);
        api::auths::AuthCompleteEP::add_to(self, sc, App::handle_auth_complete);

        api::auths::AttrKeysEP::add_to(self, sc, App::handle_attr_keys);
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

        Ok(Self {
            base,
            attribute_types,
            yivi,
            auth_state_secret,
            auth_window,
            attr_key_secret,
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
        }
    }
}
