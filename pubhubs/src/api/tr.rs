//! Additional endpoints provided by the Transcryptor

use crate::api::*;

use actix_web::http;
use serde::{Deserialize, Serialize};

use crate::id;

/// Requests an [`sso::EncryptedHubPseudonymPackage`].
pub struct EhppEP {}
impl EndpointDetails for EhppEP {
    type RequestType = EhppReq;
    type ResponseType = Result<EhppResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/ehpp";
}

/// Request type of [`EhppEP`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[serde(rename = "snake_case")]
pub struct EhppReq {
    /// What [`sso::EncryptedHubPseudonymPackage::hub_nonce`] to use.
    pub hub_nonce: hub::EnterNonce,

    /// Requests a pseudonym for this hub.  
    /// (Hub ids can be obtained via [`phc::user::WelcomeEP`].)
    pub hub: id::Id,

    /// The polymorphic pseudonym from which to create the hub pseudonym.
    /// Can be obtained from [`phc::user::PppEP`].
    pub ppp: Sealed<sso::PolymorphicPseudonymPackage>,

    /// Per-session key from [`hub::EnterStartResp::hub_mac_key`], relayed by the global client; when
    /// present the transcryptor returns [`sso::EncryptedHubPseudonymPackage::hub_id_mac`] binding
    /// [`Self::hub`].  `None` for hubs predating the check.
    ///
    /// TODO: remove once all hubs are >3.4.0.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hub_mac_key: Option<hub::HubMacKey>,
}

/// Returned by [`EhppEP`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[serde(rename = "snake_case")]
#[must_use]
pub enum EhppResp {
    RetryWithNewPpp,

    /// The requested encrypted hub pseudonym package
    Success(Sealed<sso::EncryptedHubPseudonymPackage>),
}

/// Used by a hub to have push notifications delivered to its users' devices.
///
/// Each [`Push::blob`] is what the app put in the hub's Matrix pusher: the device's push token or
/// endpoint, encrypted for PHC.  The transcryptor relays the blobs to PHC (see
/// [`phc::push::SendEP`]), so that PHC, which can read them, doesn't learn which hub they come
/// from, while the hub, which knows who it pushes to, can't read them.  Together this stops hubs
/// from linking their users by push token, and PHC from learning which hubs a device is on.
///
/// Only hubs may push: the request is a [`phc::hub::TicketSigned`].  The transcryptor uses the hub
/// it learns from the ticket only to rate limit, per hub and per blob, and doesn't pass it on.
pub struct PushEP {}
impl EndpointDetails for PushEP {
    type RequestType = phc::hub::TicketSigned<PushReq>;
    type ResponseType = Result<PushResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/push";
}

/// At most this many pushes per [`PushReq`] (Synapse sends one).
pub const MAX_PUSHES_PER_REQ: usize = 16;

/// At most this many bytes per [`Push::blob`] (they're a few hundred).
pub const MAX_PUSH_BLOB_LEN: usize = 4096;

/// Request type of [`PushEP`].
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct PushReq {
    pub pushes: Vec<Push>,
}

having_message_code!(PushReq, TranscryptorPushReq);

/// One push, see [`PushEP`].
///
/// There's no priority: every push is sent urgent, since Synapse's priority says something about
/// the message.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Push {
    /// The blob from the Matrix pusher's data, as is (base64url).
    pub blob: String,
}

/// Returned by [`PushEP`].
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum PushResp {
    Success(PushResult),

    /// The ticket is not (or no longer) valid: get a new one from PHC, and try again.
    RetryWithNewTicket,

    /// This hub sent too many pushes recently: try again later.
    TooManyPushes,
}

/// What happened to each [`Push`], by index.  Pushes that are not mentioned were delivered, or
/// dropped because that blob was pushed to too often recently.
#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct PushResult {
    /// These blobs will never work again (unreadable, or the device token is no longer valid):
    /// the hub should delete their pushers.
    #[serde(default)]
    pub rejected: Vec<usize>,

    /// These could not be delivered now, but may later.
    #[serde(default)]
    pub failed: Vec<usize>,
}
