use curve25519_dalek::Scalar;

/// Secret bytes to derive secrets from via a hash
pub trait DigestibleSecret {
    fn as_bytes(&self) -> &[u8];

    /// Inserts this shared secret in the given digest
    fn update_digest<D: digest::Digest>(&self, d: D, domain: impl AsRef<str>) -> D {
        let domain: &str = domain.as_ref();
        let bytes: &[u8] = self.as_bytes();

        // NOTE: we include the lengths to prevent collisions
        d.chain_update(encode_usize(domain.len()))
            .chain_update(domain)
            .chain_update(encode_usize(bytes.len()))
            .chain_update(bytes)
    }

    /// Creates a [`Scalar`] from this shared secret
    fn derive_scalar<D>(&self, d: D, domain: impl AsRef<str>) -> Scalar
    where
        D: digest::Digest<OutputSize = typenum::U64>,
    {
        Scalar::from_hash(self.update_digest(d, domain))
    }

    /// Creates `Vec<u8>` from this shared secret
    fn derive_bytes<D>(&self, d: D, domain: impl AsRef<str>) -> Vec<u8>
    where
        D: digest::Digest,
    {
        // This code has an unnecessary copy to more loosely couple to the generic_array package.
        self.update_digest(d, domain)
            .finalize()
            .as_slice()
            .to_owned()
    }
}

/// Encodes an usize in a platform independent manner, as `u64` using big-endian byte order.
pub const fn encode_usize(size: usize) -> [u8; 8] {
    if size_of::<usize>() > 8 {
        panic!("can not (yet) deal with usize of size > 8")
    }
    (size as u64).to_be_bytes()
}
