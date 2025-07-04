//! Data structures related to the authentication of users towards hubs

use crate::api::*;

use serde::{Deserialize, Serialize};

use crate::common::elgamal;
use crate::misc::jwt;

/// Returned (in sealed form) by [`phc::user::PppEP`], needed for  [`tr::EhppEP`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct PolymorphicPseudonymPackage {
    /// The actual polymorphic pseudonym for the user
    pub polymorphic_pseudonym: elgamal::Triple,

    pub nonce: phc::user::PpNonce,
}

having_message_code!(PolymorphicPseudonymPackage, Ppp);

/// Returned (in sealed form) by [`tr::EhppEP`], needed for [`phc::user::HhppEP`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct EncryptedHubPseudonymPackage {
    /// Hub pseudonym `g_H Id_U`, elgamal encrypted for `x_PHC`.
    pub encrypted_hub_pseudonym: elgamal::Triple,

    /// Nonce, from [`hub::EnterStartEP`]
    pub hub_nonce: hub::EnterNonce,

    /// Nonce, from [`PolymorphicPseudonymPackage::nonce`]
    pub phc_nonce: phc::user::PpNonce,
}

having_message_code!(EncryptedHubPseudonymPackage, Ehpp);

/// Returned (in sealed form) by [`phc::user::HhppEP`], needed for [`hub::EnterCompleteEP`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct HashedHubPseudonymPackage {
    /// The hashed hub pseudonym, hashed to a point on curve25519 so we can decide to add an
    /// additional layer of ElGamal encryption later on.
    pub hashed_hub_pseudonym: CurvePoint,

    /// When the original pseudonym was issued
    pub pp_issued_at: jwt::NumericDate,

    /// Nonce, from [`hub::EnterStartEP`]
    pub hub_nonce: hub::EnterNonce,
}

having_message_code!(HashedHubPseudonymPackage, Hhpp);
