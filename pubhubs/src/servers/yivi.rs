//! Tools for dealing with yivi.
use serde;

/// A session request send by a requestor to a yivi server
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct SessionRequest {
    #[serde(rename = "@context")]
    context: Context,

    /// See: https://pkg.go.dev/github.com/privacybydesign/irmago#DisclosureRequest
    disclose: Option<AttributeConDisCon>,
}

impl SessionRequest {
    pub fn disclosure(cdc: AttributeConDisCon) -> SessionRequest {
        Self {
            context: Context::Disclosure,
            disclose: Some(cdc),
        }
    }

    /// Signs this session request using the provided requestor credentials
    pub fn sign(self, creds: &RequestorCredentials) -> String {
        todo! {}
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub enum Context {
    #[serde(rename = "https://irma.app/ld/request/disclosure/v2")]
    Disclosure,

    #[serde(rename = "https://irma.app/ld/request/signature/v2")]
    Signature,

    #[serde(rename = "https://irma.app/ld/request/issuance/v2")]
    Issuance,
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
    HS256(Vec<u8>),
    // We do not use the `Token` or `RS256` Yivi `auth_method`s,
    // see: https://docs.yivi.app/irma-server#requestor-authentication
}
