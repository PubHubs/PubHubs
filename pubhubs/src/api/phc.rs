//! Additional endpoints provided by PubHubs Central
use crate::api::*;

use std::collections::{HashMap, HashSet};

use actix_web::http::header::{self, TryIntoHeaderValue as _};
use serde::{Deserialize, Serialize};

use crate::attr;
use crate::handle;
use crate::id::Id;
use crate::misc::serde_ext::bytes_wrapper::B64UU;
use crate::servers::Constellation;

/// `.ph/hub/...` endpoints, used by hubs
pub mod hub {
    use super::*;

    /// Used by a hub to request a ticket (see [`TicketContent`]) from PubHubs Central.
    /// The request must be signed for the `verifying_key` advertised by the hub info endoint
    /// (see crate::api::hub::Info).
    pub struct TicketEP {}
    impl EndpointDetails for TicketEP {
        type RequestType = Signed<TicketReq>;
        type ResponseType = Ticket;

        const METHOD: http::Method = http::Method::POST;
        const PATH: &'static str = ".ph/hub/ticket";
    }

    having_message_code!(TicketReq, PhcHubTicketReq);

    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct TicketReq {
        pub handle: crate::handle::Handle,
    }

    pub type Ticket = Signed<TicketContent>;

    /// A ticket, a [`Signed`] [`TicketContent`], certifies that the hub uses the given
    /// `verifying_key`.
    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct TicketContent {
        pub handle: crate::handle::Handle,
        pub verifying_key: VerifyingKey,
    }

    having_message_code!(TicketContent, PhcHubTicket);

    /// A [`Signed`] message together with a [`Ticket`].
    #[derive(Serialize, Deserialize, Debug)]
    pub struct TicketSigned<T> {
        pub ticket: Ticket,
        signed: Signed<T>,
    }

    impl<T> TicketSigned<T> {
        /// Opens this [`TicketSigned`], checking the signature on `signed` using the verifying key in
        /// the provided `ticket`, and checking the `ticket` using `key`.
        pub fn open(self, key: &ed25519_dalek::VerifyingKey) -> Result<(T, crate::handle::Handle)>
        where
            T: Signable,
        {
            let ticket_content: TicketContent = self.ticket.old_open(key)?;

            let msg: T = self.signed.old_open(&*ticket_content.verifying_key)?;

            Result::Ok((msg, ticket_content.handle))
        }

        pub fn new(ticket: Ticket, signed: Signed<T>) -> Self {
            Self { ticket, signed }
        }
    }
}

/// `.ph/user/...` endpoints, used by the ('global') web client
pub mod user {
    use super::*;

    /// Provides the global client with basic details about the current PubHubs setup.
    pub struct WelcomeEP {}
    impl EndpointDetails for WelcomeEP {
        type RequestType = ();
        type ResponseType = WelcomeResp;

        const METHOD: http::Method = http::Method::GET;
        const PATH: &'static str = ".ph/user/welcome";
    }

    /// Returned by [`WelcomeEP`].
    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct WelcomeResp {
        pub constellation: Constellation,
        pub hubs: HashMap<handle::Handle, crate::hub::BasicInfo>,
    }

    /// Login (and register if needed)
    pub struct EnterEP {}
    impl EndpointDetails for EnterEP {
        type RequestType = EnterReq;
        type ResponseType = EnterResp;

        const METHOD: http::Method = http::Method::POST;
        const PATH: &'static str = ".ph/user/enter";
    }

    /// Request to log in to an existing account, or register a new one.
    ///
    /// May fail with [`ErrorCode::BadRequest`] when:
    ///  - [`identifying_attr`] is not identifying
    ///  - The same attribute appears twice among [`add_attrs`] and [`identifying_attr`].
    ///
    /// [`identifying_attr`]: Self::identifying_attr
    /// [`add_attrs`]: Self::add_attrs
    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct EnterReq {
        /// [`Attr`]ibute identifying the user.
        ///
        /// [`Attr`]: attr::Attr
        pub identifying_attr: Signed<attr::Attr>,

        /// The mode determines whether we want to create an account if none exists,
        /// and whether we expect an account to exist.
        #[serde(default)]
        pub mode: EnterMode,

        /// Add these attributes to your account, required, for example, when registering a new
        /// account, or when no bannable attribute is registered for this account.
        #[serde(default)]
        pub add_attrs: Vec<Signed<attr::Attr>>,
    }

    /// Returned by [`EnterEP`].
    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[serde(rename = "snake_case")]
    pub enum EnterResp {
        /// Happens only in [`EnterMode::Login`]
        AccountDoesNotExist,

