//! Details on the constellation of PubHubs servers

use std::ops::Deref;

use sha2::digest::Digest;

use crate::api;
use crate::common::{elgamal, kem, secret};
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
// NOTE: When adding a new field to the constellation make sure it has a default value in the first
// version so that when the new version of PHC contacts the old versions of the transcryptor and
// the authentication server, PHC will not crash on missing fields at the transcryptor and the
// authentication server.
//
// (The converse is not necessary:  when an outdated authentication server and transcryptor
// are running discovery against a freshly updated PHC, PHC's constellation will not be set
// and will thus not cause the transcryptor or authentication server to crash.)
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct Inner {
    pub transcryptor_url: url::Url,

    /// Deprecated ed25519 jwt key, kept for wire compatibility; see [`api::DeprecatedJwtKey`].
    /// Superseded by [`transcryptor_verifying_key`](Self::transcryptor_verifying_key).
    #[serde(default)]
    pub transcryptor_jwt_key: api::DeprecatedJwtKey,

    /// The transcryptor's hybrid post-quantum verifying key, used to verify its JWTs and signatures.
    /// Only `None` in v3.3.0 and earlier; drop the `Option` once those versions are out of rotation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcryptor_verifying_key: Option<api::VerifyingKeyBytes>,

    /// Formerly the transcryptor's ElGamal encryption key, now superseded by the post-quantum KEM
    /// (see [`transcryptor_ss_encap`]).  A placeholder zero pubkey for now; the `Option` lets a
    /// future version omit it.
    ///
    /// TODO: remove this field entirely once v3.3.0 and earlier (which require it) are out of
    /// rotation.
    ///
    /// [`transcryptor_ss_encap`]: Self::transcryptor_ss_encap
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcryptor_enc_key: Option<elgamal::PublicKey>,

    /// Formerly `x_T B` (the transcryptor's master encryption key part), so the transcryptor could
    /// check that the correct keypart was used; now a placeholder zero pubkey, superseded by
    /// [`transcryptor_master_enc_key_part_hash`].  The `Option` lets a future version omit it.
    ///
    /// TODO: remove this field entirely once v3.3.0 and earlier (which require it) are out of
    /// rotation.
    ///
    /// [`transcryptor_master_enc_key_part_hash`]: Self::transcryptor_master_enc_key_part_hash
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcryptor_master_enc_key_part: Option<elgamal::PublicKey>,

    /// Hash of the transcryptor's master encryption key part `x_T B`, so the transcryptor can check
    /// that the correct keypart was used without `x_T B` being exposed in the clear.
    /// Only `None` in v3.3.0 and earlier; drop the `Option` once those versions are out of rotation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcryptor_master_enc_key_part_hash: Option<id::Id>,

    /// [`kem::EncapKeyBytes::id`] of the transcryptor's encapsulation key.
    /// Only `None` in v3.3.0 and earlier; drop the `Option` once those versions are out of rotation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcryptor_encap_key_id: Option<id::Id>,

    /// Shared secret PHC encapsulated against the transcryptor's encap key.
    /// Only `None` in v3.3.0 and earlier; drop the `Option` once those versions are out of rotation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcryptor_ss_encap: Option<kem::CiphertextBytes>,

    pub phc_url: url::Url,

    /// PHC's ed25519 public key, hex-encoded.  Unlike the other (now placeholder) `*_jwt_key`
    /// fields, this still carries a *real* key — the `ed` half of
    /// [`phc_verifying_key`](Self::phc_verifying_key) — so hubs predating the hybrid migration can
    /// verify the classical EdDSA HHPP.
    #[serde(default)]
    pub phc_jwt_key: api::Ed25519VerifyingKeyHex,

    /// PHC's hybrid post-quantum verifying key, used to verify its JWTs and signatures.
    /// Only `None` in v3.3.0 and earlier; drop the `Option` once those versions are out of rotation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phc_verifying_key: Option<api::VerifyingKeyBytes>,

    /// Formerly PHC's ElGamal encryption key; placeholder zero pubkey, see [`transcryptor_enc_key`].
    ///
    /// TODO: remove this field entirely once v3.3.0 and earlier (which require it) are out of
    /// rotation.
    ///
    /// [`transcryptor_enc_key`]: Self::transcryptor_enc_key
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phc_enc_key: Option<elgamal::PublicKey>,

    /// Hash of PHC's master encryption key part `x_PHC B`.  Published so that a change of PHC's
    /// part churns the constellation id (the real master key is held off-wire by PHC).
    /// Only `None` in v3.3.0 and earlier; drop the `Option` once those versions are out of rotation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phc_master_enc_key_part_hash: Option<id::Id>,

    pub auths_url: url::Url,

    /// Deprecated ed25519 jwt key, kept for wire compatibility; see [`api::DeprecatedJwtKey`].
    /// Superseded by [`auths_verifying_key`](Self::auths_verifying_key).
    #[serde(default)]
    pub auths_jwt_key: api::DeprecatedJwtKey,

    /// The authentication server's hybrid post-quantum verifying key, used to verify its JWTs and
    /// signatures.  Only `None` in v3.3.0 and earlier; drop the `Option` once those versions are out
    /// of rotation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auths_verifying_key: Option<api::VerifyingKeyBytes>,

    /// Formerly the authentication server's ElGamal encryption key; placeholder zero pubkey, see
    /// [`transcryptor_enc_key`].
    ///
    /// TODO: remove this field entirely once v3.3.0 and earlier (which require it) are out of
    /// rotation.
    ///
    /// [`transcryptor_enc_key`]: Self::transcryptor_enc_key
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auths_enc_key: Option<elgamal::PublicKey>,

    /// [`kem::EncapKeyBytes::id`] of the authentication server's encapsulation key.
    /// Only `None` in v3.3.0 and earlier; drop the `Option` once those versions are out of rotation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auths_encap_key_id: Option<id::Id>,

    /// Shared secret PHC encapsulated against the authentication server's encap key.
    /// Only `None` in v3.3.0 and earlier; drop the `Option` once those versions are out of rotation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auths_ss_encap: Option<kem::CiphertextBytes>,

    /// Formerly the public master encryption key `x_T x_PHC B`; now a placeholder zero pubkey kept
    /// off the public wire (PHC holds the real value in its running state, derived from the
    /// transcryptor's sealed master key part).  The `Option` lets a future version omit it.
    ///
    /// TODO: remove this field entirely once v3.3.0 and earlier (which require it) are out of
    /// rotation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub master_enc_key: Option<elgamal::PublicKey>,

    pub global_client_url: url::Url,

    /// pubhubs version
    pub ph_version: Option<String>,
}

