//! Hybrid post-quantum digital signature
//! combining ed25519 and ML-DSA-65, for signing JWTs ([`crate::misc::jwt`]) and
//! [`Signed`](crate::api::Signed) messages.
//!
//! A signature consists of *both* an ML-DSA-65 and an ed25519 signature, and verification requires
//! *both* to be valid.
//!
//! # Relation to the standard, and the one deviation
//!
//! This tracks [`draft-ietf-jose-pq-composite-sigs-01`] (built on
//! [`draft-ietf-lamps-pq-composite-sigs-19`]), which standardises this `ML-DSA-65-Ed25519`
//! composite.  We follow it rather than an ad-hoc combiner so that, should Yivi adopt it for
//! signing its JWTs in the future, conforming (see below) would let us verify Yivi's signatures
//! directly.
//!
//! We replicate that combiner **except for one detail**: the standard signs the ML-DSA component
//! with a non-empty context (`mldsa_ctx = LABEL`), but [`aws_lc_rs`]'s ML-DSA API (still `unstable`
//! as of 1.17) exposes no context parameter, so we use the *empty* context (see `ML_DSA_CTX`).
//! This makes our signatures **non-conformant** with the standard, and means the official test
//! vectors (which use `mldsa_ctx=LABEL`) cannot be verified here yet.
//!
//! Everything else — `M'`, the SHA-512 prehash, the concatenation order, the key/signature byte
//! formats, and the `AKP` JWK — is standard-correct.  When [`aws_lc_rs`] exposes an ML-DSA context
//! parameter (its C core already supports it), conforming is small and local:
//! 1. set `ML_DSA_CTX` to `LABEL` and thread it into `ml_dsa_sign`/`ml_dsa_verify`;
//! 2. rename [`ALG`] to `"ML-DSA-65-Ed25519"`;
//! 3. add the official `MLDSA65-Ed25519` test-vector check.
//!
//! [`draft-ietf-jose-pq-composite-sigs-01`]: https://datatracker.ietf.org/doc/html/draft-ietf-jose-pq-composite-sigs-01
//! [`draft-ietf-lamps-pq-composite-sigs-19`]: https://datatracker.ietf.org/doc/html/draft-ietf-lamps-pq-composite-sigs-19

use aws_lc_rs::signature::{KeyPair as _, ParsedPublicKey};
use aws_lc_rs::unstable::signature::{ML_DSA_65, ML_DSA_65_SIGNING, PqdsaKeyPair};
use base64ct::{Base64UrlUnpadded, Encoding as _};
use sha2::{Digest as _, Sha256, Sha512};

use crate::misc::error::{OPAQUE, Opaque};
use crate::misc::jwt;
use crate::misc::serde_ext::bytes_wrapper::B64;

/// Value for the `alg` JWT header.  Interim, non-conformant name; the standard reserves
/// `"ML-DSA-65-Ed25519"` for the conformant variant (see module docs).
pub const ALG: &str = "ph-ML-DSA-65-Ed25519";

/// `Prefix` from the composite-signatures combiner — the fixed domain-separation string defined in
/// [draft-ietf-lamps-pq-composite-sigs-19 §2.2 "Prefix, Label, and CTX"](https://www.ietf.org/archive/id/draft-ietf-lamps-pq-composite-sigs-19.html#name-prefix-label-and-ctx).
const PREFIX: &[u8] = b"CompositeAlgorithmSignatures2025";

/// `Label` for the `ML-DSA-65-Ed25519` combination, from
/// [draft-ietf-lamps-pq-composite-sigs-19 §6 "Algorithm Identifiers and Parameters"](https://www.ietf.org/archive/id/draft-ietf-lamps-pq-composite-sigs-19.html#name-algorithm-identifiers-and-p).
/// It is the per-algorithm domain separator in the message representative
/// `M' = PREFIX ‖ LABEL ‖ … ‖ SHA-512(message)` built by [`message_representative`] — and, in the
/// conformant variant, the ML-DSA context (see [`ML_DSA_CTX`]).
const LABEL: &[u8] = b"COMPSIG-MLDSA65-Ed25519-SHA512";

