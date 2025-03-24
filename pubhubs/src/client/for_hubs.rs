//! For use by (mocked) hubs

use crate::api::phc::hub::{Ticket, TicketSigned};
use crate::api::{self, ResultExt as _};
use crate::common::elgamal;
use crate::servers::Constellation;

use curve25519_dalek::scalar::Scalar;
use serde;

/// Context for doing requests as a hub
pub struct HubContext<'a> {
    //name: &'a hub::Name,
    pub ticket: &'a Ticket,
    pub signing_key: &'a api::SigningKey,
    pub constellation: &'a Constellation,
    pub timeout: std::time::Duration,
}

impl HubContext<'_> {
    fn ticket_sign<T>(&self, msg: &T) -> api::Result<TicketSigned<T>>
    where
        T: serde::Serialize,
        T: api::HavingMessageCode,
    {
        Ok(TicketSigned::new(
            self.ticket.clone(),
            api::Signed::new(&**self.signing_key, msg, self.timeout)?,
        ))
    }
}

impl crate::client::Client {
    /// Retrieve hub encryption key from PHC and transcryptor. See Figure 4 of the whitepaper.
    pub async fn get_hub_enc_key(&self, ctx: HubContext<'_>) -> api::Result<elgamal::PrivateKey> {
        let (phc_part, t_part): (Scalar, Scalar) = tokio::try_join!(
            // request key part from Pubhubs Central
            async {
                Ok(self
                    .query::<api::phct::hub::Key>(
                        &ctx.constellation.phc_url,
                        &ctx.ticket_sign(&api::phct::hub::KeyReq {})?,
                    )
                    .await?
                    .key_part)
            },
            // request keu part from the trancryptor
            async {
                Ok(self
                    .query::<api::phct::hub::Key>(
                        &ctx.constellation.transcryptor_url,
                        &ctx.ticket_sign(&api::phct::hub::KeyReq {})?,
                    )
                    .await?
                    .key_part)
            }
        )?;

        Ok((phc_part * t_part).into())
    }
}