/// Extension methods on [`sha2::Sha256`] used by [`Inner::sha256`] to give the constellation an
/// unambiguous byte encoding before hashing.
trait DigestExt: Sized {
    /// Length-prefix (8-byte big-endian, platform-independent) a variable-length field.
    fn chain_varlen(self, bytes: &[u8]) -> Self;

    /// A 1/0 presence byte, followed by the length-prefixed bytes when present.
    fn chain_opt(self, bytes: Option<&[u8]>) -> Self;

    /// A 1/0 presence byte, followed by both length-prefixed ciphertext halves when present.
    fn chain_opt_ct(self, ct: Option<&kem::CiphertextBytes>) -> Self;

    /// A 1/0 presence byte, followed by both length-prefixed halves (ed25519 ‖ ML-DSA) of a hybrid
    /// verifying key when present.
    fn chain_opt_vk(self, vk: Option<&api::VerifyingKeyBytes>) -> Self;
}

impl DigestExt for sha2::Sha256 {
    fn chain_varlen(self, bytes: &[u8]) -> Self {
        self.chain_update(secret::encode_usize(bytes.len()))
            .chain_update(bytes)
    }

    fn chain_opt(self, bytes: Option<&[u8]>) -> Self {
        match bytes {
            Some(bytes) => self.chain_update([1u8]).chain_varlen(bytes),
            None => self.chain_update([0u8]),
        }
    }

    fn chain_opt_ct(self, ct: Option<&kem::CiphertextBytes>) -> Self {
        match ct {
            Some(ct) => self
                .chain_update([1u8])
                .chain_varlen(ct.ml.as_ref())
                .chain_varlen(ct.ec.as_ref()),
            None => self.chain_update([0u8]),
        }
    }

