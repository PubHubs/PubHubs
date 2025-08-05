use serde::{Deserialize, Serialize};

use crate::api::*;
use crate::elgamal;

pub struct DiscoveryInfo {}
impl EndpointDetails for DiscoveryInfo {
    type RequestType = NoPayload;
    type ResponseType = Result<DiscoveryInfoResp>;

    const METHOD: http::Method = http::Method::GET;
    const PATH: &'static str = ".ph/discovery/info";
}

pub struct DiscoveryRun {}
impl EndpointDetails for DiscoveryRun {
    type RequestType = NoPayload;
    type ResponseType = Result<DiscoveryRunResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/discovery/run";
}

/// What's returned by the `.ph/discovery/info` endpoint
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub struct DiscoveryInfoResp {
    pub name: crate::servers::Name,

    /// Random string used by a server to check that it has contact with itself.
    pub self_check_code: String,

    /// The version of this server (based on git tags).
    ///
    /// `None` if not available for some reason
    pub version: Option<String>,

    /// URL of the PubHubs Central server this server tries to connect to.
    pub phc_url: url::Url,

    /// Used to sign JWTs from this server.
    pub jwt_key: VerifyingKey,

    /// Used to encrypt messages to this server, and to create shared secrets with this server
    /// using Diffie-Hellman
    pub enc_key: elgamal::PublicKey,

    /// Master encryption key part, that is, `x_PHC B` or `x_T B` in the notation of the
    /// whitepaper.  Only set for PHC or the transcryptor.
    pub master_enc_key_part: Option<elgamal::PublicKey>,

    /// Details of the other PubHubs servers, according to this server
    /// `None` when discovery has not been completed.
    pub constellation: Option<crate::servers::Constellation>,
}

/// Result of the `.ph/discovery/run` endpoint
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum DiscoveryRunResp {
    /// Everything checks out at our side
    UpToDate,
    /// Changes were made and we're restarting now. It'd probably be good to check our discovery
    /// info again in a moment.
    Restarting,
}
