//! Data structures related to the authentication of users towards hubs.
//!
//! # Overview
//!
//! ## Pseudonyms
//!
//! The pseudonym a user $U$ gets in a hub $H$ is
//! $$\mathrm{Sha512}(g_H \cdot \mathrm{Id}_U )$$
//! mapped to a [`CurvePoint`], where:
//!
//!  - $\mathrm{Id}_U$ is a permanent unchanging **secret user identifier**
//!    (a random [`CurvePoint`]).  The secret user identifier is known to no one,
//!    not even the user itself. PHC and the transcryptor only get to see the ElGamal encrypted
//!    form known as the _polymorphic pseudonym_ (see below).
//!
//!    > **Note:** The secret user identifier should not be confused with the `user_id`
//!    > used by PHC internally to identify a user.)
//!
//!
//!  - $g_H$ is the **pseudonymisation factor**, a [`scalar`](Scalar)
//!    unique to the hub $H$ known only by the transcryptor, computed via
//!    $$g_H\ :=\ \mathrm{Sha512}\bigl(H \Vert \ell_d \Vert d \Vert \ell_g \Vert g\bigr)$$
//!    where:
//!    - $g$ is an unchanging **pseudonymisation factor secret** picked by the transcryptor;
//!    - $H$ is the [**hub id**](crate::hub::BasicInfo::id) configured by PHC (a fixed 32-byte value);
//!    - $d := \text{"pubhubs-pseud-factor"}$ is a domain separator;
//!    - $\ell_d$ and $\ell_g$ are the byte lengths of $d$ and $g$, encoded as
//!      8-byte big-endian unsigned integers.  They are included to prevent
//!      collisions between $d$ and $g$ of different lengths.
//!
//!    The example below verifies that the implementation in
//!    [`crate::phcrypto::t_encrypted_hub_pseudonym`] matches this formula:
//!    ```
//!    # use pubhubs::id::Id;
//!    # use pubhubs::common::secret::DigestibleSecret;
//!    # use sha2::{Digest, Sha512};
//!    # use curve25519_dalek::Scalar;
//!    let h = Id::from([7u8; 32]);
//!    let g: &[u8] = b"abc";          // 3 bytes
//!    let d = "pubhubs-pseud-factor"; //  20 bytes
//!    assert_eq!(
//!        g.derive_scalar(Sha512::new().chain_update(h.as_slice()), d),
//!        Scalar::from_hash(
//!            Sha512::new()
//!                .chain_update(h.as_slice())
//!                .chain_update([0, 0, 0, 0, 0, 0, 0, 20u8])
//!                .chain_update(d.as_bytes())
//!                .chain_update([0, 0, 0, 0, 0, 0, 0, 3u8])
//!                .chain_update(g),
//!        ),
//!    );
//!    ```
//!
//! > **Note:** The white paper uses $g_H\cdot \mathrm{Id}_U$ instead
//! > of $\mathrm{Sha512}(g_H\cdot \mathrm{Id}_U)$.  The hash has been added to
//! > protect the pseudonym against harvest-now-decrypt-later-by-a-quantum-computer attacks.
//!
//! The SSO flow described below gets the pseudonym
//! $\mathrm{Sha512}(g_H \cdot \mathrm{Id}_U )$ of a user $U$ to the hub $H$ in such a way that:
//!  - The hub learns only this pseudonym.
//!  - PHC learns $U$, but not what hub $H$ they are visiting.
//!  - The transcryptor learns $H$ (and knows $g_H$), but can not* deduce $U$.
//!
//! ## Polymorphic pseudonyms
//!
//! A **polymorphic pseudonym** $\mathrm{PP}_U$
//! for the user $U$ is an [ElGamal encryption](elgamal::Triple) of
//! $\mathrm{Id}_U$ of the form
//! $$ \mathrm{PP}_U \ :=\ (rB,\ \mathrm{Id}_U + rxB,\  xB).$$
//! Here:
//!  - $B$ denotes the base point used by [`CurvePoint`].
//!  - $x := x_{\mathrm{T}} x_{\mathrm{PHC}}$ is the  **master encryption key**,
//!    that splits into two **master encryption key parts**, $x_{\mathrm{T}}$ and $x_{\mathrm{PHC}}$,
//!    picked by the transcryptor and PHC, respectively.
//!  - $r$ is a random [`Scalar`].
//!
//! While each user has just one $\mathrm{Id}_U$,
//! it has many different polymorphic pseudonyms on account of the random factor $r$.
//! The polymorphic pseudonym serves two purposes:
//!
//!  1. It 'identifies' the user $U$ (towards the transcryptor) without always
//!     having the same shape, so it can not be used to track logins of the same user.
//!  
//!  2. It allows operations to be performed on $\mathrm{Id}_U$ without revealing $\mathrm{Id}_U$
//!     itself (via the _homomorphic_ properties of ElGamal encryption, see [`elgamal::Triple::rsk`].)
//!
//!
//!
//!
//! ## Flow
//!
//!  1. The user first obtains a [`PolymorphicPseudonymPackage`] (**PPP**) from PHC,
//!     which contains a polymorphic pseudonym nonce (**ppnonce**) and a polymorphic pseudonym.
//!     The polymorphic pseudonym is the ElGamal encryption of

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

impl Signable for HashedHubPseudonymPackage {
    const CODE: MessageCode = MessageCode::Hhpp;
    const CONSTELLATION_BOUND: bool = true;
}
