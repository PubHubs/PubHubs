//! Additional endpoints provided by PubHubs Central
use crate::api::*;

use std::collections::HashMap;

use actix_web::http::header;
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

/// `.ph/user/` endpoints, used by the ('global') web client
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
            let vec: Vec<u8> = self.inner.into_inner().into_vec();

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

    /// Stores a new object at pubhubs central, under the given `handle`.
    pub struct NewObjectEP {}
    impl EndpointDetails for NewObjectEP {
        type RequestType = bytes::Bytes;
        type ResponseType = StoreObjectResp;

        const METHOD: http::Method = http::Method::POST;
        const PATH: &'static str = ".ph/user/obj/store/{handle}";
    }

    /// Stores an object at pubhubs central under the given `handle`, overwriting the previous
    /// object stored there.
    pub struct OverwriteObjectEP {}
    impl EndpointDetails for OverwriteObjectEP {
        type RequestType = bytes::Bytes;
        type ResponseType = StoreObjectResp;

        const METHOD: http::Method = http::Method::POST;
        const PATH: &'static str = ".ph/user/obj/store/{handle}/{overwrite_hash}";
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
        /// The user has already reached the maximum number of objects it is allowed to store
        ///
        /// Either the global client is storing more at pubhubs central than it should, or the user
        /// is trying to abuse pubhubs central as object storage.
        QuotumReached,

        /// The object was stored succesfully under the given hash
        Stored { hash: Id },
    }
}
