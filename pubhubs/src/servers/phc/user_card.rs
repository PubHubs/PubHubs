//! User endpoints related to the issuance of the pubhubs yivi card
use crate::api;

use std::rc::Rc;

use super::server::*;
use crate::api::phc::user::*;

impl App {
    /// Implements [`api::phc::user::CardPseudEP`] endpoint.
    pub async fn handle_user_card_pseud(
        app: Rc<Self>,
        auth_token: actix_web::web::Header<AuthToken>,
    ) -> api::Result<CardPseudResp> {
        let Ok((user_state, _)) = app
            .open_auth_token_and_get_user_state(auth_token.into_inner())
            .await?
        else {
            return Ok(CardPseudResp::RetryWithNewAuthToken);
        };

        log::debug!("user {} retrieved registration pseudonym", user_state.id);

        Ok(CardPseudResp::Success(api::Signed::new(
            &*app.jwt_key,
            &CardPseudPackage {
                card_pseud: user_state.card_id(),
                registration_date: user_state.registration_date,
            },
            app.card_pseud_validity,
        )?))
    }
}
