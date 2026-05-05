//! Hub endpoints
use std::rc::Rc;

use actix_web::web;

use crate::api::ApiResultExt as _;
use crate::api::OpenError;
use crate::api::{self, NoPayload};

use super::server::*;
use api::phc::hub::*;

impl App {
    pub(super) async fn handle_hub_ticket(
        app: Rc<Self>,
        signed_req: web::Json<api::Signed<TicketReq>>,
    ) -> api::Result<TicketResp> {
        let signed_req = signed_req.into_inner();

        let req = signed_req
            .clone()
            .open_without_checking_signature()
            .map_err(|oe| {
                log::debug!("received invalid ticket request: {oe}");

                match oe {
                    OpenError::OtherConstellation(..)
                    | OpenError::InternalError
                    | OpenError::InvalidSignature => api::ErrorCode::InternalError,
                    OpenError::OtherwiseInvalid | OpenError::Expired => api::ErrorCode::BadRequest,
                }
            })?;

        let Some(hub) = app.hubs.get(&req.handle) else {
            return Ok(TicketResp::UnknownHub);
        };

        let resp = app
            .client
            .query::<api::hub::InfoEP>(&hub.url, NoPayload)
            .await
            .into_server_result()?;

        let Some(verifying_key) = resp.verifying_key else {
            return Ok(TicketResp::NoVerifyingKey);
        };

        // check that the request indeed came from the hub
        signed_req.open(&*verifying_key, None).map_err(|oe| {
            log::warn!(
                "could not verify authenticity of hub ticket request for hub {}: {oe}",
                req.handle,
            );

            match oe {
                OpenError::OtherConstellation(..) | OpenError::InternalError => {
                    api::ErrorCode::InternalError
                }
                OpenError::OtherwiseInvalid | OpenError::Expired | OpenError::InvalidSignature => {
                    api::ErrorCode::BadRequest
                }
            }
        })?;

        // if so, hand out ticket
        Ok(TicketResp::Success(api::Signed::new(
            &*app.jwt_key,
            &TicketContent {
                handle: req.handle,
                verifying_key,
            },
            std::time::Duration::from_secs(3600 * 24), /* = one day */
        )?))
    }

    /// Implements [`api::server::HubPingEP`].
    pub(super) async fn handle_hub_ping(
        app: Rc<Self>,
        signed_req: web::Json<TicketSigned<api::server::PingReq>>,
    ) -> api::Result<api::server::PingResp> {
        crate::servers::AppBase::<Server>::handle_hub_ping(app, signed_req).await
    }
}
