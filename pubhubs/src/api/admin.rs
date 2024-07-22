//! `.ph/admin/...` endpoints
use crate::api::*;
use serde::{Deserialize, Serialize};

/// Changes the [crate::servers::Config], and restarts the server.
///
/// The request is verified using the [crate::servers::Config::admin_key].
pub struct PostConfig {}
impl EndpointDetails for PostConfig {
    type RequestType = Signed<PostConfigReq>;
    type ResponseType = ();

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/admin/config";
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PostConfigReq {
    /// JSON Pointer (see RFC6901) to the part of the configuration that is to be changed
    pointer: String,

    new_value: serde_json::Value,
}

having_message_code!(PostConfigReq, AdminPostConfigReq);