        /// This attribute is banned and therefore cannot be used.
        AttributeBanned(attr::Attr),

        /// Cannot login, because this account is banned.
        Banned,

        /// The given identifying attribute (in [`EnterReq::add_attrs`] or [`EnterReq::identifying_attr`])
        /// is already tied to another account.
        AttributeAlreadyTaken(attr::Attr),

        /// Cannot register an account with these attributes:  no bannable attribute provided.
        NoBannableAttribute,

        /// The given identifying attribute (now) grants access to a pubhubs account.
        Entered {
            /// Whether we created a new account
            new_account: bool,

            /// An access token identifying the user towards pubhubs central.
            ///
            /// May not be provided, for example, when the user is banned, or if no bannable
            /// attribute is currently associated to the user's account.
            auth_token: std::result::Result<AuthToken, AuthTokenDeniedReason>,

            attr_status: Vec<(attr::Attr, AttrAddStatus)>,
        },
    }

    /// Why no id token was granted
    #[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
    pub enum AuthTokenDeniedReason {
        /// No bannable attribute associated to account.
        ///
        /// May happen when a bannable attribute was provided in the [`EnterReq`], but adding this
        /// attribute failed for some reason.  Just try to add the bannable attribute again.
        NoBannableAttribute,
    }

    /// Whether to login, register, or both.
    #[derive(Default, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
    pub enum EnterMode {
        /// Log in to an existing account
        #[default]
        Login,

        /// Register a new account
        Register,

        /// Log in to an existing account, or register one first if needed
        LoginOrRegister,
    }

    /// Result of trying to add an attribute via [`EnterEP`].
    #[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
    #[serde(rename = "snake_case")]
    pub enum AttrAddStatus {
        /// Did nothing - the attribute was already there
        AlreadyThere,

        /// The attribute was added
        Added,

        /// Adding this attribute (partially) failed.
        PleaseTryAgain,
    }

    /// An opaque token used to identify the user towards pubhubs central via the
    /// `Authorization` header.  The token can be obtained via the [`EnterEP`].
    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[serde(transparent)]
    pub struct AuthToken {
        pub(crate) inner: B64UU,
    }

    impl header::TryIntoHeaderValue for AuthToken {
        type Error = std::convert::Infallible;

        fn try_into_value(self) -> std::result::Result<header::HeaderValue, Self::Error> {
            let vec: Vec<u8> = self.inner.to_string().into_bytes();

            Ok(header::HeaderValue::try_from(vec).unwrap())
        }
    }

    impl header::Header for AuthToken {
        fn name() -> header::HeaderName {
            header::AUTHORIZATION
        }

        fn parse<M: actix_web::HttpMessage>(
            msg: &M,
        ) -> std::result::Result<Self, actix_web::error::ParseError> {
            Ok(AuthToken {
                inner: header::from_one_raw_str(msg.headers().get(Self::name()))?,
            })
        }
    }

    /// Get state of the current user
    pub struct StateEP {}
    impl EndpointDetails for StateEP {
        type RequestType = ();
        type ResponseType = StateResp;

        const METHOD: http::Method = http::Method::GET;
        const PATH: &'static str = ".ph/user/state";
    }

    /// Result of retrieving a user's state
    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[serde(rename = "snake_case")]
    pub enum StateResp {
        /// The auth provided is expired or otherwise invalid.  Obtain a new one and retry.
        RetryWithNewAuthToken,

        /// Retrieval of [`UserState`] was successful
        State(UserState),
    }

    /// State of a user's account at pubhubs as shown to the user.
    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct UserState {
        /// Attributes that may be used to log in as this user.
        pub allow_login_by: HashSet<Id>,

        /// Attributes that when banned ban this user.
        pub could_be_banned_by: HashSet<Id>,

        /// Objects stored for this user
        pub stored_objects: HashMap<handle::Handle, UserObjectDetails>,
    }

    /// Details on an object stored at pubhubs central for a user.
    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct UserObjectDetails {
        /// Identifier for this object - does not change
        pub hash: Id,

        /// Needs to be provided to the [`GetObjectEP`] when retrieving this object.  May change.
        pub hmac: Id,

        /// Size of the object in bytes
        pub size: u32,
    }

    /// Retrieves a user object with the given `hash` from PubHubs central
    ///
    /// Authorization happens not via an access token, but using the [`UserObjectDetails::hmac`].
    /// This allows HTTP caching without leaking the access token to the cache.
    pub struct GetObjectEP {}
    impl EndpointDetails for GetObjectEP {
        type RequestType = ();
        /// Of course the response to [`GetObjectEP`] will be an octet stream, but when there is an
        /// error, the response content-type will be `application/json` encoding an [`GetObjectResp`].
        type ResponseType = GetObjectResp;

