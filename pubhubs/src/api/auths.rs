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
    pub source: attr::Source,

    /// List of requested attributes
    pub attr_types: Vec<crate::handle::Handle>,

    /// Only when [`Self::source`] is `attr::Source::Yivi` can this flag be set.
    /// It makes the [`AuthTask::Yivi::disclosure_request`]  instruct the yivi server to use
    /// [`YIVI_NEXT_SESSION_PATH`] as next `nextSession` url,
    /// see [yivi documentaton](https://docs.yivi.app/chained-sessions/),
    /// making it possible to follow-up the disclosure request with the issuance of a PubHubs card.
    ///
    /// This means that before the dislosure result is returned to the frontend,
    /// the Yivi server will post the disclosure result to the [`YIVI_NEXT_SESSION_PATH`] endpoint
    /// to determine what session to run next.
    ///
    /// Upon receipt of the disclosure result the [`YIVI_NEXT_SESSION_PATH`] endpoint will immediately
    /// make it available via the [`YiviWaitForResultEP`] endpoint, while keeping the Yivi server waiting
    /// for a response which must be provided via the  [`YiviReleaseNextSessionEP`] endpoint.
    ///
    /// This gives the global client time to obtain a PubHubs card issuance request from PubHubs central,
    /// to be passed to the Yivi server as next session via [`YiviReleaseNextSessionEP`].
    #[serde(default)]
    pub yivi_chained_session: bool,
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
    pub timestamp: Option<NumericDate>,
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
    pub latest_key: (B64UU, NumericDate),

    /// The attribute key at [`AttrKeyReq::timestamp`], when this was set.
    ///
    /// This key should only be use for decryption, not for encryption.
    pub old_key: Option<B64UU>,
}

/// Wait for the disclosure result that the yivi server will post to the authentication server
/// when [`AuthStartReq::yivi_chained_session`] was set.
pub struct YiviWaitForResultEP {}
impl EndpointDetails for YiviWaitForResultEP {
    type RequestType = YiviWaitForResultReq;
    type ResponseType = Result<YiviWaitForResultResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/yivi/wait-for-result";
}

/// Request type for [`YiviWaitForResultEP`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub struct YiviWaitForResultReq {
    /// The [`AuthStartResp::Success::state`] returned earlier
    pub state: AuthState,
}

/// What's returned by [`YiviWaitForResultEP`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum YiviWaitForResultResp {
    Success {
        /// The disclosure result posted by the Yivi server
        disclosure: jwt::JWT,
    },
}

/// Provide the waiting yivi server with the next session.
pub struct YiviReleaseNextSessionEP {}
impl EndpointDetails for YiviReleaseNextSessionEP {
    type RequestType = YiviReleaseNextSessionReq;
    type ResponseType = Result<YiviReleaseNextSessionResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/yivi/release-next-session";
}

/// Request type for [`YiviReleaseNextSessionEP`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub struct YiviReleaseNextSessionReq {
    /// The [`AuthStartResp::Success::state`] returned earlier
    pub state: AuthState,

    /// The signed next session request to pass to the yivi server
    ///
    /// If `None`, the yivi server will be served a `HTTP 204` causing it to stop the yivi flow
    /// normally without opening a follow-up session.
    pub next_session_request: Option<jwt::JWT>,
}

/// What's returned by [`YiviReleaseNextSessionEP`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum YiviReleaseNextSessionResp {
    Success {},
}

/// Path for the endpoint used by the yivi server to get the next session in a chained session.
///
/// Note that this endpoint does not conform to the [`EndpointDetails`] format, using, for example,
/// the HTTP status code to convey information (`204` means no next session).
pub const YIVI_NEXT_SESSION_PATH: &str = ".ph/yivi/next-session";
