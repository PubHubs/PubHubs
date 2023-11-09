//! Additional endpoints provided by PubHubs Central
//use serde::{Deserialize, Serialize};
//use crate::api::*;
//use crate::misc::serde_ext;

/// `.ph/hubs/...` endpoints
pub mod hub {
    /*
    use super::*;
    /// Used by a hub to request ticket (see [TocketContent]) from PubHubs Central.
    /// The request must be signed for the `verifying_key` advertised by the hub info endoint
    /// (see crate::api::hub::Info).
    pub struct Ticket {}
    impl EndpointDetails for Ticket {
        type RequestType = Signed<TicketReq>;
        type ResponseType = Signed<TicketContent>;

        const METHOD: http::Method = http::Method::POST;
        const PATH: &'static str = ".ph/hubs/ticket";
    }

    #[derive(Serialize, Deserialize, Debug)]
    pub struct TicketReq {
        pub name: crate::hub::Name,
    }

    /// A ticket, a [Signed] [TicketContent], certifies that the named hub uses the given
    /// `verifying_key`.
    #[derive(Serialize, Deserialize, Debug)]
    pub struct TicketContent {
        pub name: crate::hub::Name,
        pub verifying_key: serde_ext::B16<ed25519_dalek::VerifyingKey>,
    } */
}
