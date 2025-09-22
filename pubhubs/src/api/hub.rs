//! Endpoints provided by a hub
use actix_web::http;
use serde::{Deserialize, Serialize};

use crate::api::*;
use crate::misc::serde_ext::bytes_wrapper::B64UU;

/// Basic information advertised by the hub
pub struct InfoEP {}
impl EndpointDetails for InfoEP {
    type RequestType = NoPayload;
    type ResponseType = Result<InfoResp>;

    const METHOD: http::Method = http::Method::GET;
    const PATH: &'static str = ".ph/info";
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub struct InfoResp {
    /// Key used by the hub to sign requests to the other hubs with
    ///
    /// (Not currently returned by actual hubs.)
    pub verifying_key: VerifyingKey,

    /// String describing the hub version, likely the result of `git describe --tags`
    pub hub_version: String,

    /// URL to this hub's client
    pub hub_client_url: url::Url,
}

/// Endpoint that start the authentication of a (not yet existing) user
pub struct EnterStartEP {}
impl EndpointDetails for EnterStartEP {
    type RequestType = NoPayload;
    type ResponseType = Result<EnterStartResp>;

    const METHOD: http::Method = http::Method::POST; // to dissuade caching
    const PATH: &'static str = ".ph/enter-start";
}

/// What's returned by [`EnterStartEP`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub struct EnterStartResp {
    /// Opaque state that needs to be send to the [`EnterCompleteEP`] later on
    pub state: EnterState,

    /// Opaque number used only once to be included in the hub pseudonym package.
    pub nonce: EnterNonce,
}

/// Type of [`EnterStartResp::state`]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(transparent)]
pub struct EnterState {
    pub(crate) inner: B64UU,
}

impl From<B64UU> for EnterState {
    fn from(inner: B64UU) -> Self {
        Self { inner }
    }
}

/// Type of [`EnterStartResp::nonce`]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(transparent)]
pub struct EnterNonce {
    pub(crate) inner: B64UU,
}
impl From<B64UU> for EnterNonce {
    fn from(inner: B64UU) -> Self {
        Self { inner }
    }
}

/// Endpoint to complete user authentication
pub struct EnterCompleteEP {}
impl EndpointDetails for EnterCompleteEP {
    type RequestType = EnterCompleteReq;
    type ResponseType = Result<EnterCompleteResp>;

    const METHOD: http::Method = http::Method::POST; // to dissuade caching
    const PATH: &'static str = ".ph/enter-complete";
}

/// What's sent to [`EnterCompleteEP`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct EnterCompleteReq {
    /// The one you got from [`EnterStartResp::state`]
    pub state: EnterState,

    /// The hashed hub pseudonym package obtained from pubhubs central.
    /// Should include the [`EnterStartResp::nonce`] belonging to the [`Self::state`].
    pub hhpp: Signed<sso::HashedHubPseudonymPackage>,
}

/// What's returned by [`EnterCompleteEP`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum EnterCompleteResp {
    /// Start again at [`EnterStartEP`]
    RetryFromStart,

    Entered {
        /// Synapse access token
        access_token: String,

        /// Device ID.  (Not sure if it's useful to the global client, though.)
        device_id: String,

        /// True if this is the first time this user enters this hub.
        new_user: bool,

        /// Matrix id to use in combination with the [`Self::Entered::access_token`] to log in.
        mxid: String,
    },
}