/// The composite *application* context `ctx`, encoded in `M'` as `len(ctx) ‖ ctx` — empty for our
/// JWTs.  Distinct from [`ML_DSA_CTX`], the context of the underlying ML-DSA primitive.
const CTX: &[u8] = b"";

/// `len(ctx)` occupies a single byte of `M'`, so the standard caps `ctx` at 255 bytes.
const _: () = assert!(CTX.len() <= 255);

/// Context passed to the underlying ML-DSA primitive.
///
/// **This is the sole deviation from the standard**, which uses [`LABEL`] here.  [`aws_lc_rs`]'s
/// ML-DSA API currently exposes no context parameter, so we use the empty context.  Setting this to
/// [`LABEL`] (once a context-capable backend exists) is what makes signatures standard-conformant.
const ML_DSA_CTX: &[u8] = b"";

/// Compile-time guard for the deviation above: [`ML_DSA_CTX`] must stay empty, because
/// [`ml_dsa_sign`]/[`ml_dsa_verify`] cannot pass a context to [`aws_lc_rs`].  Setting it to [`LABEL`]
/// for conformance must go together with threading the context through those functions — this
/// assertion fails the build until then.
const _: () = assert!(ML_DSA_CTX.is_empty());

/// ed25519 signature length, in bytes.
const ED25519_SIG_LEN: usize = ed25519_dalek::SIGNATURE_LENGTH;

/// Length of the message representative `M'` (see [`message_representative`]): `PREFIX ‖ LABEL ‖
/// len(ctx) ‖ ctx ‖ SHA-512(..)`, a fixed size (the `+ 1` is the `len(ctx)` byte).
const M_PRIME_LEN: usize = PREFIX.len() + LABEL.len() + 1 + CTX.len() + 64;

/// Hybrid signing key, the 'private key'.  Generate using [`SigningKey::generate`].
#[derive(Debug)]
pub struct SigningKey {
    ed: ed25519_dalek::SigningKey,
    ml: PqdsaKeyPair,

    /// The 32-byte ML-DSA seed.  Kept because [`PqdsaKeyPair`] does not retain it, yet we need it to
    /// [`encode`](SigningKey::encode) the key compactly.
    ml_seed: zeroize::Zeroizing<[u8; 32]>,

    /// Precomputed [`VerifyingKey`].  Constructing one parses the ML-DSA public key, so we do that
    /// once here and hand out shared references via [`verifying_key`](Self::verifying_key).
    vk: VerifyingKey,
}

/// Hybrid verifying key, the 'public key'.  Obtain via [`SigningKey::verifying_key`].
#[derive(Clone, Debug)]
pub struct VerifyingKey {
    ed: ed25519_dalek::VerifyingKey,

    /// Pre-parsed ML-DSA public key, so verification avoids re-parsing the ~1952-byte key each time.
    ml: ParsedPublicKey,
}

/// Encoded form of [`SigningKey`], for storage.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, zeroize::ZeroizeOnDrop)]
pub struct SigningKeyBytes {
    /// ed25519 signing-key bytes (32).
    ed: B64,

    /// ML-DSA seed bytes (32); see [`SigningKey::ml_seed`].
    ml: B64,
}

/// Encoded form of [`VerifyingKey`], for the wire.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct VerifyingKeyBytes {
    /// ed25519 verifying-key bytes (32).
    pub ed: B64,

    /// ML-DSA-65 public-key octets (~1952).
    pub ml: B64,
}

impl SigningKey {
    /// Generates a [`SigningKey`].  Expensive.
    pub fn generate() -> Result<Self, Opaque> {
        Self::from_parts(
            crate::misc::crypto::random_32_bytes(),
            crate::misc::crypto::random_32_bytes(),
        )
    }

    /// Returns the associated [`VerifyingKey`].  Cheap: it is precomputed at construction, and we
    /// return a shared reference rather than cloning — cloning an ML-DSA key calls `EVP_PKEY_up_ref`
    /// under a global lock, whereas verifying through `&` is lock-free and safe to share across
    /// threads.
    pub fn verifying_key(&self) -> &VerifyingKey {
        &self.vk
    }

    /// Encodes for storage.  Cheap.
    pub fn encode(&self) -> SigningKeyBytes {
        SigningKeyBytes {
            ed: B64::from_bytes(self.ed.to_bytes()),
            ml: B64::from_bytes(*self.ml_seed),
        }
    }

