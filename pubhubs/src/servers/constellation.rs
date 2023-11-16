//! Details on the constellation of PubHubs servers

use crate::api;
use crate::misc::serde_ext::bytes_wrapper;
use crate::servers;

/// Public details on the constellation of PubHubs servers.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct Constellation {
    pub transcryptor_jwt_key: api::VerifyingKey,
    pub transcryptor_url: url::Url,
    pub phc_jwt_key: api::VerifyingKey,
    pub phc_url: url::Url,
    pub auths_jwt_key: api::VerifyingKey,
    pub auths_url: url::Url,
}

impl Constellation {
    /// Returns the url of the named server
    pub fn url(&self, name: servers::Name) -> &url::Url {
        match name {
            servers::Name::PubhubsCentral => &self.phc_url,
            servers::Name::Transcryptor => &self.transcryptor_url,
            servers::Name::AuthenticationServer => &self.auths_url,
        }
    }
}
