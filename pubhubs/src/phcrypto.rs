//! Some of the Pubhubs specific crypto

use crate::{
    api, attr,
    common::{
        elgamal,
        secret::{self, DigestibleSecret},
    },
    id,
    misc::{crypto, jwt},
    servers::constellation,
};

use curve25519_dalek::Scalar;
use digest::Digest as _;

/// Computes the `x B` from `x_T * B` and `x_PHC`, used by PHC to create the constellation
pub fn combine_master_enc_key_parts(
    public_part: &elgamal::PublicKey,
    private_part: &elgamal::PrivateKey,
) -> elgamal::PublicKey {
    private_part.scale(public_part)
}

/// Computes the factor of a hub's encryption key returned by PHC from the [api::phc::hub::Ticket] used
/// by the hub.
pub fn phc_hub_key_part(
    ticket: TicketDigest,
    shared_secret: &elgamal::SharedSecret,
    master_enc_key_part: &elgamal::PrivateKey,
) -> Scalar {
    // K * x_PHC
    hub_key_part_blind(ticket, shared_secret) * master_enc_key_part.as_scalar()
}

/// Computes the factor of a hub's encryption key returned by the T from the [api::phc::hub::Ticket] used
/// by the hub.
pub fn t_hub_key_part(
    ticket: TicketDigest,
    shared_secret: &elgamal::SharedSecret,
    enc_factor_secret: &impl DigestibleSecret,
    master_enc_key_part: &elgamal::PrivateKey,
) -> Scalar {
    // K^-1 * f_H * x_T
    hub_key_part_blind(ticket.clone(), shared_secret).invert()
        * encryption_factor(ticket, enc_factor_secret)
        * master_enc_key_part.as_scalar()
}

/// Turns the given polymorphic pseudonym `pp` (which should be `Id_U` elgamal encrypted for `x`)
/// into an encrypted hub pseudonym (which should be `g_H Id_U` elgamal encrypted for `x_PHC`).
pub fn t_encrypted_hub_pseudonym(
    pp: elgamal::Triple,
    pseud_factor_secret: impl DigestibleSecret,
    master_enc_key_part_inv: &Scalar,
    hub_id: id::Id,
) -> elgamal::Triple {
    let g_h = pseud_factor_secret.derive_scalar(
        sha2::Sha256::new().chain_update(hub_id),
        "pubhubs-pseud-factor",
    );

    pp.rsk_with_s(g_h).and_k(master_enc_key_part_inv)
}

/// Returns the `f_H` for the given hub ticket
pub fn encryption_factor(
    ticket_digest: TicketDigest,
    enc_factor_secret: &impl DigestibleSecret,
) -> Scalar {
    enc_factor_secret.derive_scalar(ticket_digest.inner, "pubhubs-hub-enc-key-factor")
}

/// Returns the blind `K` added by PHC to `x_PHC` when a hub requests its hub enc key part.
pub fn hub_key_part_blind(
    ticket_digest: TicketDigest,
    shared_secret: &elgamal::SharedSecret,
) -> Scalar {
    shared_secret.derive_scalar(ticket_digest.inner, "pubhubs-hub-key-part-blinding")
}

/// Wrapper around a [digest::Digest] that's obtained from a [api::phc::hub::Ticket].
#[derive(Clone)]
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

/// Computes the [`jwt::HS256`] key used to sign [`Attr`] from the secret shared between the
/// authentication server and pubhubs central.
///
/// [`Attr`]: crate::attr::Attr
pub fn attr_signing_key(shared_secret: &elgamal::SharedSecret) -> jwt::HS256 {
    shared_secret.derive_hs256(sha2::Sha256::new(), "pubhubs-attr-signing")
}

/// Computes the [`crypto::SealingKey`] used to seal messages between servers shared a secret.
pub fn sealing_secret(shared_secret: &elgamal::SharedSecret) -> crypto::SealingKey {
    shared_secret.derive_sealing_key(sha2::Sha256::new(), "pubhubs-sealing-secret")
}

/// Derives an [`Id`] for an [`Attr`].
///
/// [`Attr`]: attr::Attr
/// [`Id`]: id::Id
pub fn attr_id(attr: &attr::Attr, secret: impl secret::DigestibleSecret) -> crate::id::Id {
    secret.derive_id(
        sha2::Sha256::new()
            .chain_update(attr.attr_type.as_slice())
            .chain_update(secret::encode_usize(attr.value.len()))
            .chain_update(attr.value.as_bytes()),
        "pubhubs-attr-id",
    )
}

/// Derives an [`id::Id`] for a [`constellation::Inner`].
pub fn constellation_id(c: &constellation::Inner) -> id::Id {
    b"".as_slice()
        .derive_id(c.sha256(), "pubhubs-constellation-id")
}

/// Derives an `hmac` for a user object stored at pubhubs central.
///
/// See [`crate::api::phc::user::GetObjectEP`].
pub fn phc_user_object_hmac(
    object_id: crate::id::Id,
    secret: impl secret::DigestibleSecret,
) -> crate::id::Id {
    secret.derive_id(
        sha2::Sha256::new().chain_update(object_id.as_slice()),
        "pubhubs-user-object-hmac",
    )
}

/// Derives attribute keys for a given [`attr::Attr`]ibute and a list of timestamps.
pub fn auths_attr_keys(
    attr: attr::Attr,
    secret: impl secret::DigestibleSecret,
    timestamps: impl IntoIterator<Item = jwt::NumericDate>,
) -> Vec<Vec<u8>> {
    let attr_secret = attr_id(&attr, secret);

    timestamps
        .into_iter()
        .map(|ts| {
            attr_secret.derive_bytes(
                sha2::Sha256::new().chain_update(ts.timestamp().to_be_bytes()),
                "pubhubs-attr-key",
            )
        })
        .collect()
}
