use aead::{Aead as _, AeadCore as _, KeyInit as _};
use anyhow::Context as _;
use base64ct::{Base64Url, Encoding as _};
use chacha20poly1305::XChaCha20Poly1305;
use rand::Rng as _;
use sha2::Digest as _;

/// Generates a random 22 character alphanumeric string (`[a-zA-Z0-9]{22}`),
/// having > 128 bits of randomness.
pub fn random_alphanumeric() -> String {
    rand::rngs::OsRng
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(22)
        .map(char::from)
        .collect()
}

/// Encodes and encrypts the given obj with additional associated data (or b"" if none)
/// and returns it as urlsafe base64 string.  Use [unseal] to revert.
pub fn seal<T: serde::Serialize>(
    obj: &T,
    key: &chacha20poly1305::Key,
    aad: impl AsRef<[u8]>,
) -> anyhow::Result<String> {
    let plaintext = serde_json::to_vec(obj).context("serializing")?;

    let nonce = XChaCha20Poly1305::generate_nonce(&mut aead::OsRng);
    let ciphertext = XChaCha20Poly1305::new(key)
        .encrypt(
            &nonce,
            aead::Payload {
                msg: plaintext.as_slice(),
                aad: aad.as_ref(),
            },
        )
        .map_err(|e| anyhow::anyhow!(e))
        .context("encrypting")?;

    let mut buf = Vec::with_capacity(nonce.len() + ciphertext.len());
    buf.extend_from_slice(&nonce);
    buf.extend_from_slice(&ciphertext);

    Ok(Base64Url::encode_string(&buf))
}

/// Reverse of the [seal] operation.
pub fn unseal<T: serde::de::DeserializeOwned>(
    envelope: impl AsRef<str>,
    key: &chacha20poly1305::Key,
    aad: impl AsRef<[u8]>,
) -> Result<T, crate::error::Opaque> {
    let buf = Base64Url::decode_vec(envelope.as_ref()).map_err(|_| crate::error::OPAQUE)?;

    #[allow(dead_code)] // buf[..NONCE_LEN] is not considered usage - a bug?
    const NONCE_LEN: usize = chacha20poly1305::XNonce::LENGTH;

    if buf.len() < NONCE_LEN {
        return Err(crate::error::OPAQUE);
    }

    let plaintext = XChaCha20Poly1305::new(key)
        .decrypt(
            (&buf[..NONCE_LEN]).into(),
            aead::Payload {
                msg: &buf[NONCE_LEN..],
                aad: aad.as_ref(),
            },
        )
        .map_err(|_| crate::error::OPAQUE)?;

    serde_json::from_slice(&plaintext).map_err(|_| crate::error::OPAQUE)
}

/// Trait to extract the length from a GenericArray
pub trait GenericArrayExt {
    const LENGTH: usize;
}

impl<T, U: generic_array::ArrayLength<T>> GenericArrayExt for generic_array::GenericArray<T, U> {
    const LENGTH: usize = <U as typenum::marker_traits::Unsigned>::USIZE;
}
