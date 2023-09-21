//! Details on the constellation of PubHubs servers

use crate::common::serde_ext;

/// Public details on the constellation of PubHubs servers.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Constellation {
    pub transcryptor_jwt_key: serde_ext::B16<ed25519_dalek::VerifyingKey>,
    pub transcryptor_url: url::Url,
    pub phc_jwt_key: serde_ext::B16<ed25519_dalek::VerifyingKey>,
    pub phc_url: url::Url,
}
