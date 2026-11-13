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

/// Requests one user's pseudonyms at several hubs at once, in random order, as an
/// [`sso::EncryptedHubPseudonymsPackage`].  Used by PHC when an account is deleted, see
/// [`phc::user::DeleteAccountEP`].
///
/// PHC needs those pseudonyms, but must not learn which hub each belongs to: PHC knows who the
/// user is, so that would tell it who is behind a pseudonym at a given hub.  Hence PHC does not
/// use [`EhppEP`] for this, which would have it name the hub of every pseudonym it gets.
///
/// This relies on PHC asking for many hubs at once; asking for one hub would tell it everything.
/// That PHC does not is part of the same trust in PHC as that it does not use [`EhppEP`] itself.
pub struct EhpsEP {}
impl EndpointDetails for EhpsEP {
    type RequestType = EhpsReq;
    type ResponseType = Result<EhpsResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/ehps";
}

/// Request type of [`EhpsEP`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct EhpsReq {
    /// Requests a pseudonym for each of these hubs.
    pub hubs: Vec<id::Id>,

    /// The polymorphic pseudonym from which to create the hub pseudonyms.
    pub ppp: Sealed<sso::PolymorphicPseudonymPackage>,
}

/// Returned by [`EhpsEP`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum EhpsResp {
    RetryWithNewPpp,

    /// The requested encrypted hub pseudonyms package
    Success(Sealed<sso::EncryptedHubPseudonymsPackage>),
}
