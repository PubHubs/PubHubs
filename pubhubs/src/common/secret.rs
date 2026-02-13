use curve25519_dalek::Scalar;

/// Secret bytes to derive secrets from via a hash
pub trait DigestibleSecret {
    fn as_bytes(&self) -> &[u8];

    /// Inserts this secret in the given digest
    fn update_digest<D: sha2::digest::Digest>(&self, d: D, domain: impl AsRef<str>) -> D {
        let domain: &str = domain.as_ref();
        let bytes: &[u8] = self.as_bytes();

        // NOTE: we include the lengths to prevent collisions
        d.chain_update(encode_usize(domain.len()))
            .chain_update(domain)
            .chain_update(encode_usize(bytes.len()))
            .chain_update(bytes)
    }

    /// Creates a [`Scalar`] from this secret
    fn derive_scalar<D>(&self, d: D, domain: impl AsRef<str>) -> Scalar
    where
        D: sha2::digest::Digest<OutputSize = typenum::U64>,
    {
        Scalar::from_hash(self.update_digest(d, domain))
    }

    /// Creates [`Vec<u8>`] from this secret.
    fn derive_bytes<D>(&self, d: D, domain: impl AsRef<str>) -> Vec<u8>
    where
        D: sha2::digest::Digest,
    {
        // This code has an unnecessary copy to more loosely couple to the generic_array package.
        self.update_digest(d, domain)
            .finalize()
            .as_slice()
            .to_owned()
    }

    /// Creates an [`Id`] from this secret.
    ///
    /// [`Id`]: crate::id::Id
    fn derive_id<D>(&self, d: D, domain: impl AsRef<str>) -> crate::id::Id
    where
        D: sha2::digest::Digest<OutputSize = typenum::U32>,
    {
        let bytes: [u8; 32] = self.derive_bytes(d, domain).try_into().unwrap();

        bytes.into()
    }

    /// Creates a [`HS256`] from this secret.
    ///
    /// [`HS256`]: crate::misc::jwt::HS256
    fn derive_hs256<D>(&self, d: D, domain: impl AsRef<str>) -> crate::misc::jwt::HS256
    where
        D: sha2::digest::Digest,
    {
        crate::misc::jwt::HS256(self.derive_bytes(d, domain))
    }

    /// Creates a (256-bit) [`crate::misc::crypto::SealingKey`] from this secret.
    fn derive_sealing_key<D>(
        &self,
        d: D,
        domain: impl AsRef<str>,
    ) -> crate::misc::crypto::SealingKey
    where
        D: sha2::digest::Digest<OutputSize = typenum::U32>,
    {
        self.update_digest(d, domain).finalize()
    }
}

impl DigestibleSecret for &[u8] {
    fn as_bytes(&self) -> &[u8] {
        self
    }
}

/// Encodes an usize in a platform independent manner, as `u64` using big-endian byte order.
pub const fn encode_usize(size: usize) -> [u8; 8] {
    if size_of::<usize>() > 8 {
        panic!("can not (yet) deal with usize of size > 8")
    }
    (size as u64).to_be_bytes()
}
