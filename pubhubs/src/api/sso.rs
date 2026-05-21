//! Data structures related to the authentication of users towards hubs.
//!
//! Below is an overview of the single-sign-on flow, including the most important (cryptographic)
//! details.  Remaining details can be found in the code itself.
//!
//! # Matrix IDs
//!
//! Each user $U$ gets assigned a random **matrix id (mxid)** when they enter a hub $H$
//! of the form
//! $$a_1a_2\dotsb a_n c\text{-}d b_1b_2\dotsb b_n,$$ where $n\in \\{2,\dotsc,15\\}$
//! is large enough for the matrix ID to be unique,
//! $a_1,\dotsc,a_n,b_1,\dotsc, b_n$ are random hex digits, and $c,d\in \\{0,1,\dotsc,f,g\\}$
//! are [ISBN10-style check digits](https://en.wikipedia.org/wiki/ISBN#ISBN-10_check_digits)
//! (but using modulo 17 instead of modulo 11)
//! over $a_1\dotsb a_n$ and $b_1\dotsb b_n$, respectively.
//!
//! This mxid is *not* derived from the 'pubhubs' pseudonym a hub $H$ receives for the user $U$
//! from pubhubs via the single-sign-on flow below.  Instead, the (pubhubs) pseudonym of a user
//! is linked to its (random) mxid as 'external user id' via the
//! [`record_user_external_id`](https://github.com/element-hq/synapse/blob/7b1c4da5dfbe48fa5e0dabc3933aed54f40e1644/synapse/module_api/__init__.py#L935)
//! function.  This is done for two reasons:
//!
//!   1. The pubhubs pseudonym for a user is seen by PHC, and so PHC could track a user across hubs
//!      if hubs would use the pubhubs pseudonym as mxid.
//!
//!   2. Decoupling the mxid from the pubhubs pseudonym allows for changes to the pseudonym system in
//!      the future without users having to change their mxid.
//!
//! # Pseudonyms
//!
//! The pseudonym the hub $H$ gets for a user $U$ (and uses as 'external id') is
//! $$\mathrm{Sha512}(g_H \cdot \mathrm{Id}\_U )$$
//! mapped to a [`CurvePoint`], where:
//!
//!  - $\mathrm{Id}\_U$ is a permanent unchanging **secret user identifier**
//!    (a random [`CurvePoint`]).  The secret user identifier is known to no one,
//!    not even the user itself. PHC and the transcryptor only get to see the ElGamal encrypted
//!    form known as the _polymorphic pseudonym_ (see below).
//!
//!    > **Note:** The secret user identifier should not be confused with the `user_id`
//!    > used by PHC internally to identify a user.
//!
//!
//!  - $g_H$ is the **pseudonymisation factor**, a [`scalar`](Scalar) unique
//!    to the hub $H$, known only by the transcryptor:
//!    $$g_H := \mathrm{Sha512}(H \Vert \ell_d \Vert d \Vert \ell_g \Vert g)$$
//!    where $H$ is the [**hub id**](crate::hub::BasicInfo::id) (32 bytes),
//!    $d := \text{"pubhubs-pseud-factor"}$, $g$ is the transcryptor's
//!    pseudonymisation-factor secret, and $\ell_d, \ell_g$ are the byte
//!    lengths of $d, g$ encoded as 8-byte big-endian unsigned integers.
//!
//!    <details class="toggle">
//!    <summary class="hideme"><span>Expand example </span></summary>
//!    
//!    **Example**
//!    ```
//!    use sha2::Digest; // brings `chain_update` and `new` into scope
//!    let h = pubhubs::id::Id::from([7u8; 32]);
//!    let g: &[u8] = b"abc";          // 3 bytes
//!    let d = "pubhubs-pseud-factor"; // 20 bytes
//!    assert_eq!(
//!        pubhubs::phcrypto::pseud_factor_for_hub(g, h),
//!        curve25519_dalek::Scalar::from_hash(
//!            sha2::Sha512::new()
//!                .chain_update(h.as_slice())
//!                .chain_update([0, 0, 0, 0, 0, 0, 0, 20u8])
//!                .chain_update(d.as_bytes())
//!                .chain_update([0, 0, 0, 0, 0, 0, 0, 3u8])
//!                .chain_update(g),
//!        ),
//!    );
//!    ```
//!
//!    </details>
//!
//! > **Note:** The white paper uses $g_H\cdot \mathrm{Id}\_U$ instead
//! > of $\mathrm{Sha512}(g_H\cdot \mathrm{Id}\_U)$.  The hash has been added to
//! > protect the pseudonym against harvest-now-decrypt-later-by-a-quantum-computer attacks.
//!
//! The SSO flow described below gets the pseudonym
//! $\mathrm{Sha512}(g_H \cdot \mathrm{Id}\_U )$ of a user $U$ to the hub $H$ in such a way that:
//!  - The hub learns only this pseudonym.
//!  - PHC learns $U$, but not what hub $H$ they are visiting.
//!  - The transcryptor learns $H$ (and knows $g_H$), but can not (without a quantum computer) deduce $U$.
//!
//! The assumption here is, of course, that PHC and the transcryptor do not collude.
//!
//! # Polymorphic pseudonyms
//!
//! A **polymorphic pseudonym** $\mathrm{PP}\_U$
//! for the user $U$ is an [ElGamal encryption](elgamal::Triple) of
//! $\mathrm{Id}\_U$ of the form
//! $$ \mathrm{PP}\_U \ :=\ (rB,\ \mathrm{Id}\_U + rxB,\  xB).$$
//! Here:
//!  - $B$ denotes the base point used by [`CurvePoint`].
//!  - $x := x\_{\mathrm{T}} x\_{\mathrm{PHC}}$ is the  **master encryption key**,
//!    that splits into two **master encryption key parts**, $x\_{\mathrm{T}}$ and $x\_{\mathrm{PHC}}$,
//!    picked by the transcryptor and PHC, respectively.
//!  - $r$ is a random [`Scalar`].
//!
//! While each user has just one $\mathrm{Id}\_U$,
//! it has many different polymorphic pseudonyms on account of the random factor $r$.
//! The polymorphic pseudonym serves two purposes:
//!
//!  1. It 'identifies' the user $U$ (towards the transcryptor) without always
//!     having the same shape, so it can not be used to track logins of the same user.
//!  
//!  2. It allows operations to be performed on $\mathrm{Id}\_U$ without revealing $\mathrm{Id}\_U$
//!     itself (via the _homomorphic_ properties of ElGamal encryption, see [`elgamal::Triple::rsk`].)
//!
//! # Flow
//!
//!  1. The global client first obtains from PHC via [`phc::user::PppEP`] a
//!     [`PolymorphicPseudonymPackage`] (**PPP**), sealed for the transcryptor, which contains
//!     a freshly rerandomized polymorphic pseudonym, $\mathrm{PP}\_U$, and a
//!     polymorphic pseudonym nonce (**phc nonce**). The phc nonce is essentially an encrypted cookie
//!     that contains the `user_id` and expiry of the PP.
//!     
//!     Simultaneously, the global client obtains a **hub state** and **hub nonce** from the hub via the
//!     [`hub::EnterStartEP`] endpoint.  The hub state and hub nonce are encrypted cookies too.
//!     The hub state contains an issued-at timestamp, and both the hub state and the hub
//!     nonce contain the same random identifier (linking them together).
//!
//!  2. The global client sends the PPP, hub nonce and $H$ to the [`tr::EhppEP`] endpoint.
//!     The transcryptor extracts $\mathrm{PP}\_U$, and
//!     (using [`crate::phcrypto::t_encrypted_hub_pseudonym`])
//!
//!      1. multiplies the underlying plaintext with $g_H$,
//!      2. rekeys it, removing the $x\_\mathrm{T}$-component, and
//!      3. rerandomizes it.
//!
//!     The resulting **encrypted hub pseudonym** should be an ElGamal encryption of
//!     $g_H \mathrm{Id}\_U$ keyed for $x\_\mathrm{PHC}$.
//!
//!     This encrypted hub pseudonym is bundled together with the hub nonce and phc nonce
//!     in an [`EncryptedHubPseudonymPackage`] (**EHPP**),
//!     and returned by the transcryptor to the global client sealed for PHC.
//!
//!  3. The global client forwards the EHPP back to PHC, via [`phc::user::HhppEP`].
//!     PHC extracts the phc nonce, checks its validity, and extracts the `user_id` from it,
//!     and checks that it coincides with the `user_id` from the auth token.
//!     If this checks out, PHC proceeds by decrypting the encrypted hub pseudonym using
//!     $x\_\mathrm{PHC}$, yielding $g_H \mathrm{Id}\_U$.
//!     PHC then computes the **hashed hub pseudonym** $\mathrm{Sha512}(g_H\cdot\mathrm{Id}\_U)$,
//!     and returns it to global client in a signed [`HashedHubPseudonymPackage`] (**HHPP**) that also contains
//!     the hub nonce and the timestamp at which the polymorphic pseudonym was created.
//!
//!  4. The global client forwards this HHPP to the hub, via the [`hub::EnterCompleteEP`],
//!     including also the hub state.  The hub checks the signature on the HHPP, whether
//!     the hub nonce (from the HHPP) and the hub state (sent alongside) are genuine and belong
//!     to one another, and
//!     whether the PP and hub state are fresh (issued no longer than 10 seconds ago).
//!     If everything checks out, the hashed hub pseudonym is used by the hub as external user
//!     id to look up the (or register a) matrix user for $U$ at $H$.

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

/// Returned (signed) by [`phc::user::HhppEP`], needed for [`hub::EnterCompleteEP`].
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
