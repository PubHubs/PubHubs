//! Tools for dealing with yivi.
use anyhow::Context as _;
use serde::{self, Serialize as _};

use crate::misc::{jwt, serde_ext};

/// A session request send by a requestor to a yivi server
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct SessionRequest {
    #[serde(rename = "@context")]
    context: LdContext,

    /// See: https://pkg.go.dev/github.com/privacybydesign/irmago#DisclosureRequest
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
    /// Documentation: https://docs.yivi.app/session-requests/#jwts-signed-session-requests
    /// Reference code for disclosure request:
    ///     https://github.com/privacybydesign/irmago/blob/d389b4559e007a0fcb4e78d1f6e073c1ad57bc13/requests.go#L957
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
}

/// Some JSON linked data contexts <http://json-ld.org> used by yivi, primarily to identify a
/// session's type.  Not to be confused with [`LdContext`].
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/requests.go#L21>
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
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

/// See: https://pkg.go.dev/github.com/privacybydesign/irmago#AttributeConDisCon
pub type AttributeConDisCon = Vec<Vec<Vec<AttributeRequest>>>;

/// See: https://pkg.go.dev/github.com/privacybydesign/irmago#AttributeRequest
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct AttributeRequest {
    #[serde(rename = "type")] // 'type' is a keyword
    pub ty: String,
}

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct Credentials {
    pub name: String,
    pub key: SigningKey,
}

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
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
    /// Note that [`SigningKey`] cannot implement [`jwt::Key`] because [`Key`]
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
#[derive(serde::Serialize, serde::Deserialize, Debug)]
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
            token: "MockToken".to_string(),
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
#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct DisclosedAttribute {
    #[serde(rename = "rawvalue")]
    pub raw_value: String,

    // NB: The field "value" (containing translations of the attribute) we don't use
    /// The type of the disclosed attibute
    pub id: String,

    pub status: AttributeProofStatus,

    #[serde(rename = "issuancetime")]
    pub issuance_time: jwt::NumericDate,

    #[serde(rename = "notrevoked")]
    pub not_revoked: Option<bool>,

    #[serde(rename = "notrevokedbefore")]
    pub not_revoked_before: Option<jwt::NumericDate>,
}

impl DisclosedAttribute {
    fn mock(raw_value: String, id: String) -> Self {
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
pub type RequestorToken = String;

/// Error type that may be part of a session result
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/messages.go#L119>
#[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq, Eq)]
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
#[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq, Eq)]
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
#[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq, Eq)]
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
#[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq, Eq)]
#[serde(rename_all_fields = "SCREAMING_SNAKE_CASE")]
pub enum AttributeProofStatus {
    Present,
    Extra,
    Null,
}

/// Session type
///
/// <https://github.com/privacybydesign/irmago/blob/b1c38f4f2c9da3d3f39b5c21a330bcbd04143f41/messages.go#L227>
#[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq, Eq)]
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
