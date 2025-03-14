//! Tools for dealing with yivi.
use std::cell::OnceCell;

use anyhow::Context as _;
use serde::{self, de::Error as _, Deserialize as _, Serialize as _};

use crate::misc::{jwt, serde_ext};

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
    pub fn sign(self, creds: &Credentials) -> anyhow::Result<jwt::JWT> {
        Ok(creds
            .key
            .sign(
                &jwt::Claims::new()
                    .iat_now()?
                    .claim("iss", &creds.name)? // issuer is requestor name
                    .claim("sub", self.context.jwt_sub())?
                    .claim(self.context.jwt_key(), self)?,
            )
            .context("signing session request")?)

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

/// Credentials (name and key) for a requestor (or yivi server).
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Credentials {
    pub name: String,
    pub key: SigningKey,
}

/// Private key used by a requestor or yivi server to sign their JWTs.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub enum SigningKey {
    #[serde(rename = "hs256")]
    HS256(serde_ext::bytes_wrapper::B64<jwt::HS256>),
    // We do not use the `Token` or `RS256` Yivi `auth_method`s,
    // see: https://docs.yivi.app/irma-server#requestor-authentication
}

impl SigningKey {
    /// Sign the given claims using this requestor key.
    ///
    /// Note that [`SigningKey`] cannot implement [`jwt::Key`] because [`SigningKey`]
    /// supports multiple algorithms.
    fn sign<C: serde::Serialize>(&self, claims: &C) -> Result<jwt::JWT, jwt::Error> {
        match self {
            SigningKey::HS256(ref key) => jwt::JWT::create(claims, &**key),
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
        creds: &Credentials,
        validity: std::time::Duration,
    ) -> anyhow::Result<jwt::JWT> {
        Ok(creds
            .key
            .sign(
                &jwt::Claims::from_custom(&self)?
                    .iat_now()?
                    .exp_after(validity)?
                    .claim("iss", &creds.name)? // issuer is server name
                    .claim("sub", &format!("{}_result", self.session_type))?,
            )
            .context("signing session result")?)
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
        serde_json::from_str::<AttributeTypeIdentifier>("\"a.b.c.d\"").unwrap();
        assert!(serde_json::from_str::<AttributeTypeIdentifier>("\"a.b.c\"").is_err());
    }
}
