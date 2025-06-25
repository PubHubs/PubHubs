//! `.ph/admin/...` endpoints
use crate::api::*;
use serde::{Deserialize, Serialize};

/// Changes the [crate::servers::Config] **in memory**, and restarts the server service.
/// The configuration file remains unchanged, so when the binary restarts, the changes
/// are lost.  This endpoint is used for testing, and can also be useful for debugging.
///
/// The request is verified using the [crate::servers::config::ServerConfig::admin_key].
pub struct UpdateConfigEP {}
impl EndpointDetails for UpdateConfigEP {
    type RequestType = Signed<UpdateConfigReq>;
    type ResponseType = Result<UpdateConfigResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/admin/update-config";
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct UpdateConfigReq {
    /// JSON Pointer (see RFC6901) to the part of the configuration that is to be changed
    ///
    /// Example: "/transcryptor/enc_key"
    pub pointer: String,

    pub new_value: serde_json::Value,
}

/// Response type for [`UpdateConfigEP`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum UpdateConfigResp {
    /// Signature on request was expired; retry with a fresh one
    ResignRequest,

    /// Admin key is invalid
    InvalidAdminKey,

    /// Updating configuration succeeded
    Success,
}

having_message_code!(UpdateConfigReq, AdminUpdateConfigReq);

/// Retrieves sensitive details (like the [crate::servers::Config]) from this server.
///
/// The request is verified using the [crate::servers::config::ServerConfig::admin_key].
///
/// NB Cannot be a GET request because the request needs to be signed.
pub struct InfoEP {}
impl EndpointDetails for InfoEP {
    type RequestType = Signed<InfoReq>;
    type ResponseType = Result<InfoResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/admin/info";
}

/// Request type for [`InfoEP`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct InfoReq {}

having_message_code!(InfoReq, AdminInfoReq);

/// Response type for [`InfoEP`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum InfoResp {
    /// Signature on request was expired; retry with a fresh one
    ResignRequest,

    /// Admin key is invalid
    InvalidAdminKey,

    /// Request succeeded
    Success {
        /// Current server configuration
        config: Box<crate::servers::Config>,
    },
}
