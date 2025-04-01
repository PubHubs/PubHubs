//! Tools for dealing with yivi.
use std::cell::OnceCell;

use anyhow::Context as _;
use serde::{
    self,
    de::{Error as _, IntoDeserializer as _},
    ser::Error as _,
    Deserialize as _, Serialize as _,
};

use crate::misc::jwt;

/// A session request sent by a requestor to a yivi server
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct SessionRequest {
    #[serde(rename = "@context")]
    context: LdContext,

    /// <https://pkg.go.dev/github.com/privacybydesign/irmago#DisclosureRequest>
    disclose: Option<AttributeConDisCon>,
}

impl SessionRequest {
    pub fn disclosure(cdc: AttributeConDisCon) -> SessionRequest {
        Self {
            context: LdContext::Disclosure,
            disclose: Some(cdc),
        }
    }

    /// Signs this session request using the provided requestor credentials.
    ///
    /// Documentation: <https://docs.yivi.app/session-requests/#jwts-signed-session-requests>
    /// Reference code for disclosure request:
    ///     <https://github.com/privacybydesign/irmago/blob/d389b4559e007a0fcb4e78d1f6e073c1ad57bc13/requests.go#L957>
    pub fn sign(self, creds: &Credentials<SigningKey>) -> anyhow::Result<jwt::JWT> {
        creds
            .key
            .sign(
                &jwt::Claims::new()
                    .iat_now()?
                    .claim("iss", &creds.name)? // issuer is requestor name
                    .claim("sub", self.context.jwt_sub())?
                    .claim(self.context.jwt_key(), self)?,
            )
            .context("signing session request")

        // NOTE: the jwt library irmago uses adds a `"typ": "JWT"` to the header,
        // but its presence is not checked, so we omit it.
    }

    /// Mocks a valid [`SessionResult`] to this [`SessionRequest`] disclosing
    /// the values specified by the `df` function.
    ///
    /// Only simple disclosure requests not involving any 'discon's are currently supported.
    ///
    /// # Panics
    ///  - If `self` is not a disclosure request, or is missing the `disclosure` field.
    ///  - If one of the 'discon's is empty, or not a singleton.
    pub fn mock_disclosure_response(
        &self,
        df: impl Fn(&AttributeTypeIdentifier) -> String,
    ) -> SessionResult {
        assert_eq!(self.context, LdContext::Disclosure);

        let disclosed: Vec<Vec<DisclosedAttribute>> = self
            .disclose
            .as_ref()
            .expect("missing `disclose` field in disclosure session request")
            .iter()
            .map(|dc: &Vec<Vec<AttributeRequest>>| {
                assert_eq!(dc.len(), 1, "'discon's not supported by this mock function");

                let con_req: &Vec<AttributeRequest> = &dc[0];

                let con_resp: Vec<DisclosedAttribute> = con_req
                    .iter()
                    .map(|ar: &AttributeRequest| {
                        DisclosedAttribute::mock(df(&ar.ty), ar.ty.clone())
                    })
                    .collect();

                con_resp
            })
            .collect();

        SessionResult::mock_disclosure(disclosed)
    }
}

/// Some JSON linked data contexts <http://json-ld.org> used by yivi, primarily to identify a
/// session's type.  Not to be confused with [`SessionType`].
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/requests.go#L21>
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum LdContext {
    #[serde(rename = "https://irma.app/ld/request/disclosure/v2")]
    Disclosure,

    #[serde(rename = "https://irma.app/ld/request/signature/v2")]
    Signature,

    #[serde(rename = "https://irma.app/ld/request/issuance/v2")]
    Issuance,
}

impl LdContext {
    /// The `sub` field of a signed session request JWT of this type
    pub const fn jwt_sub(&self) -> &'static str {
        match self {
            LdContext::Disclosure => "verification_request",
            LdContext::Signature => "signature_request",
            LdContext::Issuance => "issue_request",
        }
    }

    /// The key that holds this session request inside a JWT of a signed session request
    pub const fn jwt_key(&self) -> &'static str {
        match self {
            LdContext::Disclosure => "sprequest",
            LdContext::Signature => "absrequest",
            LdContext::Issuance => "iprequest",
        }
    }
}

