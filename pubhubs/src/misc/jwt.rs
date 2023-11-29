//! Implements limited JSON Web Token functionality for our purposes.
//!
//! Created to reduce dependencies, and more immediately
//! fix for this bug in rust's ring crate was not yet stable at
//! the time of writing:  <https://github.com/briansmith/ring/issues/1299>

use std::borrow::Cow;
use std::fmt;

use base64ct::{Base64UrlUnpadded, Encoding as _};
use hmac::Mac as _;
use serde::{
    de::{DeserializeOwned, Visitor},
    Deserialize, Deserializer, Serialize,
};

use crate::misc::time_ext;

/// Wrapper around [String] to indicate it should be interpretted as a JWT.
#[derive(Serialize, Deserialize, Debug)]
#[serde(transparent)]
pub struct JWT {
    inner: String,
}

/// Represents a set of claims made by a JWT.
#[derive(Debug, Clone)]
pub struct Claims {
    inner: serde_json::Map<String, serde_json::Value>,
}

impl Claims {
    /// Checks that the claim with `name` meets the given `expectation`, and removes it from the
    /// set.  The [Deserializer] is given ownership of the claim's contents, so for `V` you
    /// probably want to use an owned type like [String] instead of [&str].
    pub fn check<'s, V: Deserialize<'s>>(
        mut self,
        name: &'static str,
        expectation: impl FnOnce(Option<V>) -> Result<(), Error>,
    ) -> Result<Self, Error> {
        let value: Option<V> = self
            .inner
            .remove(name)
            .map(V::deserialize)
            .transpose()
            .map_err(|err| Error::DeserializingClaim {
                claim_name: name,
                source: err,
            })?;

        expectation(value)?;

        Ok(self)
    }

    /// Checks that there is no claim with `name`.
    pub fn check_no(self, name: &'static str) -> Result<Self, Error> {
        if self.inner.contains_key(name) {
            return Err(Error::UnexpectedClaim(name));
        }

        Ok(self)
    }

    /// Removes named claim from this set, if present, effectively ignoring it.
    pub fn ignore(mut self, name: &'static str) -> Self {
        self.inner.remove(name);
        self
    }

    /// [Self::check] for `iss` claim.
    pub fn check_iss(
        self,
        expectation: impl FnOnce(Option<String>) -> Result<(), Error>,
    ) -> Result<Self, Error> {
        self.check("iss", expectation)
    }

    /// [Self::check] for `sub` claim.
    pub fn check_sub(
        self,
        expectation: impl FnOnce(Option<String>) -> Result<(), Error>,
    ) -> Result<Self, Error> {
        self.check("sub", expectation)
    }

    /// Checks timestamps `iat`, `exp` and `nbf`. When present they should be a valid
    /// [NumericDate], and the current moment should be between `nbf` and `exp`.
    pub fn default_check_timestamps(self) -> Result<Self, Error> {
        let now = NumericDate::now();

        self.check("iat", |_iat: Option<NumericDate>| -> Result<(), Error> {
            // When it is present, iat should be a valid NumericData, but it is otherwise ignored.
            Ok(())
        })?
        .check("exp", |exp: Option<NumericDate>| -> Result<(), Error> {
            // When `exp` is present, it should not be expired.
            if let Some(exp) = exp {
                if exp < now {
                    return Err(Error::Expired { when: exp });
                }
            }

            Ok(())
        })?
        .check("nbf", |nbf: Option<NumericDate>| -> Result<(), Error> {
            // When `nbf` is present, it should be in the past.
            if let Some(nbf) = nbf {
                if now < nbf {
                    return Err(Error::NotYetValid { valid_from: nbf });
                }
            }

            Ok(())
        })
    }

    /// Checks and removes `iat`, `exp`, and `nbf`, and makes sure
    /// `sub` and `iss` have already been checked (i.e. are no longer present).
    pub fn default_check_common_claims(self) -> Result<Self, Error> {
        self.default_check_timestamps()?
            .check_no("iss")?
            .check_no("sub")
    }

