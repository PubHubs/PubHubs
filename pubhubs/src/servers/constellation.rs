//! Details on the constellation of PubHubs servers

use std::ops::Deref;

use sha2::digest::Digest;

use crate::api;
use crate::common::{kem, secret};
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

    /// The transcryptor's hybrid post-quantum verifying key, used to verify its JWTs and signatures.
    pub transcryptor_verifying_key: api::VerifyingKeyBytes,

    /// Hash of the transcryptor's master encryption key part `x_T B`, so the transcryptor can check
    /// that the correct keypart was used without `x_T B` being exposed in the clear.
    pub transcryptor_master_enc_key_part_hash: id::Id,

    /// [`kem::EncapKeyBytes::id`] of the transcryptor's encapsulation key.
    pub transcryptor_encap_key_id: id::Id,

    /// Shared secret PHC encapsulated against the transcryptor's encap key.
    pub transcryptor_ss_encap: kem::CiphertextBytes,

    pub phc_url: url::Url,

    /// PHC's ed25519 public key (the `ed` half of [`phc_verifying_key`](Self::phc_verifying_key)),
    /// hex-encoded.  Kept on the wire so hubs predating the hybrid migration can verify the classical
    /// EdDSA HHPP; see [`api::Ed25519VerifyingKeyHex`].
    ///
    /// TODO: remove once all hubs are on >=v3.4.0 (see scripts/check-hubs.py).
    #[serde(default)]
    pub phc_jwt_key: api::Ed25519VerifyingKeyHex,

    /// PHC's hybrid post-quantum verifying key, used to verify its JWTs and signatures.
    pub phc_verifying_key: api::VerifyingKeyBytes,

    /// Hash of PHC's master encryption key part `x_PHC B`.  Published so that a change of PHC's
    /// part churns the constellation id (the real master key is held off-wire by PHC).
    pub phc_master_enc_key_part_hash: id::Id,

    pub auths_url: url::Url,

    /// The authentication server's hybrid post-quantum verifying key, used to verify its JWTs and
    /// signatures.
    pub auths_verifying_key: api::VerifyingKeyBytes,

    /// [`kem::EncapKeyBytes::id`] of the authentication server's encapsulation key.
    pub auths_encap_key_id: id::Id,

    /// Shared secret PHC encapsulated against the authentication server's encap key.
    pub auths_ss_encap: kem::CiphertextBytes,

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

    /// Both length-prefixed ciphertext halves (ML-KEM ‖ EC).
    fn chain_ct(self, ct: &kem::CiphertextBytes) -> Self;

    /// Both length-prefixed halves (ed25519 ‖ ML-DSA) of a hybrid verifying key.
    fn chain_vk(self, vk: &api::VerifyingKeyBytes) -> Self;
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

    fn chain_ct(self, ct: &kem::CiphertextBytes) -> Self {
        self.chain_varlen(ct.ml.as_ref())
            .chain_varlen(ct.ec.as_ref())
    }

    fn chain_vk(self, vk: &api::VerifyingKeyBytes) -> Self {
        self.chain_varlen(vk.ed.as_ref())
            .chain_varlen(vk.ml.as_ref())
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

            // not hashed: this is the `ed` half of `phc_verifying_key`, already covered above.
            phc_jwt_key: _,
        } = self;

        // NOTE: it would be easier to serialize self using, say, serde_json, and then hash that,
        // but it's not evident whether serializing the same constellation twice will give the same
        // string.
        //
        // Framing (see `DigestExt`): fixed-length fields (32-byte id hashes) are hashed directly;
        // variable-length fields, and the two halves of each hybrid verifying key / KEM ciphertext,
        // are length-prefixed (`chain_varlen`/`chain_vk`/`chain_ct`) so one field's bytes can't be
        // read as part of an adjacent one.  The only optional field is `ph_version` (`chain_opt`, a
        // 1/0 presence byte).

        sha2::Sha256::new()
            // Hash-format version - BUMP THIS on any change to the framing or fields below, so the
            // change always alters the constellation id.  (Only PHC computes the id; peers compare.)
            // v2: jwt keys became hybrid post-quantum (ed25519 ‖ ML-DSA).
            // v3: dropped the deprecated enc_key / master_enc_key / `*_jwt_key` placeholder fields,
            // and the verifying-key / KEM / master-key-part-hash fields are no longer optional.
            .chain_update(3u16.to_be_bytes())
            .chain_varlen(transcryptor_url.as_str().as_bytes())
            .chain_vk(transcryptor_verifying_key)
            .chain_update(transcryptor_master_enc_key_part_hash.as_slice())
            .chain_update(transcryptor_encap_key_id.as_slice())
            .chain_ct(transcryptor_ss_encap)
            .chain_varlen(phc_url.as_str().as_bytes())
            .chain_vk(phc_verifying_key)
            .chain_update(phc_master_enc_key_part_hash.as_slice())
            .chain_varlen(auths_url.as_str().as_bytes())
            .chain_vk(auths_verifying_key)
            .chain_update(auths_encap_key_id.as_slice())
            .chain_ct(auths_ss_encap)
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