    /// The ed25519 component, for producing a *classical* EdDSA signature (`alg: "EdDSA"`).
    ///
    /// Used only for the backwards-compatible HHPP that pre-hybrid hubs verify with the
    /// constellation's `phc_jwt_key` (= [`VerifyingKey::ed25519_bytes`]).  This signs the raw JWS
    /// input.
    pub fn ed25519_signing_key(&self) -> &ed25519_dalek::SigningKey {
        &self.ed
    }

    /// Assembles a [`SigningKey`] from the two 32-byte seeds — the ed25519 secret key and the ML-DSA
    /// seed — deriving both component keys (so neither call site repeats that) and precomputing the
    /// [`VerifyingKey`] (parsing the ML-DSA public key once here, not on every
    /// [`verifying_key`](Self::verifying_key)).
    fn from_parts(ed_seed: [u8; 32], ml_seed: [u8; 32]) -> Result<Self, Opaque> {
        let ed = ed25519_dalek::SigningKey::from_bytes(&ed_seed);
        let ml = PqdsaKeyPair::from_seed(&ML_DSA_65_SIGNING, &ml_seed).map_err(|_| OPAQUE)?;
        let vk = VerifyingKey {
            ed: ed.verifying_key(),
            ml: ParsedPublicKey::new(&ML_DSA_65, ml.public_key().as_ref()).map_err(|_| OPAQUE)?,
        };
        Ok(Self {
            ed,
            ml,
            ml_seed: zeroize::Zeroizing::new(ml_seed),
            vk,
        })
    }
}

impl SigningKeyBytes {
    /// Decodes into a [`SigningKey`].  Expensive.
    pub fn decode(&self) -> Result<SigningKey, Opaque> {
        let ed_seed: [u8; 32] = (&self.ed[..]).try_into()?;
        let ml_seed: [u8; 32] = (&self.ml[..]).try_into()?;
        SigningKey::from_parts(ed_seed, ml_seed)
    }
}

impl VerifyingKey {
    /// Encodes for the wire.  Cheap.
    pub fn encode(&self) -> VerifyingKeyBytes {
        VerifyingKeyBytes {
            ed: B64::from_bytes(self.ed.to_bytes()),
            ml: B64::from_bytes(self.ml.as_ref()),
        }
    }

    /// The ed25519 component's 32 public-key bytes — published as the constellation's `phc_jwt_key`
    /// so pre-hybrid hubs can verify the classical EdDSA HHPP.
    pub fn ed25519_bytes(&self) -> [u8; 32] {
        self.ed.to_bytes()
    }
}

impl VerifyingKeyBytes {
    /// Decodes into a [`VerifyingKey`].
    pub fn decode(&self) -> Result<VerifyingKey, Opaque> {
        let ed_bytes: [u8; 32] = (&self.ed[..]).try_into()?;
        Ok(VerifyingKey {
            ed: ed25519_dalek::VerifyingKey::from_bytes(&ed_bytes)?,
            ml: ParsedPublicKey::new(&ML_DSA_65, &self.ml[..]).map_err(|_| OPAQUE)?,
        })
    }
}

/// [`ParsedPublicKey`] does not implement [`PartialEq`], so we compare the underlying public-key
/// octets (which fully determine the key).
impl PartialEq for VerifyingKey {
    fn eq(&self, other: &Self) -> bool {
        self.ed == other.ed && self.ml.as_ref() == other.ml.as_ref()
    }
}

impl Eq for VerifyingKey {}

impl jwt::Key for SigningKey {
    const ALG: &'static str = ALG;
}

impl jwt::Key for VerifyingKey {
    const ALG: &'static str = ALG;
}

impl jwt::SigningKey for SigningKey {
    type Signature = Vec<u8>;

    fn sign(&self, message: &[u8]) -> anyhow::Result<Vec<u8>> {
        let m_prime = message_representative(message);

        // signature = ML-DSA-65 sig ‖ ed25519 sig, written into one buffer to avoid a realloc.
        let ml_sig_len = ML_DSA_65_SIGNING.signature_len();
        let mut signature = vec![0u8; ml_sig_len + ED25519_SIG_LEN];
        ml_dsa_sign(&self.ml, &m_prime, &mut signature[..ml_sig_len])
            .map_err(|_| anyhow::anyhow!("ML-DSA signing failed"))?;
        signature[ml_sig_len..]
            .copy_from_slice(&ed25519_dalek::Signer::sign(&self.ed, &m_prime).to_bytes());
        Ok(signature)
    }