    fn chain_opt_vk(self, vk: Option<&api::VerifyingKeyBytes>) -> Self {
        match vk {
            Some(vk) => self
                .chain_update([1u8])
                .chain_varlen(vk.ed.as_ref())
                .chain_varlen(vk.ml.as_ref()),
            None => self.chain_update([0u8]),
        }
    }
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
            transcryptor_verifying_key,
            transcryptor_master_enc_key_part_hash,
            transcryptor_encap_key_id,
            transcryptor_ss_encap,

            phc_url,
            phc_verifying_key,
            phc_master_enc_key_part_hash,

            auths_url,
            auths_verifying_key,
            auths_encap_key_id,
            auths_ss_encap,

            global_client_url,

            ph_version,

            // deprecated - will soon be removed
            transcryptor_jwt_key: _,
            phc_jwt_key: _,
            auths_jwt_key: _,
            transcryptor_enc_key: _,
            transcryptor_master_enc_key_part: _,
            phc_enc_key: _,
            auths_enc_key: _,
            master_enc_key: _,
        } = self;

        // NOTE: it would be easier to serialize self using, say, serde_json, and then hash that,
        // but it's not evident whether serializing the same constellation twice will give the same
        // string.
        //
        // Framing (see `DigestExt`): fixed-length fields (32-byte id hashes) are hashed directly;
        // variable-length fields are length-prefixed (`chain_varlen`); optional fields — including
        // the hybrid verifying keys (`chain_opt_vk`) — get a 1/0 presence byte
        // (`chain_opt`/`chain_opt_ct`/`chain_opt_vk`).  So a variable field's bytes can't be borrowed
        // by an adjacent field, and an absent field is not read as an empty one.

        sha2::Sha256::new()
            // Hash-format version - BUMP THIS on any change to the framing or fields below, so the
            // change always alters the constellation id.  (Only PHC computes the id; peers compare.)
            // v2: jwt keys became hybrid post-quantum (ed25519 ‖ ML-DSA); the ed25519 `*_jwt_key`
            // fields are deprecated placeholders, no longer hashed.
            .chain_update(2u16.to_be_bytes())
            .chain_varlen(transcryptor_url.as_str().as_bytes())
            .chain_opt_vk(transcryptor_verifying_key.as_ref())
            .chain_opt(
                transcryptor_master_enc_key_part_hash
                    .as_ref()
                    .map(id::Id::as_slice),
            )
            .chain_opt(transcryptor_encap_key_id.as_ref().map(id::Id::as_slice))
            .chain_opt_ct(transcryptor_ss_encap.as_ref())
            .chain_varlen(phc_url.as_str().as_bytes())
            .chain_opt_vk(phc_verifying_key.as_ref())
            .chain_opt(phc_master_enc_key_part_hash.as_ref().map(id::Id::as_slice))
            .chain_varlen(auths_url.as_str().as_bytes())
            .chain_opt_vk(auths_verifying_key.as_ref())
            .chain_opt(auths_encap_key_id.as_ref().map(id::Id::as_slice))
            .chain_opt_ct(auths_ss_encap.as_ref())
            .chain_varlen(global_client_url.as_str().as_bytes())
            .chain_opt(ph_version.as_ref().map(|v| v.as_bytes()))
    }

    pub fn derive_id(&self) -> id::Id {
        phcrypto::constellation_id(self)
    }
}

/// A full [`Constellation`], or just the [`id::Id`].
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(untagged)]
pub enum ConstellationOrId {
    Constellation(Box<Constellation>),
    Id { id: id::Id },
}

impl ConstellationOrId {
    /// Returns the [`Constellation`], if any.
    pub fn constellation(&self) -> Option<&Constellation> {
        if let Self::Constellation(c) = self {
            return Some(c);
        }
        None
    }

    /// Returns underlying [`Constellation`], if any.
    pub fn into_constellation(self) -> Option<Constellation> {
        if let Self::Constellation(c) = self {
            return Some(*c);
        }
        None
    }

    /// Returns the [`id::Id`]
    pub fn id(&self) -> &id::Id {
        match self {
            Self::Constellation(c) => &c.id,
            Self::Id { id } => id,
        }
    }
}