    /// Deserializes remaining, custom, claims into a type `C` and calls the given `visitor` function on it.
    ///
    /// Will call [Claims::default_check_common_claims] first, checking `iat`, etc..
    ///
    /// We can, in general, not return `C` directly, because `C` might borrow from the
    /// [Deserializer].
    ///
    /// For the caller's convenience, we pass along anything that's returned by the visitor.
    ///
    /// Consumes `self` to prevent deserializing to `C` twice.
    pub fn visit_custom<C: DeserializeOwned, R>(
        self,
        visitor: impl FnOnce(C) -> R,
    ) -> Result<R, Error> {
        // we check common claims to ensure they are not ignored
        let self_ = self.default_check_common_claims()?;

        let claims: C = C::deserialize(&serde_json::Value::Object(self_.inner))
            .map_err(Error::DeserializingClaims)?;

        Ok(visitor(claims))
    }

    /// Like [Self::visit_custom], but returns `C` (which is not possible when `C` borrows from its
    /// [Deserializer].)
    pub fn into_custom<C: DeserializeOwned>(self) -> Result<C, Error> {
        self.visit_custom(|c| c)
    }

    /// Creates new [Claims] from an object that serializes to a json map.
    pub fn from_custom<C: Serialize>(claims: C) -> Result<Self, Error> {
        let json_value = serde_json::to_value(claims).map_err(Error::SerializingClaims)?;

        let inner = if let serde_json::Value::Object(inner) = json_value {
            inner
        } else {
            return Err(Error::ClaimsDontSerializeToMap);
        };

        Ok(Self { inner })
    }

    /// Adds the named claim with the given value.  Returns an error when a claim with the same
    /// name was already present.
    pub fn claim<V: Serialize>(mut self, name: &'static str, value: V) -> Result<Self, Error> {
        let old_value = self.inner.insert(
            name.to_string(),
            serde_json::to_value(value).map_err(|err| Error::SerializingClaim {
                claim_name: name,
                source: err,
            })?,
        );

        if old_value.is_some() {
            return Err(Error::ClaimAlreadyPresent(name));
        }

        Ok(self)
    }

    /// Adds the `iat` claim using the current timestamp
    pub fn iat_now(self) -> Result<Self, Error> {
        self.claim("iat", NumericDate::now())
    }

    /// Sets `exp` claim such that the jwt is valid for the given `duration`.
    pub fn exp_after(self, duration: std::time::Duration) -> Result<Self, Error> {
        self.claim("exp", NumericDate::now() + duration)
    }

    /// Sets `nbf` to the current timestamp, minus 30 seconds leeway.
    pub fn nbf(self) -> Result<Self, Error> {
        self.claim("nbf", NumericDate::now() - 30)
    }
}

/// Represents the value of the `iat`, `exp`, `nbf` claims.
///
/// According to RFC7519, it should be:
///
/// "A JSON numeric value representing the number of seconds from
/// 1970-01-01T00:00:00Z UTC until the specified UTC date/time,
/// ignoring leap seconds.  This is equivalent to the IEEE Std 1003.1,
/// 2013 Edition [POSIX.1] definition "Seconds Since the Epoch", in
/// which each day is accounted for by exactly 86400 seconds, other
/// than that non-integer values can be represented."
///
/// But contrary to this, we will reject negative timestamps with an error,
/// and silently round down non-negative decimals to the nearest u64.
#[derive(Serialize, Default, Clone, Copy, Eq, PartialEq, Debug, PartialOrd, Ord)]
#[serde(transparent)]
pub struct NumericDate {
    timestamp: u64,
}

impl NumericDate {
    /// Creates a new numeric date from the given `timestamp`, the  number of seconds since the
    /// unix epoch ignoring leap seconds.
    fn new(timestamp: u64) -> Self {
        Self { timestamp }
    }

