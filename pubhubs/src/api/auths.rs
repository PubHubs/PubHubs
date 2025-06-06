//! Additional endpoints provided by the authentication server
use crate::api::*;
use crate::misc::jwt;
use crate::misc::serde_ext::bytes_wrapper::B64UU;
use crate::{attr, handle};

use serde::{Deserialize, Serialize};

/// Called by the global client to get, for example, the list of supported attribute types.
pub struct WelcomeEP {}
impl EndpointDetails for WelcomeEP {
    type RequestType = NoPayload;
    type ResponseType = Result<WelcomeResp>;

    const METHOD: http::Method = http::Method::GET;
    const PATH: &'static str = ".ph/welcome";
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct WelcomeResp {
    /// Available attribute types
    pub attr_types: std::collections::HashMap<handle::Handle, attr::Type>,
}

pub struct AuthStartEP {}
impl EndpointDetails for AuthStartEP {
    type RequestType = AuthStartReq;
    type ResponseType = Result<AuthStartResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/auth/start";
}

/// Starts the process of obtaining attributes from the authentication server.
///
/// Results in `ErrorCode::UnknownAttributeType` if one of the attribute types is not known.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct AuthStartReq {
    /// Which source to use (e.g. yivi)
    pub source: crate::attr::Source,

    /// List of requested attributes
    pub attr_types: Vec<crate::handle::Handle>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct AuthStartResp {
    /// Task for the global client to satisfy the authentication server.
    /// Depends on the requested attribute types
    pub task: AuthTask,

    /// Opaque state that should be sent with the [`AuthCompleteReq`].
    pub state: AuthState,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(transparent)]
pub struct AuthState {
    pub(crate) inner: B64UU,
}

impl AuthState {
    pub(crate) fn new(inner: serde_bytes::ByteBuf) -> Self {
        Self {
            inner: inner.into(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub enum AuthTask {
    /// Have the end-user disclose to the specified yivi server.
    /// The authentication server only creates the signed (disclosure) session request,
    /// but it's up to the global client to send it to the yivi server.
    Yivi {
        disclosure_request: jwt::JWT,
        yivi_requestor_url: url::Url,
    },
}

/// After having completed the task set by the authentication server,
/// obtain the attributes.
pub struct AuthCompleteEP {}
impl EndpointDetails for AuthCompleteEP {
    type RequestType = AuthCompleteReq;
    type ResponseType = Result<AuthCompleteResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/auth/complete";
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct AuthCompleteReq {
    /// Proof that the end-user possesses the requested attributes.
    pub proof: AuthProof,

    /// The [`AuthStartResp::state`] obtained earlier.
    pub state: AuthState,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub enum AuthProof {
    Yivi {
        /// The JWT returned by the yivi server's `/session/(...)/result-jwt` after completing a session
        /// with [`AuthTask::Yivi::disclosure_request`].
        disclosure: jwt::JWT,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct AuthCompleteResp {
    pub attrs: std::collections::HashMap<handle::Handle, Signed<attr::Attr>>,
}
