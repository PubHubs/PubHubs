//! User endpoints for entering hubs
use std::rc::Rc;

use crate::api;
use crate::id;

use serde::{Deserialize, Serialize};

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

        let nonce_inner = PpNonceInner {
            user_id: user_state.id,
            not_valid_after: api::NumericDate::now() + app.pp_nonce_validity,
        };

        Ok(PppResp::Success(api::Sealed::new(
            &PolymorphicPseudonymPackage {
                // we make sure to rerandomize the polymorphic pseudonym so the transcryptor cannot
                // track the user based on it
                polymorphic_pseudonym: user_state.polymorphic_pseudonym.rerandomize(),
                nonce: api::Sealed::new(&nonce_inner, &app.pp_nonce_secret)?.into(),
            },
            &running_state.t_sealing_secret,
        )?))
    }
}

/// The contents of a [`PpNonce`].
#[derive(Serialize, Deserialize, Debug)]
struct PpNonceInner {
    /// When this nonce expires.
    not_valid_after: api::NumericDate,

    /// The [`id::Id`] of the user requesting this [`PolymorphicPseudonymPackage`].
    user_id: id::Id,
}

api::having_message_code!(PpNonceInner, PpNonce);

impl From<api::Sealed<PpNonceInner>> for PpNonce {
    fn from(sealed: api::Sealed<PpNonceInner>) -> Self {
        Self {
            inner: sealed.inner,
        }
    }
}