    /// Creates a numeric date representing the current moment
    fn now() -> Self {
        Self::new(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system clock reports a time before the Unix epoch")
                .as_secs(),
        )
    }
}

impl From<&NumericDate> for std::time::SystemTime {
    fn from(nd: &NumericDate) -> Self {
        std::time::UNIX_EPOCH + std::time::Duration::from_secs(nd.timestamp)
    }
}

impl fmt::Display for NumericDate {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", time_ext::format_time(self.into()))
    }
}

impl<'de> Deserialize<'de> for NumericDate {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        d.deserialize_u64(NumericDateVisitor {})
    }
}

/// [Visitor] for the implementation of [Deserialize] for [NumericDate].
struct NumericDateVisitor {}

impl<'de> Visitor<'de> for NumericDateVisitor {
    type Value = NumericDate;

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "a non-negative number")
    }

    fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<Self::Value, E> {
        Ok(NumericDate::new(v))
    }

    fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Self::Value, E> {
        if v < 0 {
            return Err(E::invalid_value(serde::de::Unexpected::Signed(v), &self));
        }

        self.visit_u64(v as u64)
    }

    fn visit_f64<E: serde::de::Error>(self, v: f64) -> Result<Self::Value, E> {
        if v < 0.0 {
            return Err(E::invalid_value(serde::de::Unexpected::Float(v), &self));
        }

        self.visit_u64(v as u64)
    }

    // NOTE: u/i128 are not supported by serde_json by default
}

impl core::ops::Add<std::time::Duration> for NumericDate {
    type Output = Self;

    fn add(self, duration: std::time::Duration) -> Self::Output {
        self + duration.as_secs()
    }
}

impl core::ops::Add<u64> for NumericDate {
    type Output = Self;

    fn add(mut self, secs: u64) -> Self::Output {
        self.timestamp = secs;
        self
    }
}

impl core::ops::Sub<u64> for NumericDate {
    type Output = Self;

    fn sub(mut self, secs: u64) -> Self::Output {
        self.timestamp -= secs;
        self
    }
}

impl From<String> for JWT {
    fn from(s: String) -> Self {
        Self { inner: s }
    }
}

impl JWT {
    /// Creates JWT from `claims` and [SigningKey] `key`.
    pub fn create<C: Serialize, SK: SigningKey>(claims: &C, key: &SK) -> Result<JWT, Error> {
        let to_be_signed: String = format!(
            "{}.{}",
            Base64UrlUnpadded::encode_string(
                &serde_json::to_vec(&serde_json::json!({
                    "alg": SK::ALG,
                }))
                .map_err(Error::SerializingHeader)?
            ),
            &Base64UrlUnpadded::encode_string(
                &serde_json::to_vec(claims).map_err(Error::SerializingClaims)?
            )
        );
        Ok(JWT::from(format!(
            "{}.{}",
            to_be_signed,
            Base64UrlUnpadded::encode_string(
                key.sign(to_be_signed.as_bytes())
                    .map_err(Error::Signing)?
                    .as_ref()
            )
        )))
    }

