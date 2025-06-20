//! Hub endpoints
use std::rc::Rc;

use actix_web::web;

use crate::api::ApiResultExt as _;
use crate::api::{self, NoPayload};
use crate::handle;
use crate::phcrypto;

use super::server::*;
use api::phc::hub::*;

impl App {
    pub(super) async fn handle_hub_ticket(
        app: Rc<Self>,
        signed_req: web::Json<api::Signed<TicketReq>>,
    ) -> api::Result<api::Signed<TicketContent>> {
        let signed_req = signed_req.into_inner();

        let req = signed_req.clone().open_without_checking_signature()?;

        let hub = app
            .hubs
            .get(&req.handle)
            .ok_or(api::ErrorCode::UnknownHub)?;

        let resp = app
            .client
            .query::<api::hub::Info>(&hub.url, NoPayload)
            .await
            .into_server_result()?;

        // check that the request indeed came from the hub
        signed_req
            .old_open(&*resp.verifying_key)
            .inspect_err(|ec| {
                log::warn!(
                    "could not verify authenticity of hub ticket request for hub {}: {ec}",
                    req.handle,
                )
            })?;

        // if so, hand out ticket
        api::Signed::new(
            &*app.jwt_key,
            &TicketContent {
                handle: req.handle,
                verifying_key: resp.verifying_key,
            },
            std::time::Duration::from_secs(3600 * 24), /* = one day */
        )
    }

    pub(super) async fn handle_hub_key(
        app: Rc<Self>,
        signed_req: web::Json<TicketSigned<api::phct::hub::KeyReq>>,
    ) -> api::Result<api::phct::hub::KeyResp> {
        let running_state = &app.running_state_or_please_retry()?;

        let ts_req = signed_req.into_inner();

        let ticket_digest = phcrypto::TicketDigest::new(&ts_req.ticket);

        let (_, _): (api::phct::hub::KeyReq, handle::Handle) =
            ts_req.open(&app.jwt_key.verifying_key())?;

        // At this point we can be confident that the ticket is authentic, so we can give the hub
        // its decryption key based on the provided ticket

        let key_part: curve25519_dalek::Scalar = phcrypto::phc_hub_key_part(
            ticket_digest,
            &running_state.t_ss, // shared secret with transcryptor
            &app.master_enc_key_part,
        );

        Ok(api::phct::hub::KeyResp { key_part })
    }
}
