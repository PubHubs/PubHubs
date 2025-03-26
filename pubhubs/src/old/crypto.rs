//! Basic crypto utilities.
use digest::Digest as _;

/// Returns `sha256(concerns +  '\0' + secret)`.
///
/// NB. `concerns` should not contain '\0'.  Of course, we should have added `concerns`' length
///     to the hash instead of using the '\0'-separator, but changing this now will break
///     existing configuration.
/// ```
/// use pubhubs::crypto::derive_secret;
///
/// assert_eq!(
///     derive_secret("testing", b"master secret").as_slice(),
///     &base16ct::lower::decode_vec(
///         "f6cafeb6ff59b41614111c0f96edfb013a969d8c74f7f6494ec079d5db1031f9").unwrap(),
/// );
/// ```
///
/// ```should_panic
/// pubhubs::crypto::derive_secret("sneakily adding \0 to achieve some", b"nefarious purpose");
/// ```
pub fn derive_secret(
    concerns: &str,
    secret: &[u8],
) -> generic_array::GenericArray<u8, typenum::consts::U32> {
    assert!(!concerns.contains('\0'));

    sha2::Sha256::new()
        .chain_update(concerns.as_bytes())
        .chain_update(b"\0")
        .chain_update(secret)
        .finalize()
}
