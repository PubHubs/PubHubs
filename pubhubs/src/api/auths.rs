//! Additional endpoints provided by the authentication server
use crate::api::*;
use crate::attr::Attr;
use crate::misc::jwt;
use crate::misc::serde_ext::bytes_wrapper::B64UU;
use crate::{attr, handle};

use serde::{Deserialize, Serialize};

use std::collections::HashMap;

/// Called by the global client to get, for example, the list of supported attribute types.
pub struct WelcomeEP {}
impl EndpointDetails for WelcomeEP {
    type RequestType = NoPayload;
    type ResponseType = Result<WelcomeResp>;

    const METHOD: http::Method = http::Method::GET;
    const PATH: &'static str = ".ph/welcome";
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct WelcomeResp {
    /// Available attribute types
    pub attr_types: HashMap<handle::Handle, attr::Type>,
}

pub struct AuthStartEP {}
impl EndpointDetails for AuthStartEP {
    type RequestType = AuthStartReq;
    type ResponseType = Result<AuthStartResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/auth/start";
}

/// Starts the process of obtaining attributes from the authentication server.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct AuthStartReq {
    /// Which source to use (e.g. yivi)
    pub source: crate::attr::Source,

    /// List of requested attributes
    pub attr_types: Vec<crate::handle::Handle>,
}

/// Response to [`AuthStartEP`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum AuthStartResp {
    /// Authentication process was started
    Success {
        /// Task for the global client to satisfy the authentication server.
        /// Depends on the requested attribute types
        task: AuthTask,

        /// Opaque state that should be sent with the [`AuthCompleteReq`].
        state: AuthState,
    },

    /// No attribute type known with this handle
    UnknownAttrType(crate::handle::Handle),

    /// The [`AuthStartReq::source`] is not available for the attribute type with this handle
    SourceNotAvailableFor(crate::handle::Handle),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(transparent)]
pub struct AuthState {
    pub(crate) inner: B64UU,
}

impl AuthState {
    pub(crate) fn new(inner: serde_bytes::ByteBuf) -> Self {
        Self {
            inner: inner.into(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub enum AuthTask {
    /// Have the end-user disclose to the specified yivi server.
    /// The authentication server only creates the signed (disclosure) session request,
    /// but it's up to the global client to send it to the yivi server.
    Yivi {
        disclosure_request: jwt::JWT,
        yivi_requestor_url: url::Url,
    },
}

/// After having completed the task set by the authentication server,
/// obtain the attributes.
pub struct AuthCompleteEP {}
impl EndpointDetails for AuthCompleteEP {
    type RequestType = AuthCompleteReq;
    type ResponseType = Result<AuthCompleteResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/auth/complete";
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct AuthCompleteReq {
    /// Proof that the end-user possesses the requested attributes.
    pub proof: AuthProof,

    /// The [`AuthStartResp::Success::state`] obtained earlier.
    pub state: AuthState,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub enum AuthProof {
    Yivi {
        /// The JWT returned by the yivi server's `/session/(...)/result-jwt` after completing a session
        /// with [`AuthTask::Yivi::disclosure_request`].
        disclosure: jwt::JWT,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum AuthCompleteResp {
    /// All went well
    Success {
        attrs: HashMap<handle::Handle, Signed<Attr>>,
    },

    /// Something went wrong;  please start again at [`AuthStartEP`].
    ///
    /// One reason is that the authentication server restarted and that the provided authenication
    /// state is no longer valid.
    PleaseRestartAuth,
}

/// Allows the global client to retrieve secrets tied to identifying [`Attr`]ibutes.
///
/// These *attribute keys* are used by the global client to encrypt its  *master secret(s)* before
/// storing them at pubhubs central.
///
/// To allow a compromised attribute key to be replaced (automatically), attribute keys are tied
/// not only to an attribute, but also a timestamp.
pub struct AttrKeysEP {}
impl EndpointDetails for AttrKeysEP {
    type RequestType = HashMap<handle::Handle, AttrKeyReq>;
    type ResponseType = Result<AttrKeysResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/attr-keys";
}

/// Request type for [`AttrKeysEP`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct AttrKeyReq {
    /// A signed attribute, obtained via [`AuthCompleteEP`].
    ///
    /// The attribute must be identifying.
    pub attr: Signed<Attr>,

    /// If set, will not only return the latest attribute key for `attr`, but also an older
    /// attribute key tied to the given timestamp.
    pub timestamp: Option<jwt::NumericDate>,
}

/// Response type for [`AttrKeysEP`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum AttrKeysResp {
    /// The attribute with the given handle is not (or no longer) valid.  Reobtain the attribute
    /// and try again.
    RetryWithNewAttr(handle::Handle),

    /// Successfully retrieves keys for all attributes provided.
    Success(HashMap<handle::Handle, AttrKeyResp>),
}

/// Part of a successful [`AttrKeyResp`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub struct AttrKeyResp {
    /// A pair, `(key, timestamp)`, where `key` is the latest attribute key for the requested attribute
    /// and `timestamp` can be used to retrieve the same key again later on by setting `AttrKeyReq::timestamp`.
    pub latest_key: (B64UU, jwt::NumericDate),

    /// The attribute key at [`AttrKeyReq::timestamp`], when this was set.
    ///
    /// This key should only be use for decryption, not for encryption.
    pub old_key: Option<B64UU>,
}
