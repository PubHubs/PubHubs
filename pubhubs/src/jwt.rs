//! Implements limited JSON Web Token functionality for our purposes.
//!
//! Created to reduce dependencies, and more immediately
//! fix for this bug in rust's ring crate was not yet stable at
//! the time of writing:  <https://github.com/briansmith/ring/issues/1299>

use base64ct::{Base64UrlUnpadded, Encoding as _};

/// Represents a key that can be used to sign a JWT.
pub trait SigningKey {
    /// value for `alg` in the JWT header
    const ALG: &'static str;

    /// The result of signing, e.g. `[u8; 32]`.
    type Signature: AsRef<[u8]>;

    /// Returns a (non-base64-encoded) signature on `s`.
    fn sign(self, s: &str) -> anyhow::Result<Self::Signature>;

    /// Returns JSON Web Key description of the associated public key.
    fn jwk(self) -> serde_json::Value;
}

/// Signs `claims` using `key` yielding a JWT.
pub fn sign<SK: SigningKey>(claims: &impl serde::Serialize, key: SK) -> anyhow::Result<String> {
    let to_be_signed: String = format!(
        "{}.{}",
        Base64UrlUnpadded::encode_string(&serde_json::to_vec(&serde_json::json!({
            "alg": SK::ALG,
        }))?),
        &Base64UrlUnpadded::encode_string(&serde_json::to_vec(claims)?)
    );
    Ok(format!(
        "{}.{}",
        to_be_signed,
        Base64UrlUnpadded::encode_string(key.sign(&to_be_signed)?.as_ref())
    ))
}

/// Implements signing JWTs using ed25519, See RFC8037.
///
/// ```
/// use pubhubs::jwt::SigningKey;
/// use ed25519_dalek::Keypair;
/// use base64ct::{Base64UrlUnpadded, Encoding as _};
///
/// let privk = r#"9d 61 b1 9d ef fd 5a 60 ba 84 4a f4 92 ec 2c c4
///                44 49 c5 69 7b 32 69 19 70 3b ac 03 1c ae 7f 60"#;
/// let pubk = r#"d7 5a 98 01 82 b1 0a b7 d5 4b fe d3 c9 64 07 3a
///               0e e1 72 f3 da a6 23 25 af 02 1a 68 f7 07 51 1a"#;
/// let mut kphex = format!("{} {}", privk, pubk);
/// kphex.retain(|c| !c.is_whitespace());
/// println!("{}", kphex);
/// let kpbytes = base16ct::lower::decode_vec(kphex.as_bytes()).unwrap();
/// let kp = Keypair::from_bytes(&kpbytes).unwrap();
///
/// // See "A.4 Ed25519 Signing" from RFC8037.
/// assert_eq!(
///     Base64UrlUnpadded::encode_string(&SigningKey::sign(&kp,
///             &"eyJhbGciOiJFZERTQSJ9.RXhhbXBsZSBvZiBFZDI1NTE5IHNpZ25pbmc"
///         ).unwrap().as_ref()
///     ),
///     "hgyY0il_MGCjP0JzlnLWG1PPOt7-09PGcvMg3AIbQR6dWbhijcNR4ki4iylGjg5BhVsPt9g7sVvpAr_MuM0KAg");
///
/// // See "A.3 JWK Thumbprint Canonicalization" from RFC8037.
/// assert_eq!(kp.jwk(), serde_json::json!({
///     "kty": "OKP",
///     "alg": "EdDSA",
///     "crv": "Ed25519",
///     "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
///     "use": "sig",
/// }));
/// ```
impl SigningKey for &ed25519_dalek::Keypair {
    const ALG: &'static str = "EdDSA";
    type Signature = ed25519_dalek::Signature;

    fn sign(self, s: &str) -> anyhow::Result<ed25519_dalek::Signature> {
        Ok(ed25519_dalek::Signer::sign(self, s.as_bytes()))
    }

    fn jwk(self) -> serde_json::Value {
        serde_json::json!({
            "kty": "OKP", // not "EC", see RFC8037, Section 2.
            "alg": Self::ALG,
            "crv": "Ed25519",
            "x": Base64UrlUnpadded::encode_string(self.public.as_ref()),
            // parameter "d" must NOT be included, being the private key
            "use": "sig",
        })
    }
}
