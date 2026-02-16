use aead::{Aead as _, AeadCore as _, KeyInit as _};
use anyhow::Context as _;
use base64ct::{Base64Url, Encoding as _};
use chacha20poly1305::XChaCha20Poly1305;
use rand::TryRng as _;

/// Key used by [`seal`] and co.
///
// TODO: nice-to-have: make SealingKey zeroize::Zeroize
// This will likely be possible when chacha20poly1305 move away from generic-array
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
    let mut bytes: [u8; 32] = [0; 32];

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
    let buf = Base64Url::decode_vec(envelope.as_ref()).map_err(|_| crate::misc::error::OPAQUE)?;

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

    Ok(buf)
}

/// Reverse of the [`seal`] operation.
pub fn unseal<T: serde::de::DeserializeOwned>(
    envelope: impl AsRef<[u8]>,
    key: &SealingKey,
    aad: impl AsRef<[u8]>,
) -> Result<T, crate::misc::error::Opaque> {
    let nonce_len: usize = chacha20poly1305::XNonce::len();
    let envelope = envelope.as_ref();

    if envelope.len() < nonce_len {
        log::debug!("unseal: envelope does not contain nonce");
        return Err(crate::misc::error::OPAQUE);
    }

    let plaintext = XChaCha20Poly1305::new(key)
        .decrypt(
            (&envelope[..nonce_len]).into(),
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

/// Implements the `generic_array` version `1.2`
/// [`len()`](https://docs.rs/generic-array/latest/generic_array/struct.GenericArray.html#method.len)
/// method for the older `generic_array` version currently(?) used by
/// rust crypto (e.g. [`aead`] and [`digest`]).
pub trait GenericArrayExt {
    fn len() -> usize;
}

impl<T, U: aead::generic_array::ArrayLength<T>> GenericArrayExt
    for aead::generic_array::GenericArray<T, U>
{
    fn len() -> usize {
        <U as typenum::marker_traits::Unsigned>::USIZE
    }
}
