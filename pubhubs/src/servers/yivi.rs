//! Tools for dealing with yivi.
use anyhow::Context as _;
use serde;

use crate::misc::jwt;

/// A session request send by a requestor to a yivi server
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct SessionRequest {
    #[serde(rename = "@context")]
    context: SessionType,

    /// See: https://pkg.go.dev/github.com/privacybydesign/irmago#DisclosureRequest
    disclose: Option<AttributeConDisCon>,
}

impl SessionRequest {
    pub fn disclosure(cdc: AttributeConDisCon) -> SessionRequest {
        Self {
            context: SessionType::Disclosure,
            disclose: Some(cdc),
        }
    }

    /// Signs this session request using the provided requestor credentials.
    ///
    /// Documentation: https://docs.yivi.app/session-requests/#jwts-signed-session-requests
    /// Reference code for disclosure request:
    ///     https://github.com/privacybydesign/irmago/blob/d389b4559e007a0fcb4e78d1f6e073c1ad57bc13/requests.go#L957
    pub fn sign(self, creds: &RequestorCredentials) -> anyhow::Result<jwt::JWT> {
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

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub enum SessionType {
    #[serde(rename = "https://irma.app/ld/request/disclosure/v2")]
    Disclosure,

    #[serde(rename = "https://irma.app/ld/request/signature/v2")]
    Signature,

    #[serde(rename = "https://irma.app/ld/request/issuance/v2")]
    Issuance,
}

impl SessionType {
    /// The `sub` field of a signed session request JWT of this type
    pub const fn jwt_sub(&self) -> &'static str {
        match self {
            SessionType::Disclosure => "verification_request",
            SessionType::Signature => "signature_request",
            SessionType::Issuance => "issue_request",
        }
    }

    /// The key that holds this session request inside a JWT of a signed session request
    pub const fn jwt_key(&self) -> &'static str {
        match self {
            SessionType::Disclosure => "sprequest",
            SessionType::Signature => "absrequest",
            SessionType::Issuance => "iprequest",
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
pub struct RequestorCredentials {
    pub name: String,
    pub key: RequestorKey,
}

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub enum RequestorKey {
    #[serde(rename = "hs256")]
    HS256(jwt::HS256),
    // We do not use the `Token` or `RS256` Yivi `auth_method`s,
    // see: https://docs.yivi.app/irma-server#requestor-authentication
}

impl RequestorKey {
    /// Sign the given claims using this requestor key.
    ///
    /// Note that [`RequestorKey`] cannot implement [`jwt::Key`] because [`RequestorKey`]
    /// supports multiple algorithms.
    fn sign<C: serde::Serialize>(&self, claims: &C) -> Result<jwt::JWT, jwt::Error> {
        match self {
            RequestorKey::HS256(ref key) => jwt::JWT::create(claims, key),
        }
    }
}
