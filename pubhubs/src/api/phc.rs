//! Additional endpoints provided by PubHubs Central
use crate::api::*;

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::attr;
use crate::handle;
use crate::id;
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
            id_token: std::result::Result<IdToken, IdTokenDeniedReason>,

            attr_status: Vec<(attr::Attr, AttrAddStatus)>,
        },
    }

    /// Why no id token was granted
    #[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
    pub enum IdTokenDeniedReason {
        /// This account is banned
        Banned,

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

    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[serde(rename = "snake_case")]
    pub enum AttrAddStatus {
        /// Did nothing - the attribute was already there
        AlreadyThere,

        /// The attribute was added
        Added,

        /// Adding this attribute (partially) failed.
        PleaseRetry,
    }

    /// An opaque token used to identify the user towards pubhubs central
    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[serde(transparent)]
    pub struct IdToken {
        pub(crate) inner: serde_bytes::ByteBuf,
    }
}
