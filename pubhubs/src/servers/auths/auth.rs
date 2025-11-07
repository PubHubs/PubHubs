//! Implementation of the [`api::auths::AuthStartEP`] and [`api::auths::AuthCompleteEP`] endpoints.
use super::server::*;

use std::collections::HashMap;
use std::rc::Rc;

use actix_web::web;
use indexmap::IndexMap;

use crate::servers::{self, yivi};
use crate::{
    api::{self, ResultExt as _},
    attr, handle,
    misc::jwt,
};

/// # Implementaton of endpoints
impl App {
    /// Implements [`api::auths::AuthStartEP`]
    pub async fn handle_auth_start(
        app: Rc<Self>,
        req: web::Json<api::auths::AuthStartReq>,
    ) -> api::Result<api::auths::AuthStartResp> {
        let req = req.into_inner();

        if req.yivi_chained_session && req.source != attr::Source::Yivi {
            log::debug!("yivi_chained_session set on non-yivi authentication request");
            return Err(api::ErrorCode::BadRequest);
        }

        if !req.attr_type_choices.is_empty() && !req.attr_types.is_empty() {
            log::debug!("both attr_types and attr_type_choices set on AuthStartReq");
            return Err(api::ErrorCode::BadRequest);
        }

        let attr_type_choices = if req.attr_type_choices.is_empty() {
            req.attr_types.into_iter().map(|at| vec![at]).collect()
        } else {
            req.attr_type_choices
        };

        let state = AuthState {
            source: req.source,
            attr_type_choices,
            exp: api::NumericDate::now() + app.auth_window,
            yivi_chained_session_id: None,
            yivi_ati2at: Default::default(),
        };

        match req.source {
            attr::Source::Yivi => {
                Self::handle_auth_start_yivi(app, state, req.yivi_chained_session).await
            }
        }
    }

    /// Creates a disclosure 'conjunction' for the given yivi attribute type identifier.
    ///
    /// This is almost always just the attibute type idenfitier itself, unless we're dealing with
    /// the pubhubs card - in which case two other factors are added that fixes the registration
    /// source, and allows the user to see the 'comment' attached to the card (usually the
    /// redacted email address and phone number.)
    ///
    /// The yivi attribute type that will provide the actual value for the pubhubs attribute
    /// will always come first.  This is important because
    /// [`yivi::SessionResult::validate_and_extract_raw_singles`] will only pick the first value
    /// from each inner conjunction.
    fn create_disclosure_con_for(
        &self,
        attr_type_id: &servers::yivi::AttributeTypeIdentifier,
    ) -> api::Result<Vec<servers::yivi::AttributeRequest>> {
        let yivi = self.get_yivi()?;

        let mut result = vec![servers::yivi::AttributeRequest {
            ty: attr_type_id.clone(),
            value: None,
        }];

        let credential = yivi.card_config.card_type.credential();

        if !attr_type_id.as_str().starts_with(credential) {
            return Ok(result);
        }

        let registration_date = yivi.card_config.card_type.date();

        result.push(servers::yivi::AttributeRequest {
            ty: format!("{credential}.{registration_date}")
                .parse()
                .map_err(|err| {
                    log::error!("failed to form registration date yivi attribute: {err:?}");
                    api::ErrorCode::InternalError
                })?,
            value: None,
        });

        let registration_source = yivi.card_config.card_type.source();

        result.push(servers::yivi::AttributeRequest {
            ty: format!("{credential}.{registration_source}")
                .parse()
                .map_err(|err| {
                    log::error!("failed to form registration source yivi attribute: {err:?}");
                    api::ErrorCode::InternalError
                })?,
            value: Some(self.registration_source(yivi).to_owned()),
        });

        Ok(result)
    }

