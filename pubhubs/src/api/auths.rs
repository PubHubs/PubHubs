//! Additional endpoints provided by the authentication server
use crate::api::*;

use serde::{Deserialize, Serialize};

pub struct AuthStartEP {}
impl EndpointDetails for AuthStartEP {
    type RequestType = AuthStartReq;
    type ResponseType = AuthStartResp;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/auth/start";
}

/// Starts the process of obtaining attributes from the authentication server.
///
/// Results in `ErrorCode::BadRequest` if `attr_types` or if requested attribute types
/// have mixed sources.
///
/// Results in `ErrorCode::UnknownAttributeType` if one of the attribute types is not known.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AuthStartReq {
    /// List of requested attributes
    pub attr_types: Vec<crate::handle::Handle>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AuthStartResp {
    /// Task for the global client to satisfy the authentication server.
    /// Depends on the requested attribute types
    pub task: AuthTask,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum AuthTask {
    /// Have the end-user disclose to the sepcified yivi server.
    /// The authentication server only creates the signed (disclosure) session request,
    /// but it's up to the global client to send the send it to the yivi server.
    Yivi {
        disclosure_request_jwt: String,
        yivi_requestor_url: url::Url,
    },
}

/// After having completed the task set by the authentication server,
/// obtain the attributes.
pub struct AuthCompleteEP {}
impl EndpointDetails for AuthCompleteEP {
    type RequestType = AuthCompleteReq;
    type ResponseType = AuthCompleteResp;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/auth/complete";
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AuthCompleteReq {
    pub attr_types: Vec<crate::handle::Handle>,
    pub proof: AuthProof,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum AuthProof {
    Yivi { disclosure_response_jwt: String },
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AuthCompleteResp {
    attrs: Vec<Signed<crate::attr::Attr>>,
}
