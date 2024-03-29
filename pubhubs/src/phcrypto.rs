//! Some of the Pubhubs specific crypto

use crate::{api, elgamal};

use curve25519_dalek::Scalar;
use digest::Digest as _;

/// Computes the `x B` from `x_T * B` and `x_PHC`, used by PHC to create the constellation
pub fn combine_master_enc_key_parts(
    public_part: &elgamal::PublicKey,
    private_part: &elgamal::PrivateKey,
) -> elgamal::PublicKey {
    private_part.scale(public_part)
}

/// Computes the factor of a hub's encryption key returned by PHC from the [api::phc::Ticket] used
/// by the hub.
pub fn phc_hub_key_part(
    ticket: TicketDigest,
    shared_secret: &elgamal::SharedSecret,
    master_enc_key_part: &elgamal::PrivateKey,
) -> Scalar {
    // K * x_PHC
    hub_key_part_blind(ticket, shared_secret) * master_enc_key_part.as_scalar()
}

/// Returns the blind `K` added by PHC to `x_PHC` when a hub requests its hub enc key part.
pub fn hub_key_part_blind(
    ticket_digest: TicketDigest,
    shared_secret: &elgamal::SharedSecret,
) -> Scalar {
    shared_secret.derive_scalar(ticket_digest.inner, "pubhubs-hub-key-part-blinding")
}

/// Wrapper around a [digest::Digest] that's obtained from a [api::phc::hub::Ticket].
pub struct TicketDigest {
    inner: sha2::Sha512,
}

impl TicketDigest {
    pub fn new(ticket: &api::phc::hub::Ticket) -> Self {
        TicketDigest {
            inner: sha2::Sha512::new().chain_update(ticket.as_str()),
        }
    }
}