        const METHOD: http::Method = http::Method::GET;
        const PATH: &'static str = ".ph/user/obj/by-hash/{hash}/{hmac}";
    }

    /// Returned by [`GetObjectEP`] when there's a problem.  When there's no problem an octet
    /// stream is returned instead.
    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[serde(rename = "snake_case")]
    pub enum GetObjectResp {
        /// The `hmac` you sent is invalid, probably because it is outdated.
        ///
        /// Please retry after obtaining the current `hmac` from [`StateEP`].
        RetryWithNewHmac,

        /// The `hmac` was correct, so the object you requested probably did exist at one point,
        /// but it does not longer.  Please reload the list of stored objects via [`StateEP`].
        NotFound,
    }

    /// Stores a new object at pubhubs central, under the given `handle`.
    pub struct NewObjectEP {}
    impl EndpointDetails for NewObjectEP {
        type RequestType = bytes::Bytes;
        type ResponseType = StoreObjectResp;

        const METHOD: http::Method = http::Method::POST;
        const PATH: &'static str = ".ph/user/obj/by-handle/{handle}";

        fn request_content_type() -> http::HeaderValue {
            header::ContentType::octet_stream()
                .try_into_value()
                .unwrap()
        }

        fn serialize_request_type(req: &bytes::Bytes) -> bytes::Bytes {
            req.clone()
        }
    }

    /// Stores an object at pubhubs central under the given `handle`, overwriting the previous
    /// object stored there.
    pub struct OverwriteObjectEP {}
    impl EndpointDetails for OverwriteObjectEP {
        type RequestType = bytes::Bytes;
        type ResponseType = StoreObjectResp;

        const METHOD: http::Method = http::Method::POST;
        const PATH: &'static str = ".ph/user/obj/by-hash/{handle}/{overwrite_hash}";

        fn request_content_type() -> http::HeaderValue {
            header::ContentType::octet_stream()
                .try_into_value()
                .unwrap()
        }

        fn serialize_request_type(req: &bytes::Bytes) -> bytes::Bytes {
            req.clone()
        }
    }

    /// Returned by [`NewObjectEP`] and [`OverwriteObjectEP`].
    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[serde(rename = "snake_case")]
    pub enum StoreObjectResp {
        /// Please retry the same request again.  This may happen when another call changed the
        /// user's state. The purpose of letting the client make the same call again (instead of
        /// letting the server retry) is that the client gets feedback about this.
        PleaseRetry,

        /// The auth provided is expired or otherwise invalid.  Obtain a new one and retry.
        RetryWithNewAuthToken,

        /// Returned when using [`NewObjectEP`], but there is already an object stored under that handle.  
        /// To make sure that you're not overriding recent changes made by another global client,
        /// you must pass the hash of the object you want to overwrite by using the
        /// [`OverwriteObjectEP`] instead.
        MissingHash,

        /// Returned when [`OverwriteObjectEP`] is used, but there is no (longer) an object
        /// stored under that handle.  Use [`NewObjectEP`] to create a new one.
        NotFound,

        /// Returned when using [`OverwriteObjectEP`] but the object stored at that handle
        /// has a different hash, presumably because it has been changed in the meantime by another
        /// global client.
        HashDidNotMatch,

        /// The object that you sent did not differ from the object already stored.  Doing this
        /// should be avoided.
        NoChanges,

        /// Cannot perform this request, because the user has (or would have) reached the named
        /// quotum.
        ///
        /// This should only happen when the user is trying to abuse PubHubs central as object
        /// store, or when the global client is storing more than it should.
        QuotumReached(QuotumName),

        /// The object was stored succesfully under the given hash
        Stored { hash: Id },
    }

    /// Quota for a user
    #[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
    pub struct Quota {
        /// Total number of objects allowed for a user
        pub object_count: u16,

        /// The sum total of all bytes of all objects of a user cannot exceed this
        pub object_bytes_total: u32,
    }

    impl Default for Quota {
        fn default() -> Self {
            Self {
                object_count: 5,
                object_bytes_total: 1024 * 1024, // 1 mb
            }
        }
    }

    /// The different quota used in [`Quota`].
    #[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
    #[serde(rename_all = "snake_case")]
    pub enum QuotumName {
        ObjectCount,
        ObjectBytesTotal,
    }

    impl std::fmt::Display for QuotumName {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            self.serialize(f)
        }
    }
}