    fn jwk(&self) -> serde_json::Value {
        // AKP ("Algorithm Key Pair") JWK; the composite public key is ML-DSA-65 pk ‖ ed25519 pk.
        let mut pk = self.ml.public_key().as_ref().to_vec();
        pk.extend_from_slice(self.ed.verifying_key().as_bytes());

        serde_json::json!({
            "kty": "AKP",
            "alg": ALG,
            "pub": Base64UrlUnpadded::encode_string(&pk),
            "kid": jwk_thumbprint(ALG, &pk),
            "use": "sig",
        })
    }
}

impl jwt::VerifyingKey for VerifyingKey {
    fn is_valid_signature(&self, message: &[u8], signature: Vec<u8>) -> bool {
        let ml_sig_len = ML_DSA_65_SIGNING.signature_len();
        if signature.len() != ml_sig_len + ED25519_SIG_LEN {
            return false;
        }
        let (ml_sig, ed_sig) = signature.split_at(ml_sig_len);

        let m_prime = message_representative(message);

        // both components must verify
        if !ml_dsa_verify(&self.ml, &m_prime, ml_sig) {
            return false;
        }
        let Ok(ed_sig) = ed25519_dalek::Signature::from_slice(ed_sig) else {
            return false;
        };
        ed25519_dalek::Verifier::verify(&self.ed, &m_prime, &ed_sig).is_ok()
    }

    fn describe(&self) -> String {
        // Identify the key by its RFC 7638 JWK thumbprint (the prescribed method, and the `kid`)
        // rather than hex-dumping the ~1952-byte ML-DSA public key into a log line.
        let mut pubkey = self.ml.as_ref().to_vec();
        pubkey.extend_from_slice(self.ed.as_bytes());
        format!("{ALG} key #{}", jwk_thumbprint(ALG, &pubkey))
    }
}

/// [RFC 7638](https://www.rfc-editor.org/rfc/rfc7638) JWK thumbprint of the AKP public key:
/// `base64url(SHA-256(canonical JSON of the required members alg, kty, pub, in lexicographic
/// order))`.  `pub_bytes` is the composite public key `ML-DSA-65 pk ‖ ed25519 pk` (matching the JWK
/// `pub` member); all member values are ASCII, so the canonical JSON needs no escaping.  This value
/// is the JWK `kid`.  AKP key type and required members per
/// [RFC 9964 §6](https://www.rfc-editor.org/rfc/rfc9964.html#section-6).
fn jwk_thumbprint(alg: &str, pub_bytes: &[u8]) -> String {
    let canonical = format!(
        r#"{{"alg":"{alg}","kty":"AKP","pub":"{}"}}"#,
        Base64UrlUnpadded::encode_string(pub_bytes)
    );
    Base64UrlUnpadded::encode_string(Sha256::digest(canonical.as_bytes()).as_slice())
}

/// The composite message representative `M' = PREFIX ‖ LABEL ‖ len(ctx) ‖ ctx ‖ SHA-512(message)`.
/// `M'` is not a hash we take but the *message* both components sign (each hashes it internally), so
/// it must be passed whole.  The application context is empty, so `len(ctx) ‖ ctx` is a single
/// `0x00`, making `M'` a fixed [`M_PRIME_LEN`] bytes.  See
/// [draft-ietf-lamps-pq-composite-sigs-19 §2.2](https://www.ietf.org/archive/id/draft-ietf-lamps-pq-composite-sigs-19.html#name-prefix-label-and-ctx).
fn message_representative(message: &[u8]) -> [u8; M_PRIME_LEN] {
    let mut m_prime = [0u8; M_PRIME_LEN];
    let mut at = 0;
    m_prime[at..at + PREFIX.len()].copy_from_slice(PREFIX);
    at += PREFIX.len();
    m_prime[at..at + LABEL.len()].copy_from_slice(LABEL);
    at += LABEL.len();
    m_prime[at] = CTX.len() as u8; // len(ctx)
    at += 1;
    m_prime[at..at + CTX.len()].copy_from_slice(CTX);
    at += CTX.len();
    m_prime[at..].copy_from_slice(Sha512::digest(message).as_slice());
    m_prime
}

