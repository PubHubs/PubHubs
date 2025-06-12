//! User endpoints for entering hubs
use std::rc::Rc;

use crate::api;

use super::server::*;
use crate::api::phc::user::*;

impl App {
    /// Implements [`PppEP`].
    pub(crate) async fn handle_user_ppp(
        app: Rc<Self>,
        auth_token: actix_web::web::Header<AuthToken>,
    ) -> api::Result<PppResp> {
        let _user_id = if let Ok(user_id) = app.open_auth_token(auth_token.into_inner()) {
            user_id
        } else {
            return Ok(PppResp::RetryWithNewAuthToken);
        };

        todo! {}
    }
}
