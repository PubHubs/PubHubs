//! Implementation of the [`api::auths::AuthStartEP`] and [`api::auths::AuthCompleteEP`] endpoints.
use super::server::*;

use std::collections::HashMap;
use std::rc::Rc;

use actix_web::web;

use crate::servers::{self, yivi, Server as _};
use crate::{
    api::{self, ResultExt as _},
    attr, handle,
    misc::jwt,
};

/// # Implementaton of endpoints
impl App {
    pub async fn handle_auth_start(
        app: Rc<Self>,
        req: web::Json<api::auths::AuthStartReq>,
    ) -> api::Result<api::auths::AuthStartResp> {
        let state = AuthState {
            source: req.source,
            attr_types: req.attr_types.clone(),
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
            let dr = servers::yivi::ExtendedSessionRequest::disclosure(cdc);

            //            if state.wait_for_card {
            //                let state = api::phc::user::WaitForCardState {
            //                    server_creds: yivi.server_creds.clone(),
            //                };
            //
            //                let state =
            //                    api::Sealed::new(&state, &running_state.phc_sealing_secret).map_err(|err| {
            //                        log::error!(
            //                            "{}: failed to seal wait-for-card state: {err}",
            //                            Server::NAME
            //                        );
            //                        api::ErrorCode::InternalError
            //                    })?;
            //
            //                let query = serde_urlencoded::to_string(api::phc::user::WaitForCardQuery { state })
            //                    .map_err(|err| {
            //                        log::error!(
            //                            "{}: failed to url-encode sealed wait-for-card state: {err}",
            //                            Server::NAME
            //                        );
            //                        api::ErrorCode::InternalError
            //                    })?;
            //
            //                let mut url: url::Url = running_state
            //                    .constellation
            //                    .phc_url
            //                    .join(api::phc::user::YIVI_WAIT_FOR_CARD_PATH)
            //                    .map_err(|err| {
            //                        log::error!(
            //                            "{}: failed to compute PHC's yivi next session url: {err}",
            //                            Server::NAME
            //                        );
            //                        api::ErrorCode::InternalError
            //                    })?;
            //
            //                url.set_query(Some(&query));
            //
            //                dr = dr.next_session(url);
            //            }

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

    pub async fn handle_auth_complete(
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

        Ok(api::auths::AuthCompleteResp::Success { attrs })
    }
}
