//! Endpoints provided by a hub
use serde::{Deserialize, Serialize};

use crate::api::*;

/// Basic information advertised by the hub
pub struct Info {}
impl EndpointDetails for Info {
    type RequestType = ();
    type ResponseType = InfoResp;

    const METHOD: http::Method = http::Method::GET;
    const PATH: &'static str = ""; // the base url contains the path
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct InfoResp {
    /// Key used by the hub to sign requests to the other hubs with
    pub verifying_key: VerifyingKey,

    /// String describing the hub version, likely the result of `git describe --tags`
    pub hub_version: String,
}
