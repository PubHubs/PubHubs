use crate::api;

/// Shared secret part used for Diffie-Hellman key exchange,
/// containing both the secret scalar, and the secret scalar times the basepoint.
#[derive(Clone)]
pub struct Ssp {
    pub secret: api::Scalar,
    pub public: api::CurvePoint,
}

impl From<api::Scalar> for Ssp {
    fn from(secret: api::Scalar) -> Self {
        let public = core::ops::Mul::mul(
            curve25519_dalek::constants::RISTRETTO_BASEPOINT_TABLE,
            &secret,
        )
        .compress()
        .into();

        Self { secret, public }
    }
}