    /// Checks the validity of this jwt against the given [VerifyingKey] `key`, and the JSON syntax
    /// of the claims.  Does not check the validity of the claims itself.
    pub fn open<VK: VerifyingKey>(&self, key: &VK) -> Result<Claims, Error> {
        let s = &self.inner;

        let last_dot_pos: usize = s.rfind('.').ok_or(Error::MissingDot)?;
        let signed: &str = &s[..last_dot_pos];
        let first_dot_pos: usize = signed.find('.').ok_or(Error::MissingDot)?;

        // check header
        let header_vec: Vec<u8> =
            Base64UrlUnpadded::decode_vec(&s[..first_dot_pos]).map_err(Error::InvalidBase64)?;

        let header: Header =
            serde_json::from_slice(&header_vec).map_err(Error::DeserializingHeader)?;

        VK::check_alg(&header.alg)?;

        // check signature
        let signature: Vec<u8> =
            Base64UrlUnpadded::decode_vec(&s[last_dot_pos + 1..]).map_err(Error::InvalidBase64)?;

        if !key.is_valid_signature(signed.as_bytes(), signature) {
            return Err(Error::InvalidSignature);
        }

        // decode claims
        let claims_vec: Vec<u8> = Base64UrlUnpadded::decode_vec(&signed[first_dot_pos + 1..])
            .map_err(Error::InvalidBase64)?;

        let mut d = serde_json::Deserializer::from_slice(&claims_vec);

        Ok(Claims {
            inner: serde_json::Map::<String, serde_json::Value>::deserialize(&mut d)
                .map_err(Error::ClaimsNotJsonMap)?,
        })
    }
}

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("failed to serialize jwt header")]
    SerializingHeader(#[source] serde_json::Error),

    #[error("invalid jwt header")]
    DeserializingHeader(#[source] serde_json::Error),

    #[error("failed to serialize jwt claims")]
    SerializingClaims(#[source] serde_json::Error),

    #[error("failed to serialize claim {claim_name}")]
    SerializingClaim {
        claim_name: &'static str,
        source: serde_json::Error,
    },

    #[error("claim {0} already present")]
    ClaimAlreadyPresent(&'static str),

    #[error("claims are not a valid json map")]
    ClaimsNotJsonMap(#[source] serde_json::Error),

    #[error("the given custom claims do not serialize to a json map")]
    ClaimsDontSerializeToMap,

    #[error("invalid jwt claims")]
    DeserializingClaims(#[source] serde_json::Error),

    #[error("failed to deserialize claim {claim_name}")]
    DeserializingClaim {
        claim_name: &'static str,
        source: serde_json::Error,
    },

    #[error("jwt contains unexpected/unhandled claim `{0}`")]
    UnexpectedClaim(&'static str),

    #[error("expired at {when}")]
    Expired { when: NumericDate },

    #[error("only valid after {valid_from}")]
    NotYetValid { valid_from: NumericDate },

    #[error("signing jwt failed")]
    Signing(#[source] anyhow::Error),

    #[error("missing dot (.) in jwt (there should be two dots)")]
    MissingDot,

    #[error("jwt contains invalid unpadded urlsafe base64")]
    InvalidBase64(#[source] base64ct::Error),

    #[error("jwt signature is not valid (for this key)")]
    InvalidSignature,

    #[error("unexpected algorithm; got {got}, but expected {expected}")]
    UnexpectedAlgorithm { got: String, expected: &'static str },
}

/// Signs `claims` using `key` yielding a JWT.
//#[deprecated(note = "use JWT::create instead")] // TODO: reinstate
pub fn sign<SK: SigningKey>(claims: &impl Serialize, key: &SK) -> anyhow::Result<String> {
    Ok(JWT::create(claims, key)?.inner)
}

/// Gets the number of seconds since the Unix epoch,
/// which is an appropriate value for the "iat" field.
pub fn get_current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock reports a time before the Unix epoch")
        .as_secs()
}

/// Represents a JWT header.
#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]
struct Header<'a> {
    #[serde(
        rename = "typ",
        skip_serializing, // don't include 'typ' when serializing
        default // so 'typ' is optional
    )]
    _typ: HeaderType,

    #[serde(borrow)]
    alg: Cow<'a, str>,
    // Add fields here when needed
}

/// Used to check that the `typ` field of the jwt header equals `JWT` (modulo case).
#[derive(Default, Debug)]
struct HeaderType {}

impl<'de> Deserialize<'de> for HeaderType {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        d.deserialize_str(HeaderType {})
    }
}

impl<'de> Visitor<'de> for HeaderType {
    type Value = Self;

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "the string \"JWT\" as \"typ\"")
    }

    fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
        if "JWT".eq_ignore_ascii_case(v) {
            return Ok(self);
        }

        return Err(E::invalid_value(serde::de::Unexpected::Str(v), &self));
    }
}

/// Represents a key that can be used to sign a JWT.
pub trait SigningKey: Key {
    /// The result of signing, e.g. `[u8; 32]`.
    type Signature: AsRef<[u8]>;

    /// Returns a (non-base64-encoded) signature on `s`.
    fn sign(&self, s: &[u8]) -> anyhow::Result<Self::Signature>;

    /// Returns JSON Web Key description of the associated public key.
    fn jwk(&self) -> serde_json::Value;
}

/// Represents a key that can be used to verify the signature on a JWT.
pub trait VerifyingKey: Key {
    /// Verifies signature.
    fn is_valid_signature(&self, message: &[u8], signature: Vec<u8>) -> bool;
}

/// What [SigningKey] and [VerifyingKey] have in common.
pub trait Key {
    /// value for `alg` in the JWT header
    const ALG: &'static str;

    /// Checks that `alg` equals `Self::ALG`.
    ///
    /// This method is overriden by [Hazard_NoKey].
    fn check_alg(alg: &str) -> Result<(), Error> {
        if alg == Self::ALG {
            return Ok(());
        }
        Err(Error::UnexpectedAlgorithm {
            got: alg.to_string(),
            expected: Self::ALG,
        })
    }
}

/// A [VerifyingKey] that neglects to check the signature and `alg` header.
///
/// Useful when the signature on a [JWT] can only be checked later on.
#[allow(non_camel_case_types)]
pub struct IgnoreSignature;

impl Key for IgnoreSignature {
    const ALG: &'static str = "WARNING! This should never appear in the 'alg' field of a JWT.";

    fn check_alg(_alg: &str) -> Result<(), Error> {
        Ok(())
    }
}

impl VerifyingKey for IgnoreSignature {
    fn is_valid_signature(&self, _message: &[u8], _signature: Vec<u8>) -> bool {
        true
    }
}

/// Implements signing JWTs using ed25519, See RFC8037.
///
/// ```
/// use pubhubs::misc::jwt::SigningKey;
/// use base64ct::{Base64UrlUnpadded, Encoding as _};
///
/// let mut privhex : String = r#"9d 61 b1 9d ef fd 5a 60 ba 84 4a f4 92 ec 2c c4
///                44 49 c5 69 7b 32 69 19 70 3b ac 03 1c ae 7f 60"#.into();
/// let mut pubhex : String = r#"d7 5a 98 01 82 b1 0a b7 d5 4b fe d3 c9 64 07 3a
///               0e e1 72 f3 da a6 23 25 af 02 1a 68 f7 07 51 1a"#.into();
/// privhex.retain(|c| !c.is_whitespace());
/// pubhex.retain(|c| !c.is_whitespace());
/// let privkey = base16ct::lower::decode_vec(privhex.as_bytes()).unwrap();
/// let pubkey = base16ct::lower::decode_vec(pubhex.as_bytes()).unwrap();
/// let sk = ed25519_dalek::SigningKey::try_from(privkey.as_slice()).unwrap();
///
/// assert_eq!(sk.verifying_key().to_bytes().as_slice(), pubkey.as_slice());
///
/// // See "A.4 Ed25519 Signing" from RFC8037.
/// assert_eq!(
///     Base64UrlUnpadded::encode_string(&SigningKey::sign(&sk,
///             "eyJhbGciOiJFZERTQSJ9.RXhhbXBsZSBvZiBFZDI1NTE5IHNpZ25pbmc".as_bytes()
///         ).unwrap().as_ref()
///     ),
///     "hgyY0il_MGCjP0JzlnLWG1PPOt7-09PGcvMg3AIbQR6dWbhijcNR4ki4iylGjg5BhVsPt9g7sVvpAr_MuM0KAg");
///
/// // See "A.3 JWK Thumbprint Canonicalization" from RFC8037.
/// assert_eq!(sk.jwk(), serde_json::json!({
///     "kty": "OKP",
///     "alg": "EdDSA",
///     "crv": "Ed25519",
///     "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
///     "use": "sig",
/// }));
/// ```
impl SigningKey for ed25519_dalek::SigningKey {
    type Signature = [u8; 64]; // ed25519_dalek::Signature no longer implements AsRef<[u8]>

    fn sign(&self, s: &[u8]) -> anyhow::Result<[u8; 64]> {
        Ok(ed25519_dalek::Signer::sign(self, s).to_bytes())
    }

    fn jwk(&self) -> serde_json::Value {
        serde_json::json!({
            "kty": "OKP", // not "EC", see RFC8037, Section 2.
            "alg": Self::ALG,
            "crv": "Ed25519",
            "x": Base64UrlUnpadded::encode_string(AsRef::<ed25519_dalek::VerifyingKey>::as_ref(self).as_bytes()),
            // parameter "d" must NOT be included, being the private key
            "use": "sig",
        })
    }
}

impl Key for ed25519_dalek::SigningKey {
    const ALG: &'static str = "EdDSA";
}

/// Key for SHA256 based HMAC
pub struct HS256(pub Vec<u8>);

/// Implements signing of JWTs using the sha256-hmac.
/// ```
/// use pubhubs::misc::jwt::{HS256, SigningKey};
/// use base64ct::{Base64UrlUnpadded, Encoding as _};
///
/// // Example A.1.1 of RFC 7515
/// let key = HS256(Base64UrlUnpadded::decode_vec("AyM1SysPpbyDfgZld3umj1qzKObwVMkoqQ-EstJQLr_T-1qS0gZH75aKtMN3Yj0iPS4hcgUuTwjAzZr1Z9CAow").unwrap().into());
/// let result = key.sign("eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ".as_bytes()).unwrap();
/// assert_eq!(Base64UrlUnpadded::encode_string(&result),
///     "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
/// ```
impl SigningKey for HS256 {
    type Signature = generic_array::GenericArray<u8, typenum::U32>;

    fn sign(&self, s: &[u8]) -> anyhow::Result<generic_array::GenericArray<u8, typenum::U32>> {
        let mut mac = hmac::Hmac::<sha2::Sha256>::new_from_slice(&self.0)?;
        mac.update(s);
        Ok(mac.finalize().into_bytes())
    }

    fn jwk(&self) -> serde_json::Value {
        panic!("HS256 has no public key to describe using JWK");
    }
}

/// ```
/// use pubhubs::misc::jwt::{HS256, VerifyingKey};
/// use base64ct::{Base64UrlUnpadded, Encoding as _};
///
/// // Example A.1.1 of RFC 7515
/// let key = HS256(Base64UrlUnpadded::decode_vec("AyM1SysPpbyDfgZld3umj1qzKObwVMkoqQ-EstJQLr_T-1qS0gZH75aKtMN3Yj0iPS4hcgUuTwjAzZr1Z9CAow").unwrap().into());
/// assert!(key.is_valid_signature("eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ".as_bytes(), Base64UrlUnpadded::decode_vec("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk").unwrap()));
/// ```
impl VerifyingKey for HS256 {
    fn is_valid_signature(&self, message: &[u8], signature: Vec<u8>) -> bool {
        let mut mac = hmac::Hmac::<sha2::Sha256>::new_from_slice(&self.0)
            .expect("expect a sha256 mac to accept a key of any size");
        mac.update(message);
        mac.verify_slice(&signature).is_ok()
    }
}

impl Key for HS256 {
    const ALG: &'static str = "HS256";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jwt() {
        let jwt: JWT = serde_json::from_str("\"eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk\"").unwrap();

        let key = HS256(
            base64ct::Base64UrlUnpadded::decode_vec("AyM1SysPpbyDfgZld3umj1qzKObwVMkoqQ-EstJQLr_T-1qS0gZH75aKtMN3Yj0iPS4hcgUuTwjAzZr1Z9CAow").unwrap(),
        );

        let claims = jwt.open(&key).unwrap();

        assert!(claims
            .clone()
            .into_custom::<serde_json::Value>()
            .unwrap_err()
            .to_string()
            .starts_with("expired at 2011-03-22T18:43:00Z ("));

        assert_eq!(
            &claims
                .clone()
                .ignore("exp")
                .into_custom::<serde_json::Value>()
                .unwrap_err()
                .to_string(),
            "jwt contains unexpected/unhandled claim `iss`"
        );

        #[derive(Deserialize, PartialEq, Eq, Debug)]
        #[serde(deny_unknown_fields)]
        struct Custom {
            #[serde(rename = "http://example.com/is_root")]
            is_root: bool,
        }

        assert_eq!(
            claims
                .clone()
                .ignore("exp")
                .check_iss(|iss: Option<String>| -> Result<(), Error> {
                    assert_eq!(iss, Some("joe".to_string()));
                    Ok(())
                })
                .unwrap()
                .into_custom::<Custom>()
                .unwrap(),
            Custom { is_root: true }
        );
    }

    #[test]
    fn test_header() {
        // no "alg"
        assert_eq!(
            serde_json::from_str::<Header>(r#"{}"#)
                .unwrap_err()
                .to_string(),
            "missing field `alg` at line 1 column 2".to_string()
        );

        // invalid "typ"s
        assert_eq!(
            serde_json::from_str::<Header>(r#"{"typ": "not JWT", "alg": ""}"#)
                .unwrap_err()
                .to_string(),
            "invalid value: string \"not JWT\", expected the string \"JWT\" as \"typ\" at line 1 column 17".to_string()
        );

        assert_eq!(
            serde_json::from_str::<Header>(r#"{"typ": 12,"alg":""}"#)
                .unwrap_err()
                .to_string(),
            "invalid type: integer `12`, expected the string \"JWT\" as \"typ\" at line 1 column 10".to_string()
        );

        // JWT is accepted as "typ", whatever its case
        assert!(serde_json::from_str::<Header>(r#"{"typ": "jWT","alg":""}"#).is_ok());

        // borrowing of "alg" value
        let header_a: Header = serde_json::from_str(r#"{"alg":"borrowed"}"#).unwrap();
        let header_b: Header = serde_json::from_str(r#"{"alg":"owned\u0020"}"#).unwrap();

        assert!(matches!(header_a.alg, Cow::Borrowed(_)));
        assert!(matches!(header_b.alg, Cow::Owned(_)));

        // unknown field
        assert_eq!(
            serde_json::from_str::<Header>(r#"{"alg":"", "unknown_field": ""}"#)
                .unwrap_err()
                .to_string(),
            "unknown field `unknown_field`, expected `typ` or `alg` at line 1 column 26"
                .to_string()
        );
    }

    #[test]
    fn test_numericdate() {
        assert!(NumericDate::deserialize(serde_json::json!(0u64)).is_ok());
        assert!(NumericDate::deserialize(serde_json::json!(0f64)).is_ok());
        assert!(NumericDate::deserialize(serde_json::json!(0f32)).is_ok());
        assert!(NumericDate::deserialize(serde_json::json!(i64::MIN)).is_err());
        assert!(NumericDate::deserialize(serde_json::json!(f32::MIN)).is_err());
        assert!(NumericDate::deserialize(serde_json::json!(f64::MIN)).is_err());
        assert_eq!(
            NumericDate::deserialize(serde_json::json!(1.9))
                .unwrap()
                .timestamp,
            1
        );
    }
}