    async fn handle_auth_start_yivi(
        app: Rc<Self>,
        mut state: AuthState,
        yivi_chained_session: bool,
    ) -> api::Result<api::auths::AuthStartResp> {
        let yivi = app.get_yivi()?;

        let mut sealed_state: Option<api::auths::AuthState> = None;

        let seal_state = |state: &AuthState| -> api::Result<api::auths::AuthState> {
            state.seal(&app.auth_state_secret)
        };

        // Create ConDisCon for our attributes
        let mut cdc: servers::yivi::AttributeConDisCon = Default::default(); // empty

        for attr_ty_options in state.attr_type_choices.iter() {
            let mut dc: Vec<Vec<servers::yivi::AttributeRequest>> = Default::default();
            let mut ati2at: HashMap<yivi::AttributeTypeIdentifier, handle::Handle> =
                Default::default();

            for attr_ty_handle in attr_ty_options.iter() {
                let Some(attr_ty) = app.attr_type_from_handle(attr_ty_handle) else {
                    return Ok(api::auths::AuthStartResp::UnknownAttrType(
                        attr_ty_handle.clone(),
                    ));
                };

                let mut had_one: bool = false;

                for ati in attr_ty.yivi_attr_type_ids() {
                    if let Some(existing_at_handle) =
                        ati2at.insert(ati.clone(), attr_ty_handle.clone())
                    {
                        log::debug!("attribute types {existing_at_handle} and {attr_ty_handle} both rely on the same yivi attribute type identifier {ati}");
                        return Ok(api::auths::AuthStartResp::Conflict(
                            existing_at_handle,
                            attr_ty_handle.clone(),
                        ));
                    }

                    had_one = true;

                    dc.push(app.create_disclosure_con_for(ati)?);
                }

                if !had_one {
                    log::debug!(
                    "got yivi authentication start request for {attr_ty_handle}, but yivi is not supported for this attribute type",
                );
                    return Ok(api::auths::AuthStartResp::SourceNotAvailableFor(
                        attr_ty_handle.clone(),
                    ));
                }
            }

            state.yivi_ati2at.push(ati2at);
            cdc.push(dc);
        }

        let disclosure_request: jwt::JWT = {
            let mut dr = servers::yivi::ExtendedSessionRequest::disclosure(cdc);

            if yivi_chained_session {
                let csc = app.chained_sessions_ctl_or_bad_request()?;
                let running_state = app.running_state_or_internal_error()?;

                state.yivi_chained_session_id = Some(csc.create_session().await?);

                sealed_state = Some(seal_state(&state)?);

                let query = serde_urlencoded::to_string(api::auths::YiviNextSessionQuery {
                    state: sealed_state.as_ref().unwrap().clone(),
                })
                .map_err(|err| {
                    log::error!("failed to url-encode auth state: {err}",);
                    api::ErrorCode::InternalError
                })?;

                let mut url: url::Url = running_state
                    .constellation
                    .auths_url
                    .join(api::auths::YIVI_NEXT_SESSION_PATH)
                    .map_err(|err| {
                        log::error!(
                            "failed to compute authenticatio server's yivi next session url: {err}",
                        );
                        api::ErrorCode::InternalError
                    })?;

                url.set_query(Some(&query));

                dr = dr.next_session(url);
            }

            dr.sign(&yivi.requestor_creds).into_ec(|err| {
                log::error!("failed to create signed disclosure request: {err}",);
                api::ErrorCode::InternalError
            })?
        };

        if sealed_state.is_none() {
            sealed_state = Some(seal_state(&state)?);
        }

        Ok(api::auths::AuthStartResp::Success {
            task: api::auths::AuthTask::Yivi {
                disclosure_request,
                yivi_requestor_url: yivi.requestor_url.clone(),
            },
            state: sealed_state.unwrap(),
        })
    }

    pub async fn handle_auth_complete(
        app: Rc<Self>,
        req: web::Json<api::auths::AuthCompleteReq>,
    ) -> api::Result<api::auths::AuthCompleteResp> {
        app.running_state_or_please_retry()?;

        let req: api::auths::AuthCompleteReq = req.into_inner();

        let Some(state) = AuthState::unseal(&req.state, &app.auth_state_secret) else {
            return Ok(api::auths::AuthCompleteResp::PleaseRestartAuth);
        };

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

        let mut attrs: IndexMap<handle::Handle, api::Signed<attr::Attr>> =
            IndexMap::with_capacity(state.attr_type_choices.len());

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

            dbg!(&state);

            let Some(ati2at) = state.yivi_ati2at.get(i) else {
                // NOTE: debug! and BadRequest, and not warn! and InternalError,
                // because clients can swap result JWTs from different yivi sessions
                log::debug!("extra attributes disclosed in submitted session result");
                return Err(api::ErrorCode::BadRequest);
            };

            let Some(attr_type_handle) = ati2at.get(yati) else {
                log::debug!(
                    "got unexpected yivi attribute {yati} at position {i}; expected one of: {}",
                    ati2at
                        .values()
                        .map(handle::Handle::as_str)
                        .collect::<Vec<&str>>()
                        .join(", ")
                );
                return Err(api::ErrorCode::BadRequest);
            };

            let Some(attr_type) = app.attr_type_from_handle(attr_type_handle) else {
                log::warn!(
                    "Attribute type with handle {attr_type_handle} mentioned in authentication state can no longer be found."
                );
                return Ok(api::auths::AuthCompleteResp::PleaseRestartAuth);
            };

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
                        not_identifying: !attr_type.identifying,
                        not_addable: attr_type.not_addable_by_default,
                    },
                    app.auth_window,
                )?,
            );

            if old_value.is_some() {
                log::error!("expected to have already erred on duplicate attribute types");
                return Err(api::ErrorCode::InternalError);
            }
        }

        Ok(api::auths::AuthCompleteResp::Success { attrs })
    }
}