/// <https://pkg.go.dev/github.com/privacybydesign/irmago#AttributeConDisCon>
pub type AttributeConDisCon = Vec<Vec<Vec<AttributeRequest>>>;

/// <https://pkg.go.dev/github.com/privacybydesign/irmago#AttributeRequest>
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct AttributeRequest {
    #[serde(rename = "type")] // 'type' is a keyword
    pub ty: AttributeTypeIdentifier,
}

/// Credentials (name and key) for a requestor or yivi server.
///
/// Use [`Credentials<SigningKey>`] or [`Credentials<VerifyingKey>`].
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Credentials<K> {
    pub name: String,
    pub key: K,
}

/// Private key used by a requestor or yivi server to sign their JWTs.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub enum SigningKey {
    #[serde(rename = "hs256")]
    HS256(jwt::HS256),
    // We do not use the `Token`  Yivi `auth_method`s,
    // see: https://docs.yivi.app/irma-server#requestor-authentication
    #[serde(rename = "rs256")]
    RS256(#[serde(with = "rs256sk_encoding")] Box<jwt::RS256Sk>),
}

/// We encode the RS256 private key using the PEM-encoded PKCS #8 format
mod rs256sk_encoding {
    use super::*;

    pub fn deserialize<'de, D>(d: D) -> Result<Box<jwt::RS256Sk>, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s: &'de str = <&'de str>::deserialize(d)?;

        Ok(Box::new(
            jwt::RS256Sk::from_pkcs8_pem(s).map_err(D::Error::custom)?,
        ))
    }

    // `serde(with = ...` forces the signature `&Box<...` that clippy does not like
    #[expect(clippy::borrowed_box)]
    pub fn serialize<S>(pk: &Box<jwt::RS256Sk>, s: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        s.serialize_str(&pk.to_pkcs8_pem().map_err(S::Error::custom)?)
    }
}

impl SigningKey {
    /// Sign the given claims using this key.
    ///
    /// Note that [`SigningKey`] cannot implement [`jwt::Key`] because [`SigningKey`]
    /// supports multiple algorithms.
    fn sign<C: serde::Serialize>(&self, claims: &C) -> Result<jwt::JWT, jwt::Error> {
        match self {
            SigningKey::HS256(key) => jwt::JWT::create(claims, key),
            SigningKey::RS256(key) => jwt::JWT::create(claims, &**key),
        }
    }

    pub fn to_verifying_key(&self) -> VerifyingKey {
        match self {
            SigningKey::HS256(key) => VerifyingKey::HS256(key.clone()),
            SigningKey::RS256(key) => {
                VerifyingKey::RS256(jwt::RS256Vk::new(key.as_rsa_pub().clone()))
            }
        }
    }
}

/// Public key used by a requestor or yivi server to sign their JWTs.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub enum VerifyingKey {
    #[serde(rename = "hs256")]
    HS256(jwt::HS256),

    #[serde(rename = "rs256")]
    RS256(#[serde(with = "rs256vk_encoding")] jwt::RS256Vk),
    // We do not use the `Token` Yivi `auth_method`s,
    // see: https://docs.yivi.app/irma-server#requestor-authentication
}

/// We encode the RS256 public key using the PEM-encoded PKCS #8 format
mod rs256vk_encoding {
    use super::*;

    pub fn deserialize<'de, D>(d: D) -> Result<jwt::RS256Vk, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s: &'de str = <&'de str>::deserialize(d)?;

        jwt::RS256Vk::from_public_key_pem(s).map_err(D::Error::custom)
    }

    pub fn serialize<S>(pk: &jwt::RS256Vk, s: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        s.serialize_str(&pk.to_public_key_pem().map_err(S::Error::custom)?)
    }
}

impl VerifyingKey {
    /// Open the given jwt using this key
    fn open(&self, jwt: &jwt::JWT) -> Result<jwt::Claims, jwt::Error> {
        match self {
            VerifyingKey::HS256(key) => jwt::JWT::open(jwt, key),
            VerifyingKey::RS256(key) => jwt::JWT::open(jwt, key),
        }
    }
}

