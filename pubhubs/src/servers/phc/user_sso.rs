//! User endpoints for entering hubs
use std::rc::Rc;

use crate::api;

use super::server::*;
use crate::api::phc::user::*;
use crate::api::sso::*;

impl App {
    /// Implements [`PppEP`].
    pub(crate) async fn handle_user_ppp(
        app: Rc<Self>,
        auth_token: actix_web::web::Header<AuthToken>,
    ) -> api::Result<PppResp> {
        let running_state = app.running_state_or_not_yet_ready()?;

        let Ok((user_state, _)) = app
            .open_auth_token_and_get_user_state(auth_token.into_inner())
            .await?
        else {
            return Ok(PppResp::RetryWithNewAuthToken);
        };

        Ok(PppResp::Success(api::Sealed::new(
            &PolymorphicPseudonymPackage {
                // we make sure to rerandomize the polymorphic pseudonym so the transcryptor cannot
                // track the user based on it
                polymorphic_pseudonym: user_state.polymorphic_pseudonym.rerandomize(),
                nonce: PpNonce::new()?,
            },
            &running_state.ppp_secret,
        )?))
    }
}

impl PpNonce {
    fn new() -> api::Result<Self> {
        Ok(PpNonce {
            inner: Default::default(), // TODO: implement
        })
    }
}