/// Signs `m_prime` with ML-DSA-65 into `out`, which must hold at least
/// [`ML_DSA_65_SIGNING`]`.signature_len()` bytes.
///
/// STANDARD-DEVIATION: the standard signs with `mldsa_ctx = LABEL`, but [`aws_lc_rs`] exposes no
/// ML-DSA context, so the empty [`ML_DSA_CTX`] is used (guarded by its compile-time assertion).  See
/// the module docs for the conformance path.
fn ml_dsa_sign(keypair: &PqdsaKeyPair, m_prime: &[u8], out: &mut [u8]) -> Result<(), Opaque> {
    // ML-DSA relies on an RNG that can fail.
    keypair.sign(m_prime, out).map_err(|_| OPAQUE)?;
    Ok(())
}

/// Verifies an ML-DSA-65 `signature` on `m_prime`.  See [`ml_dsa_sign`] for the context caveat.
fn ml_dsa_verify(public_key: &ParsedPublicKey, m_prime: &[u8], signature: &[u8]) -> bool {
    public_key.verify_sig(m_prime, signature).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::misc::jwt::{self, Claims, SigningKey as _, VerifyingKey as _};
    use base64ct::Base64UrlUnpadded;

    /// Our [`jwk_thumbprint`] reproduces the published `kid` of the ML-DSA-44 `AKP` JWK in
    /// [RFC 9964 Appendix A.1](https://www.rfc-editor.org/rfc/rfc9964.html), pinning our
    /// canonicalization to the standard.  (We can only borrow the *thumbprint* vector: there is no
    /// vector for our interim composite signature, which deviates on the ML-DSA context.)
    #[test]
    fn jwk_thumbprint_matches_rfc9964() {
        const PUB: &str = "unH59k4RuutY-pxvu24U5h8YZD2rSVtHU5qRZsoBmBMcRPgmu9VuNOVdteXi1zNIXjnqJg_GAAxepLqA00Vc3lO0bzRIKu39VFD8Lhuk8l0V-cFEJC-zm7UihxiQMMUEmOFxe3x1ixkKZ0jqmqP3rKryx8tSbtcXyfea64QhT6XNje2SoMP6FViBDxLHBQo2dwjRls0k5a-XSQSu2OTOiHLoaWsLe8pQ5FLNfTDqmkrawDEdZyxr3oSWJAsHQxRjcIiVzZuvwxYy1zl2STiP2vy_fTBaPemkleynQzqPg7oPCyXEE8bjnJbrfWkbNNN8438e6tHPIX4l7zTuzz98YPhLjt_d6EBdT4MldsYe-Y4KLyjaGHcAlTkk9oa5RhRwW89T0z_t1DSO3dvfKLUGXh8gd1BD6Fz5MfgpF5NjoafnQEqDjsAAhrCXY4b-Y3yYJEdX4_dp3dRGdHG_rWcPmgX4JG7lCnser4f8QGnDriqiAzJYEXeS8LzUngg_0bx0lqv_KcyU5IaLISFO0xZSU5mmEPvdSoDnyAcV8pV44qhLtAvd29n0ehG259oRihtljTWeiu9V60a1N2tbZVl5mEqSK-6_xZvNYA1TCdzNctvweH24unV7U3wer9XA9Q6kvJWDVJ4oKaQsKMrCSMlteBJMRxWbGK7ddUq6F7GdQw-3j2M-qdJvVKm9UPjY9rc1lPgol25-oJxTu7nxGlbJUH-4m5pevAN6NyZ6lfhbjWTKlxkrEKZvQXs_Yf6cpXEwpI_ZJeriq1UC1XHIpRkDwdOY9MH3an4RdDl2r9vGl_IwlKPNdh_5aF3jLgn7PCit1FNJAwC8fIncAXgAlgcXIpRXdfJk4bBiO89GGccSyDh2EgXYdpG3XvNgGWy7npuSoNTE7WIyblAk13UQuO4sdCbMIuriCdyfE73mvwj15xgb07RZRQtFGlFTmnFcIdZ90zDrWXDbANntv7KCKwNvoTuv64bY3HiGbj-NQ-U9eMylWVpvr4hrXcES8c9K3PqHWADZC0iIOvlzFv4VBoc_wVflcOrL_SIoaNFCNBAZZq-2v5lAgpJTqVOtqJ_HVraoSfcKy5g45p-qULunXj6Jwq21fobQiKubBKKOZwcJFyJD7F4ACKXOrz-HIvSHMCWW_9dVrRuCpJw0s0aVFbRqopDNhu446nqb4_EDYQM1tTHMozPd_jKxRRD0sH75X8ZoToxFSpLBDbtdWcenxj-zBf6IGWfZnmaetjKEBYJWC7QDQx1A91pJVJCEgieCkoIfTqkeQuePpIyu48g2FG3P1zjRF-kumhUTfSjo5qS0YiZQy0E1BMs6M11EvuxXRsHClLHoy5nLYI2Sj4zjVjYyxSHyPRPGGo9hwB34yWxzYNtPPGiqXS_dNCpi_zRZwRY4lCGrQ-hYTEWIK1Dm5OlttvC4_eiQ1dv63NiGkLRJ5kJA3bICN0fzCDY-MBqnd1cWn8YVBijVkgtaoascjL9EywDgJdeHnXK0eeOvUxHHhXJVkNqcibn8O4RQdpVU60TSA-uiu675ytIjcBHC6kTv8A8pmkj_4oypPd-F92YIJC741swkYQoeIHj8rE-ThcMUkF7KqC5VORbZTRp8HsZSqgiJcIPaouuxd1-8Rxrid3fXkE6p8bkrysPYoxWEJgh7ZFsRCPDWX-yTeJwFN0PKFP1j0F6YtlLfK5wv-c4F8ZQHA_-yc_gODicy7KmWDZgbTP07e7gEWzw4MFRrndjbDQ";
        const KID: &str = "T4xl70S7MT6Zeq6r9V9fPJGVn76wfnXJ21-gyo0Gu6o";

        let pub_bytes = Base64UrlUnpadded::decode_vec(PUB).unwrap();
        assert_eq!(jwk_thumbprint("ML-DSA-44", &pub_bytes), KID);
    }

    /// The `kid` is the thumbprint of the composite public key, which `jwk()` (sign side, built from
    /// the keypair via `self.ml.public_key()`) and `describe()` (verify side, built from the parsed
    /// `self.ml`) assemble independently.  Pin that the two agree, so a future change to one
    /// derivation path — e.g. the conformance migration that renames `ALG` and reorders the
    /// concatenation — that isn't mirrored in the other is caught here rather than silently breaking
    /// kid-based key lookup across signer and verifier.
    #[test]
    fn jwk_kid_matches_describe() {
        let sk = SigningKey::generate().unwrap();
        let vk = sk.verifying_key();

        let jwk_kid = sk.jwk()["kid"].as_str().unwrap().to_string();
        // `describe()` is "<ALG> key #<kid>"
        let describe_kid = vk.describe().rsplit_once('#').unwrap().1.to_string();

        assert_eq!(jwk_kid, describe_kid);
    }

    #[test]
    fn sign_verify_and_tamper() {
        let sk = SigningKey::generate().unwrap();
        let vk = sk.verifying_key();
        let message = b"the message to be signed";

        let signature = sk.sign(message).unwrap();
        assert!(vk.is_valid_signature(message, signature.clone()));
        // a different message does not verify
        assert!(!vk.is_valid_signature(b"other message", signature.clone()));

        // flipping a bit in the ML-DSA half (front) breaks verification ...
        let mut ml_tampered = signature.clone();
        ml_tampered[0] ^= 1;
        assert!(!vk.is_valid_signature(message, ml_tampered));

        // ... and so does flipping a bit in the ed25519 half (back): both halves are required.
        let mut ed_tampered = signature;
        *ed_tampered.last_mut().unwrap() ^= 1;
        assert!(!vk.is_valid_signature(message, ed_tampered));
    }

    #[test]
    fn malformed_signature_rejected() {
        let sk = SigningKey::generate().unwrap();
        let vk = sk.verifying_key();
        let message = b"msg";
        let valid = sk.sign(message).unwrap();

        // empty, too short, and too long are all rejected without panicking
        assert!(!vk.is_valid_signature(message, vec![]));
        assert!(!vk.is_valid_signature(message, valid[..valid.len() - 1].to_vec()));
        let mut too_long = valid.clone();
        too_long.push(0);
        assert!(!vk.is_valid_signature(message, too_long));
    }

    #[test]
    fn jwt_roundtrip() {
        let sk = SigningKey::generate().unwrap();
        let vk = sk.verifying_key();

        let token = Claims::new()
            .claim("foo", "bar")
            .unwrap()
            .sign(&sk)
            .unwrap();
        let mut claims = token.open(vk).unwrap();
        assert_eq!(
            claims.extract::<String>("foo").unwrap(),
            Some("bar".to_string())
        );

        // a JWT signed under a different `alg` is rejected by check_alg
        let hs_token = Claims::new().sign(&jwt::HS256(vec![0u8; 32])).unwrap();
        assert!(matches!(
            hs_token.open(vk),
            Err(jwt::Error::UnexpectedAlgorithm { .. })
        ));
    }

    #[test]
    fn signed_roundtrip() {
        #[derive(serde::Serialize, serde::Deserialize, PartialEq, Eq, Debug)]
        struct TestMsg {
            hello: String,
        }
        crate::api::having_message_code! { TestMsg, Example }

        let sk = SigningKey::generate().unwrap();
        let vk = sk.verifying_key();
        let message = TestMsg {
            hello: "world".to_string(),
        };

        let signed =
            crate::api::Signed::<TestMsg>::new(&sk, &message, std::time::Duration::from_secs(60))
                .unwrap();
        assert_eq!(signed.open(vk, None).unwrap(), message);
    }

    #[test]
    fn encode_decode_roundtrip() {
        let sk = SigningKey::generate().unwrap();
        let vk = sk.verifying_key();

        // SigningKeyBytes through serde, then decode → same verifying key (seeds are deterministic).
        let skb: SigningKeyBytes =
            serde_json::from_str(&serde_json::to_string(&sk.encode()).unwrap()).unwrap();
        let sk2 = skb.decode().unwrap();
        assert_eq!(sk2.verifying_key(), vk);

        // VerifyingKeyBytes through serde, then decode → same verifying key.
        let vkb: VerifyingKeyBytes =
            serde_json::from_str(&serde_json::to_string(&vk.encode()).unwrap()).unwrap();
        assert_eq!(vkb, vk.encode());
        let vk2 = vkb.decode().unwrap();
        assert_eq!(&vk2, vk);
    }

    /// Emits a bespoke (`ph-ML-DSA-65-Ed25519`, empty ML-DSA context) test vector — a real compact
    /// JWS plus the verifying key — for the Python hub's cross-implementation verification test
    /// (`pubhubs_hub/modules/pubhubs/tests/test_composite_hhpp.py`).  No official vector exists for
    /// our interim empty-context variant, so we generate one here.  ML-DSA signing is randomised, so
    /// the signature is not reproducible, but the fixed seeds make the verifying key deterministic
    /// and any valid signature verifies.  Ignored by default; regenerate with:
    ///   cargo test --lib dsa::tests::emit_bespoke_test_vector -- --ignored --nocapture
    #[test]
    #[ignore = "regenerates the Python hub fixture; see the doc comment"]
    fn emit_bespoke_test_vector() {
        let sk = SigningKey::from_parts([0x11u8; 32], [0x22u8; 32]).unwrap();
        let vk = sk.verifying_key();

        let jws: String = Claims::new()
            .claim("msg", "bespoke composite test vector")
            .unwrap()
            .sign(&sk)
            .unwrap()
            .into();

        let vector = serde_json::json!({
            "alg": ALG,
            "verifying_key": serde_json::to_value(vk.encode()).unwrap(),
            "jws": jws,
        });
        println!(
            "BESPOKE_VECTOR_BEGIN\n{}\nBESPOKE_VECTOR_END",
            serde_json::to_string_pretty(&vector).unwrap()
        );
    }
}