/// Result of a Yivi session
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/server/api.go#L37>
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct SessionResult {
    pub token: RequestorToken,
    pub status: Status,

    #[serde(rename = "type")]
    pub session_type: SessionType,

    #[serde(rename = "proofStatus")]
    pub proof_status: Option<ProofStatus>,

    pub disclosed: Option<Vec<Vec<DisclosedAttribute>>>,

    // "signature" field: not used by us (yet)
    pub error: Option<RemoteError>,

    #[serde(rename = "nextSession")]
    pub next_session: Option<RequestorToken>,
}

impl SessionResult {
    /// Creates a mock session result containing the specified disclosed attributes
    fn mock_disclosure(disclosed: Vec<Vec<DisclosedAttribute>>) -> SessionResult {
        SessionResult {
            token: "1234567890abcdefghij".parse().unwrap(),
            status: Status::Done,
            session_type: SessionType::Disclosing,
            proof_status: Some(ProofStatus::Valid),
            disclosed: Some(disclosed),
            error: None,
            next_session: None,
        }
    }
}

impl SessionResult {
    /// Signs this session result using the provided yivi server credentials.
    ///
    /// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/server/api.go#L326>
    pub fn sign(
        self,
        creds: &Credentials<SigningKey>,
        validity: std::time::Duration,
    ) -> anyhow::Result<jwt::JWT> {
        creds
            .key
            .sign(
                &jwt::Claims::from_custom(&self)?
                    .iat_now()?
                    .exp_after(validity)?
                    .claim("iss", &creds.name)? // issuer is server name
                    .claim("sub", self.session_type.to_result_sub())?,
            )
            .context("signing session result")
    }

    /// Opens the given signed [`SessionResult`].
    pub fn open_signed(
        jwt: &jwt::JWT,
        server_credentials: &Credentials<VerifyingKey>,
    ) -> anyhow::Result<Self> {
        let mut session_type_perhaps: Option<SessionType> = None;

        let session_result: Self = server_credentials
            .key
            .open(jwt)
            .context("invalid jwt")?
            .check_iss(jwt::expecting::exactly(&server_credentials.name))?
            .check_sub(
                |claim_name: &'static str, sub: Option<String>| -> Result<(), jwt::Error> {
                    let sub = sub.ok_or_else(|| jwt::Error::MissingClaim(claim_name))?;

                    assert!(
                        session_type_perhaps
                            .replace(SessionType::from_result_sub(&sub).map_err(|err| {
                                jwt::Error::InvalidClaim {
                                    claim_name,
                                    source: err,
                                }
                            })?)
                            .is_none(),
                        "bug: did not expect to set session_type twice"
                    );

                    Ok(())
                },
            )?
            .into_custom()?;

        let session_type = session_type_perhaps.expect("bug: expected session_type to be set here");

        anyhow::ensure!(
            session_result.session_type == session_type,
            "session result jwt subject, {}, does not align with session result type, {}",
            session_type,
            session_result.session_type
        );

        Ok(session_result)
    }

    /// Verifies that this [`SessionResult`] is valid.
    fn validate(&self) -> anyhow::Result<()> {
        anyhow::ensure!(
            self.status == Status::Done,
            "session status is not 'done', but {}",
            self.status
        );

        if let Some(proof_status) = self.proof_status {
            anyhow::ensure!(
                proof_status == ProofStatus::Valid,
                "session proof status is not 'valid', but {}",
                proof_status
            );
        }

        if let Some(error) = &self.error {
            anyhow::bail!(
                "session result error field set: {}",
                serde_json::to_string(&error).unwrap_or_else(|_| "<ERROR SERIALIZING>".to_string()),
            );
        }

        if let Some(disclosed) = &self.disclosed {
            for (i, con) in disclosed.iter().enumerate() {
                for (j, dattr) in con.iter().enumerate() {
                    dattr.validate().with_context(|| {
                        format!(
                        "something is wrong with disclosed attribute number {i} sub {j} of type {}",
                        dattr.id,
                    )
                    })?;
                }
            }
        }

        Ok(())
    }
}

