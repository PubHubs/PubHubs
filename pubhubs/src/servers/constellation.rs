//! Details on the constellation of PubHubs servers

use std::ops::Deref;

use digest::Digest;

use crate::api;
use crate::elgamal;
use crate::id;
use crate::phcrypto;
use crate::servers;

/// Public details on the constellation of PubHubs servers (stored in the [`inner`] field)
/// paired with an derived [`id`].  [`Deref`]s to [`Inner`].
///
/// # Comparing constellations
///
/// [`Constellation`] does not implement [`PartialEq`], because there are two valid ways to compare
/// constellations `c1` and `c2`, namely `c1.id == c2.id` and `c1.inner == c2.inner`, and it should
/// be clear in the code which one is being used.
///
/// [`id`]: Constellation::id
/// [`inner`]: Constellation::inner
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Constellation {
    /// Identifier for this constellation derived from [`Inner`] using a hash.
    pub id: id::Id,

    /// When this constellation was first created by pubhubs central.  When two parties
    /// have different constellations, the party with the oldest constellation should
    /// update.
    pub created_at: api::NumericDate,

    #[serde(flatten)]
    pub inner: Inner,
}

impl Deref for Constellation {
    type Target = Inner;

    fn deref(&self) -> &Inner {
        &self.inner
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct Inner {
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

impl Inner {
    /// Returns the url of the named server
    pub fn url(&self, name: servers::Name) -> &url::Url {
        match name {
            servers::Name::PubhubsCentral => &self.phc_url,
            servers::Name::Transcryptor => &self.transcryptor_url,
            servers::Name::AuthenticationServer => &self.auths_url,
        }
    }

    /// Returns a [`sha2::Sha256`] hash of this constellation - used to compute [`Constellation::id`].
    pub(crate) fn sha256(&self) -> sha2::Sha256 {
        let Inner {
            transcryptor_url,
            transcryptor_jwt_key,
            transcryptor_enc_key,
            transcryptor_master_enc_key_part,

            phc_url,
            phc_jwt_key,
            phc_enc_key,

            auths_url,
            auths_jwt_key,
            auths_enc_key,

            master_enc_key,
        } = self;

        // NOTE: it would be easier to serialize self using, say, serde_json, and then hash that,
        // but it's not evident whether serializing the same constellation twice will give the same
        // string.

        sha2::Sha256::new()
            .chain_update(transcryptor_url.as_str())
            .chain_update(**transcryptor_jwt_key)
            .chain_update(transcryptor_enc_key)
            .chain_update(transcryptor_master_enc_key_part)
            .chain_update(phc_url.as_str())
            .chain_update(**phc_jwt_key)
            .chain_update(phc_enc_key)
            .chain_update(auths_url.as_str())
            .chain_update(**auths_jwt_key)
            .chain_update(auths_enc_key)
            .chain_update(master_enc_key)
    }

    pub fn derive_id(&self) -> id::Id {
        phcrypto::constellation_id(self)
    }
}
