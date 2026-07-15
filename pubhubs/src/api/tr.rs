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
