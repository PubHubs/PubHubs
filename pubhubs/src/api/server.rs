//! Endpoints served by every PubHubs server (PHC, Transcryptor, Authentication Server)
//! aside from the ones in [`crate::api::discovery`].
//!
//! Currently only [`HubPingEP`], a worked example of an endpoint that requires the caller
//! to authenticate as a hub via a [`phc::hub::TicketSigned`] request.  The shared handler
//! body lives at [`crate::servers::AppBase::handle_hub_ping`]; each server has its own
//! `handle_hub_ping` method that delegates there.  Programmers adding a similar endpoint
//! can look at [`phc::hub::TicketOpenError::default_verdict`] for the standard mapping
//! from a [`phc::hub::TicketOpenError`] to a response or [`ErrorCode`].

use crate::api::*;
use crate::handle;
use crate::misc::serde_ext::bytes_wrapper::B64UU;

use actix_web::http;
use serde::{Deserialize, Serialize};

/// Demo health-check endpoint that requires the caller to authenticate as a hub via
/// [`phc::hub::TicketSigned`].
pub struct HubPingEP {}
impl EndpointDetails for HubPingEP {
    type RequestType = phc::hub::TicketSigned<PingReq>;
    type ResponseType = Result<PingResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/hub/ping";
}

/// Request type of [`HubPingEP`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct PingReq {
    /// Echoed back as [`PingResp::Success::nonce`].
    pub nonce: B64UU,
}

having_message_code!(PingReq, HubPing);

/// Returned by [`HubPingEP`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum PingResp {
    Success {
        /// Hub handle taken from the [`phc::hub::Ticket`].
        hub_handle: handle::Handle,

        /// Echo of [`PingReq::nonce`].
        nonce: B64UU,

        /// Identifies which server answered.
        served_by: crate::servers::Name,
    },

    /// Ticket signature was invalid or expired.  Obtain a new ticket and retry.
    RetryWithNewTicket,
}
