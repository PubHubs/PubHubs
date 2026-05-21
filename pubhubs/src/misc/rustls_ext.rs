//! Helpers related to [`rustls`](https://docs.rs/rustls).

/// Ensures the process-wide default rustls `CryptoProvider` prefers the post-quantum
/// hybrid key exchange `X25519MLKEM768`, installing aws-lc-rs if no default is set yet.
///
/// This sets the key exchange offered by all our outbound TLS — `awc` (server-to-server
/// and Yivi) and `object_store`'s `reqwest` (the S3 store) — which build their configs
/// via `rustls::ClientConfig::builder`.  Call it once before any client is built (e.g.
/// first thing in `main`): with both the `ring` and `aws_lc_rs` providers compiled,
/// `ClientConfig::builder` panics unless a default is installed.  Idempotent.
///
/// # Panics
///
/// If the resulting default provider does not prefer `X25519MLKEM768`.
pub fn ensure_pq_default_crypto_provider() {
    use rustls::crypto::aws_lc_rs;

    match aws_lc_rs::default_provider().install_default() {
        Ok(()) => assert!(
            provider_prefers_mlkem(&aws_lc_rs::default_provider()),
            "aws-lc-rs's default rustls provider does not prefer X25519MLKEM768",
        ),
        Err(existing) => assert!(
            provider_prefers_mlkem(&existing),
            "another rustls CryptoProvider was already installed as the process default \
             and does not prefer X25519MLKEM768; ensure_pq_default_crypto_provider() must \
             run before any other provider is installed",
        ),
    }
}

/// Whether `provider` prefers `X25519MLKEM768`, i.e. lists it first — rustls orders
/// `kx_groups` by preference.
fn provider_prefers_mlkem(provider: &rustls::crypto::CryptoProvider) -> bool {
    provider
        .kx_groups
        .first()
        .is_some_and(|kx| kx.name() == rustls::NamedGroup::X25519MLKEM768)
}
