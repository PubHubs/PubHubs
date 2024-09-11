use rand::Rng as _;

/// Generates a random 22 character alphanumeric string (`[a-zA-Z0-9]{22}`),
/// having > 128 bits of randomness.
pub fn random_alphanumeric() -> String {
    rand::rngs::OsRng
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(22)
        .map(char::from)
        .collect()
}
