use curve25519_dalek::Scalar;

/// Secret bytes to derive secrets from via a hash
pub trait DigestibleSecret {
    fn as_bytes(&self) -> &[u8];

    /// Inserts this shared secret in the given digest
    fn update_digest<D: digest::Digest>(&self, d: D, domain: impl AsRef<str>) -> D {
        let domain: &str = domain.as_ref();
        let bytes: &[u8] = self.as_bytes();

        // NOTE: we include the lengths to prevent collisions
        d.chain_update(domain)
            .chain_update(domain.len().to_ne_bytes())
            .chain_update(bytes)
            .chain_update(bytes.len().to_ne_bytes())
    }

    /// Creates a scalar from this shared secret
    fn derive_scalar<D>(&self, d: D, domain: impl AsRef<str>) -> Scalar
    where
        D: digest::Digest<OutputSize = typenum::U64>,
    {
        Scalar::from_hash(self.update_digest(d, domain))
    }
}