/// Disclosure of a single attribute
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/verify.go#L36>
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct DisclosedAttribute {
    #[serde(rename = "rawvalue")]
    pub raw_value: String,

    // NB: The field "value" (containing translations of the attribute) we don't use
    /// The type of the disclosed attibute
    pub id: AttributeTypeIdentifier,

    pub status: AttributeProofStatus,

    #[serde(rename = "issuancetime")]
    pub issuance_time: jwt::NumericDate,

    #[serde(rename = "notrevoked")]
    pub not_revoked: Option<bool>,

    #[serde(rename = "notrevokedbefore")]
    pub not_revoked_before: Option<jwt::NumericDate>,
}

impl DisclosedAttribute {
    fn mock(raw_value: String, id: AttributeTypeIdentifier) -> Self {
        Self {
            raw_value,
            id,
            status: AttributeProofStatus::Present,
            issuance_time: jwt::NumericDate::now(),
            not_revoked: None,
            not_revoked_before: None,
        }
    }

    /// Verifies that this [`DisclosedAttribute`] is valid.
    fn validate(&self) -> anyhow::Result<()> {
        anyhow::ensure!(
            self.status == AttributeProofStatus::Present,
            "proof status is not 'present'"
        );

        if self.not_revoked == Some(false) {
            anyhow::bail!("attribute is revoked");
        }

        if let Some(not_revoked_before) = self.not_revoked_before {
            if jwt::NumericDate::now() > not_revoked_before {
                anyhow::bail!("attribute is (presumably) revoked after {not_revoked_before}");
            }
        }

        Ok(())
    }
}

/// Identifier for a yivi session used in requestor endpoints
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/messages.go#L179>
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Eq, PartialEq)]
#[serde(transparent)]
pub struct RequestorToken {
    #[serde(deserialize_with = "RequestorToken::deserialize_inner")]
    inner: String,
}

/// The regex pattern for a [`RequestorToken`]
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/internal/common/common.go#L39>
const REQUESTOR_TOKEN_REGEX: &str = r"^[a-z0-9A-Z]{20}$";

thread_local! {
    /// Thread local compiled version of [`REQUESTOR_TOKEN_REGEX`]
    static REQUESTOR_TOKEN_REGEX_TLK: OnceCell<regex::Regex> = const { OnceCell::new() };
}

/// Runs `f` with as argument a reference to a compiled [REQUESTOR_TOKEN_REGEX]
/// that is cached thread locally.
fn with_requestor_token_regex<R>(f: impl FnOnce(&regex::Regex) -> R) -> R {
    REQUESTOR_TOKEN_REGEX_TLK.with(|oc: &OnceCell<regex::Regex>| {
        f(oc.get_or_init(|| regex::Regex::new(REQUESTOR_TOKEN_REGEX).unwrap()))
    })
}

impl RequestorToken {
    fn deserialize_inner<'de, D>(d: D) -> Result<String, D::Error>
    where
        D: serde::de::Deserializer<'de>,
    {
        let inner: String = String::deserialize(d)?;

        Self::validate_inner(&inner).map_err(D::Error::custom)?;

        Ok(inner)
    }

    /// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/internal/common/common.go#L39>
    fn validate_inner(inner: &str) -> anyhow::Result<()> {
        if !with_requestor_token_regex(|r: &regex::Regex| r.is_match(inner)) {
            anyhow::bail!(
                "invalid yivi requestor token: did not match regex {}",
                REQUESTOR_TOKEN_REGEX
            );
        }
        Ok(())
    }
}

impl std::str::FromStr for RequestorToken {
    type Err = anyhow::Error;

    fn from_str(inner: &str) -> Result<Self, Self::Err> {
        Self::validate_inner(inner)?;
        Ok(Self {
            inner: inner.to_string(),
        })
    }
}

/// Identifier for a yivi attribute type, to us a string with three dots ('.').
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/identifiers.go#L60>
///
/// # Identifying credentials
/// Yivi also permits attribute type identifiers with two dots, which refer to credentials, see
/// for example:
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/requests.go#L382>
///
/// We don't.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Eq, PartialEq)]
#[serde(transparent)]
pub struct AttributeTypeIdentifier {
    #[serde(deserialize_with = "AttributeTypeIdentifier::deserialize_inner")]
    inner: String,
}

