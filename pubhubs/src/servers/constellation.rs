//! Details on the constellation of PubHubs servers

use crate::api;
use crate::elgamal;
use crate::servers;

/// Public details on the constellation of PubHubs servers.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct Constellation {
    pub transcryptor_url: url::Url,
    pub transcryptor_jwt_key: api::VerifyingKey,
    pub transcryptor_enc_key: elgamal::PublicKey,
    /// `x_T B` - so the transcryptor can check that the correct keypart was used
    pub transcryptor_master_enc_key_part: elgamal::PublicKey,

    pub phc_url: url::Url,
    pub phc_jwt_key: api::VerifyingKey,
    pub phc_enc_key: elgamal::PublicKey,

    pub auths_url: url::Url,
    pub auths_jwt_key: api::VerifyingKey,
    pub auths_enc_key: elgamal::PublicKey,

    /// `x_T x_PHC B`
    pub master_enc_key: elgamal::PublicKey,
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
