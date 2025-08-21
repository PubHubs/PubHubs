//! User endpoints related to the issuance of the pubhubs yivi card
use std::rc::Rc;

use anyhow::Context as _;

use crate::misc::jwt::JWT;
use crate::servers::yivi;

use super::server::*;
use crate::api::phc::user::*;

impl App {
    /// Implements the `.ph/user/yivi/wait-for-card` endpoint, which is consumed by the user's yivi
    /// app in a chained session waiting for a pubhubs card to be issued (or the session to end).
    pub(crate) async fn handle_user_yivi_wait_for_card(
        app: actix_web::web::Data<Rc<Self>>,
        result_jwt: String,
        query: actix_web::web::Query<WaitForCardQuery>,
    ) -> impl actix_web::Responder {
        match App::handle_user_yivi_wait_for_card_inner(
            &app.into_inner(),
            result_jwt.into(),
            query.into_inner(),
        )
        .await
        {
            Ok(Some(jwt)) => actix_web::Either::Right(Into::<String>::into(jwt)),
            Ok(None) => actix_web::Either::Left(actix_web::HttpResponse::NoContent()),
            Err(err) => {
                log::warn!("failed to wait for ph card: {err}");
                actix_web::Either::Left(actix_web::HttpResponse::NoContent())
            }
        }
    }

    async fn handle_user_yivi_wait_for_card_inner(
        app: &Rc<Self>,
        result_jwt: JWT,
        query: WaitForCardQuery,
    ) -> anyhow::Result<Option<JWT>> {
        let running_state = app
            .running_state
            .as_ref()
            .context("running state not yet available")?;

        let state = query
            .state
            .open(&running_state.auths_sealing_secret)
            .context("failed to unseal state")?;

        let _session_result = yivi::SessionResult::open_signed(&result_jwt, &state.server_creds)
            .context("invalid or unauthentic result jwt");

        log::debug!(
            "received authentic request for pubhubs card - jwt id {}",
            result_jwt.id()
        );

        Ok(None)
    }
}
