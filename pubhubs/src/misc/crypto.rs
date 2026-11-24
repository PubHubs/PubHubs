use aead::{Aead as _, Generate as _, KeyInit as _};
use anyhow::Context as _;
use base64ct::{Base64Url, Encoding as _};
use chacha20poly1305::XChaCha20Poly1305;
use rand::TryRng as _;

/// Key used by [`seal`] and co.
///
// TODO: nice-to-have: make SealingKey zeroize::Zeroize.  Now possible: chacha20poly1305 v0.11 moved
// to hybrid-array, whose `Array` is Zeroize when its element type is - it just needs hybrid-array's
// `zeroize` feature turned on.
pub type SealingKey = chacha20poly1305::Key;

/// Generates a random 22 character alphanumeric string (`[a-zA-Z0-9]{22}`),
/// having > 128 bits of randomness.
pub fn random_alphanumeric() -> String {
    use rand::RngExt as _;

    rand::rand_core::UnwrapErr(rand::rngs::SysRng)
        .sample_iter(&rand::distr::Alphanumeric)
        .take(22)
        .map(char::from)
        .collect()
}

pub fn random_32_bytes() -> [u8; 32] {
    random_bytes()
}

/// Wide enough to be reduced into a uniformly random [`curve25519_dalek::Scalar`] or
/// [`curve25519_dalek::RistrettoPoint`] without bias; see `common::elgamal`.
pub fn random_64_bytes() -> [u8; 64] {
    random_bytes()
}

fn random_bytes<const N: usize>() -> [u8; N] {
    let mut bytes: [u8; N] = [0; N];

    rand::rngs::SysRng::try_fill_bytes(&mut rand::rngs::SysRng, bytes.as_mut_slice()).unwrap();

    bytes
}

/// Like [`seal`], but returns an urlsafe base64 encoded string.
/// and returns it as urlsafe base64 string.  Use [`url_unseal`] to revert.
pub fn url_seal<T: serde::Serialize>(
    obj: &T,
    key: &SealingKey,
    aad: impl AsRef<[u8]>,
) -> anyhow::Result<String> {
    let buf: Vec<u8> = seal(obj, key, aad)?;

    Ok(Base64Url::encode_string(&buf))
}

/// Reverse of the [`url_seal`] operation.
pub fn url_unseal<T: serde::de::DeserializeOwned>(
    envelope: impl AsRef<str>,
    key: &chacha20poly1305::Key,
    aad: impl AsRef<[u8]>,
) -> Result<T, crate::misc::error::Opaque> {
    let buf = Base64Url::decode_vec(envelope.as_ref())?;

    unseal(&buf, key, aad)
}

/// Encodes and encrypts the given `obj` with additional associated data (or `b""` if `None`).
/// Use [`unseal`] to revert.
///
/// Uses a non self-describing encoding format for `T`, so [`seal`] is not suitable for long-lived
/// data that might change.
pub fn seal<T: serde::Serialize>(
    obj: &T,
    key: &SealingKey,
    aad: impl AsRef<[u8]>,
) -> anyhow::Result<Vec<u8>> {
    let plaintext = postcard::to_stdvec(obj).context("serializing")?;

    // NOTE: generally it's a bad idea to permit an unlimited amount of initialization vectors for
    // the same AEAD key, but we use XChaCha20Poly1305, a variant of ChaCha20Poly1305 specifically
    // made for this exact use case.
    let nonce = aead::Nonce::<XChaCha20Poly1305>::generate();
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

    Ok(buf)
}

/// Reverse of the [`seal`] operation.
pub fn unseal<T: serde::de::DeserializeOwned>(
    envelope: impl AsRef<[u8]>,
    key: &SealingKey,
    aad: impl AsRef<[u8]>,
) -> Result<T, crate::misc::error::Opaque> {
    let nonce_len: usize = size_of::<chacha20poly1305::XNonce>();
    let envelope = envelope.as_ref();

    if envelope.len() < nonce_len {
        log::debug!("unseal: envelope does not contain nonce");
        return Err(crate::misc::error::OPAQUE);
    }

    // NOTE: infallible - we just checked the length, and `Array` has no padding.
    let nonce: &chacha20poly1305::XNonce = envelope[..nonce_len]
        .try_into()
        .expect("nonce slice of the correct length");

    let plaintext = XChaCha20Poly1305::new(key)
        .decrypt(
            nonce,
            aead::Payload {
                msg: &envelope[nonce_len..],
                aad: aad.as_ref(),
            },
        )
        .map_err(|err| {
            log::debug!("unseal: decrypting: {err}");
            crate::misc::error::OPAQUE
        })?;

    postcard::from_bytes(&plaintext).map_err(|err| {
        log::debug!("unseal: decoding: {err}");
        crate::misc::error::OPAQUE
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Sealed by the `aead` v0.5 / `chacha20poly1305` v0.10 version of [`seal`], to pin the
    /// envelope format (`nonce || ciphertext`) across dependency bumps.  Sealed data outlives a
    /// release, so this must keep unsealing.
    const PINNED_SEALED: &str =
        "GM71akKn6Pked-X642S2vP70zv9FioTJeni4r6U44xVDfT0IRcxoe12NcpDjCm9e0cuS6UzgK7c=";

    fn pinned_key() -> SealingKey {
        [7u8; 32].into()
    }

    #[test]
    fn unseal_pinned() {
        let obj: (u32, String) = url_unseal(PINNED_SEALED, &pinned_key(), b"test-aad").unwrap();

        assert_eq!(obj, (1234, "hello pubhubs".to_string()));
    }

    #[test]
    fn seal_unseal_roundtrip() {
        let key = pinned_key();
        let obj: (u32, String) = (1234, "hello pubhubs".to_string());

        let sealed = url_seal(&obj, &key, b"test-aad").unwrap();

        assert_eq!(
            url_unseal::<(u32, String)>(&sealed, &key, b"test-aad").unwrap(),
            obj
        );
    }

    #[test]
    fn unseal_rejects_wrong_aad_and_key() {
        assert!(url_unseal::<(u32, String)>(PINNED_SEALED, &pinned_key(), b"other-aad").is_err());
        assert!(
            url_unseal::<(u32, String)>(PINNED_SEALED, &[8u8; 32].into(), b"test-aad").is_err()
        );
    }

    #[test]
    fn unseal_rejects_envelope_shorter_than_nonce() {
        let short = Base64Url::encode_string(&[0u8; 8]);

        assert!(url_unseal::<(u32, String)>(short, &pinned_key(), b"").is_err());
    }
}