impl AttributeTypeIdentifier {
    fn deserialize_inner<'de, D>(d: D) -> Result<String, D::Error>
    where
        D: serde::de::Deserializer<'de>,
    {
        let inner: String = String::deserialize(d)?;

        Self::validate_inner(&inner).map_err(D::Error::custom)?;

        Ok(inner)
    }

    /// Checks that the given string contains three dots ('.').
    fn validate_inner(inner: &str) -> anyhow::Result<()> {
        let dot_count: usize = inner.chars().filter(|c: &char| *c == '.').count();

        if dot_count == 2 {
            anyhow::bail!("we do not support yivi attribute identifiers with two dots");
        }

        anyhow::ensure!(
            dot_count == 3,
            "invalid yivi attribute type identifier: does not contain three dots"
        );

        Ok(())
    }

    /// Returns reference to underlying [`str`].
    pub fn as_str(&self) -> &str {
        &self.inner
    }
}

impl std::str::FromStr for AttributeTypeIdentifier {
    type Err = anyhow::Error;

    fn from_str(inner: &str) -> Result<Self, Self::Err> {
        Self::validate_inner(inner)?;
        Ok(Self {
            inner: inner.to_string(),
        })
    }
}

impl std::fmt::Display for AttributeTypeIdentifier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.inner.fmt(f)
    }
}

/// Error type that may be part of a session result
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/messages.go#L119>
#[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct RemoteError {
    pub status: Option<u64>,
    pub error: Option<String>,
    pub description: Option<String>,
    pub message: Option<String>,
    pub stacktrace: Option<String>,
}

/// Proof status of an entire session
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/verify.go#L23>
#[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all_fields = "SCREAMING_SNAKE_CASE")]
pub enum ProofStatus {
    Valid,
    Invalid,
    InvalidTimestamp,
    UnmatchedRequest,
    MissingAttributes,
    Expired,
}

impl std::fmt::Display for ProofStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.serialize(f)
    }
}

/// Status of a yivi session
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/messages.go#L216>
#[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all_fields = "SCREAMING_SNAKE_CASE")]
pub enum Status {
    Done,
    Pairing,
    Connected,
    Cancelled,
    Timeout,
    Initialized,
}

impl std::fmt::Display for Status {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.serialize(f)
    }
}

/// Proof status of a single yivi attribute
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/verify.go#L30>
#[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all_fields = "SCREAMING_SNAKE_CASE")]
pub enum AttributeProofStatus {
    Present,
    Extra,
    Null,
}

/// Session type
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/messages.go#L227>
#[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum SessionType {
    Disclosing,
    Signing,
    Issuing,
    Redirect,
    Revoking,
    Unknown,
}

impl std::fmt::Display for SessionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.serialize(f)
    }
}

impl std::str::FromStr for SessionType {
    type Err = serde::de::value::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::deserialize(s.into_deserializer())
    }
}

impl SessionType {
    /// Inverse of [`SessionType::to_result_sub`].
    fn from_result_sub(sub: &str) -> anyhow::Result<Self> {
        let stripped_sub = sub
            .strip_suffix("_result")
            .ok_or_else(|| anyhow::anyhow!("subject did not end with '_result'"))?;

        stripped_sub.parse().context("unknown session type")
    }

    /// Returns the `sub` value used for this session type in signed session result JWTs.
    fn to_result_sub(self) -> String {
        format!("{}_result", self)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use std::str::FromStr as _;

    #[test]
    fn requestor_token() {
        let r1: RequestorToken = "1234567890abcdefghij".parse().unwrap();
        let r2: RequestorToken = serde_json::from_str("\"1234567890abcdefghij\"").unwrap();
        assert_eq!(r1, r2);

        assert!(RequestorToken::from_str("1234567890 abcdefghij").is_err());
    }

    #[test]
    fn attribute_type_identifier() {
        let ati = serde_json::from_str::<AttributeTypeIdentifier>("\"a.b.c.d\"").unwrap();
        assert_eq!(serde_json::to_string(&ati).unwrap(), "\"a.b.c.d\"");
        assert!(serde_json::from_str::<AttributeTypeIdentifier>("\"a.b.c\"").is_err());
    }
}
