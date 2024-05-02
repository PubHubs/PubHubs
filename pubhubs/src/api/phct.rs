//! Additional endpoints provided by PubHubs Central and the transcryptor
use crate::api::*;
use serde::{Deserialize, Serialize};

use curve25519_dalek::scalar::Scalar;

/// `.ph/hubs/` endpoints
pub mod hub {
    use super::*;
    /// Used by a hub to request part of its private key from the transcryptor and PHC.
    pub struct Key {}
    impl EndpointDetails for Key {
        type RequestType = phc::hub::TicketSigned<KeyReq>;
        type ResponseType = KeyResp; // does not need to be signed, as authenticity is guaranteed by TLS

        const METHOD: http::Method = http::Method::POST;
        const PATH: &'static str = ".ph/hubs/key";
    }

    // NOTE: we use an empty [`KeyReq`] instead of [`()`] just to be able to add a `MessageCode`.
    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct KeyReq {}

    having_message_code!(KeyReq, PhcTHubKeyReq);

    #[derive(Serialize, Deserialize, Debug)]
    pub struct KeyResp {
        pub key_part: Scalar,
    }

    having_message_code!(KeyResp, PhcTHubKeyResp);
}
