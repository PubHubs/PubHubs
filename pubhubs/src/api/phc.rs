//! Additional endpoints provided by PubHubs Central
use crate::api::*;

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::attr;
use crate::handle;
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

        const BROWSER_FETCH_ENDPOINT: bool = true;
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

        const BROWSER_FETCH_ENDPOINT: bool = true;
    }

    /// Request to log in to an existing account, or register a new one.
    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct EnterReq {
        /// [`Attr`]ibute identifying the user.
        ///
        /// [`Attr`]: attr::Attr
        pub identifying_attr: Signed<attr::Attr>,

        /// Whether we want to create a new account if one does not exist.
        #[serde(default)]
        pub permit_registration: bool,

        /// Whether we expect no account to exist.
        #[serde(default)]
        pub expect_registration: bool,

        /// Add these attributes to your account, required, for example, when registering a new
        /// account.
        #[serde(default)]
        pub add_attrs: Vec<Signed<attr::Attr>>,
    }

    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[serde(rename = "snake_case")]
    pub enum EnterResp {
        /// Can happen only when [`EnterReq::expect_registration`] is true
        AccountAlreadyExists,

        /// Can happen only ewhen [`EnterReq::permit_registration`] is false
        AccountDoesNotExist,

        /// Login (and registration) was successful
        Entered {
            /// Whether we created a new account
            new_account: bool,

            attr_status: HashMap<handle::Handle, AttrAddResp>,
        },
    }

    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[serde(rename = "snake_case")]
    pub enum AttrAddResp {
        Added,
    }
}
