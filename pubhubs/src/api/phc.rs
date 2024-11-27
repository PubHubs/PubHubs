//! Additional endpoints provided by PubHubs Central
use crate::api::*;
use serde::{Deserialize, Serialize};

/// `.ph/hubs/...` endpoints
pub mod hub {
    use super::*;
    /// Used by a hub to request a ticket (see [TicketContent]) from PubHubs Central.
    /// The request must be signed for the `verifying_key` advertised by the hub info endoint
    /// (see crate::api::hub::Info).
    pub struct TicketEP {}
    impl EndpointDetails for TicketEP {
        type RequestType = Signed<TicketReq>;
        type ResponseType = Ticket;

        const METHOD: http::Method = http::Method::POST;
        const PATH: &'static str = ".ph/hubs/ticket";
    }

    having_message_code!(TicketReq, PhcHubTicketReq);

    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct TicketReq {
        pub handle: crate::hub::Handle,
    }

    pub type Ticket = Signed<TicketContent>;

    /// A ticket, a [Signed] [TicketContent], certifies that the hub uses the given
    /// `verifying_key`.
    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct TicketContent {
        pub handle: crate::hub::Handle,
        pub verifying_key: VerifyingKey,
    }

    having_message_code!(TicketContent, PhcHubTicket);

    /// A [Signed] message together with a [Ticket].
    #[derive(Serialize, Deserialize, Debug)]
    pub struct TicketSigned<T> {
        pub ticket: Ticket,
        signed: Signed<T>,
    }

    impl<T> TicketSigned<T> {
        /// Opens this [TicketSigned], checking the signature on `signed` using the verifying key in
        /// the provided `ticket`, and checking the `ticket` using `key`.
        pub fn open(self, key: &ed25519_dalek::VerifyingKey) -> Result<(T, crate::hub::Handle)>
        where
            T: HavingMessageCode + serde::de::DeserializeOwned,
        {
            let ticket_content: TicketContent = return_if_ec!(self.ticket.open(key));

            let msg: T = return_if_ec!(self.signed.open(&*ticket_content.verifying_key));

            Result::Ok((msg, ticket_content.handle))
        }

        pub fn new(ticket: Ticket, signed: Signed<T>) -> Self {
            Self { ticket, signed }
        }
    }
}
