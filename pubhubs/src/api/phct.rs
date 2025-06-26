//! Additional endpoints provided by PubHubs Central and the transcryptor
use crate::api::*;
use serde::{Deserialize, Serialize};

use curve25519_dalek::scalar::Scalar;

/// `.ph/hubs/` endpoints
pub mod hub {
    use super::*;
    /// Used by a hub to request part of its private key from the transcryptor and PHC.
    pub struct KeyEP {}
    impl EndpointDetails for KeyEP {
        type RequestType = phc::hub::TicketSigned<KeyReq>;
        type ResponseType = Result<KeyResp>; // does not need to be signed, as authenticity is guaranteed by TLS

        const METHOD: http::Method = http::Method::POST;
        const PATH: &'static str = ".ph/hubs/key";
    }

    // NOTE: we use an empty [`KeyReq`] instead of [`()`] just to be able to add a `MessageCode`.
    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[serde(deny_unknown_fields)]
    pub struct KeyReq {}

    having_message_code!(KeyReq, PhcTHubKeyReq);

    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[serde(deny_unknown_fields)]
    #[must_use]
    pub enum KeyResp {
        Success {
            key_part: Scalar,
        },

        /// Signature on ticket expired or was invalid.  Please obtain a new ticket and try again.
        /// If this error occurs with a fresh ticket, something is wrong with the server.
        RetryWithNewTicket,
    }

    impl KeyResp {
        /// Returns contained [`KeyResp::Succes::key_part`], or panics otherwise.
        pub fn unwrap(self) -> Scalar {
            match self {
                KeyResp::Success { key_part } => key_part,
                KeyResp::RetryWithNewTicket => panic!("could not get key part; ticket was invalid"),
            }
        }
    }

    having_message_code!(KeyResp, PhcTHubKeyResp);
}
