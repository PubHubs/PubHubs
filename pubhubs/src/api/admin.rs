//! `.ph/admin/...` endpoints
use crate::api::*;
use serde::{Deserialize, Serialize};

/// Changes the [crate::servers::Config] **in memory**, and restarts the server service.
/// The configuration file remains unchanged, so when the binary restarts, the changes
/// are lost.  This endpoint is used for testing, and can also be useful for debugging.
///
/// The request is verified using the [crate::servers::config::ServerConfig::admin_key].
pub struct UpdateConfig {}
impl EndpointDetails for UpdateConfig {
    type RequestType = Signed<UpdateConfigReq>;
    type ResponseType = UpdateConfigResp;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/admin/update-config";
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateConfigReq {
    /// JSON Pointer (see RFC6901) to the part of the configuration that is to be changed
    ///
    /// Example: "/transcryptor/enc_key"
    pub pointer: String,

    pub new_value: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateConfigResp {}

having_message_code!(UpdateConfigReq, AdminUpdateConfigReq);

/// Retrieves sensitive details (like the [crate::servers::Config]) from this server.
///
/// The request is verified using the [crate::servers::config::ServerConfig::admin_key].
///
/// NB Cannot be a GET request because the request needs to be signed.
pub struct Info {}
impl EndpointDetails for Info {
    type RequestType = Signed<InfoReq>;
    type ResponseType = InfoResp;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/admin/info";
}

#[derive(Serialize, Deserialize, Debug)]
pub struct InfoReq {}

having_message_code!(InfoReq, AdminInfoReq);
#[derive(Serialize, Deserialize, Debug)]
pub struct InfoResp {
    /// Current server configuration
    pub config: crate::servers::Config,
}
