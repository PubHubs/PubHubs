//! User endpoints related to the issuance of the pubhubs yivi card
use crate::api;
use crate::misc::time_ext;
use crate::servers::yivi;

use std::rc::Rc;

use super::server::*;
use crate::api::phc::user::*;

/// Configuration of PubHubs card issuance
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct CardConfig {
    /// What type of card to issue
    #[serde(rename = "type")]
    pub card_type: CardType,

    /// For how long is a PubHubs card valid?
    #[serde(with = "time_ext::human_duration")]
    pub valid_for: core::time::Duration,

    /// How soon does the issuance request return by the [`api::phc::user::CardEP`] expire?
    #[serde(with = "time_ext::human_duration")]
    #[serde(default = "default_issuance_request_valid_for")]
    pub issuance_request_valid_for: core::time::Duration,
}

fn default_issuance_request_valid_for() -> core::time::Duration {
    core::time::Duration::from_secs(30) // no user interaction
}

/// The different types of PubHubs cards
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum CardType {
    Demo,
    Real,
}

impl CardType {
    pub fn credential(self) -> &'static str {
        match self {
            Self::Real => "pbdf.PubHubs.account",
            Self::Demo => "irma-demo.PubHubs.account",
        }
    }

    pub fn id(&self) -> &'static str {
        "id"
    }

    pub fn date(self) -> &'static str {
        match self {
            Self::Real => "registrationDate",
            Self::Demo => "registration_date",
        }
    }

    pub fn source(self) -> &'static str {
        match self {
            Self::Real => "registrationSource",
            Self::Demo => "registration_source",
        }
    }
}

impl App {
    /// Implements [`api::phc::user::CardEP`] endpoint.
    pub async fn handle_user_card(
        app: Rc<Self>,
        auth_token: actix_web::web::Header<AuthToken>,
    ) -> api::Result<CardResp> {
        let Ok((user_state, _)) = app
            .open_auth_token_and_get_user_state(auth_token.into_inner())
            .await?
        else {
            return Ok(CardResp::RetryWithNewAuthToken);
        };

        let card_config = app.card_config_or_internal_error()?;

        let esr = app.issue_card(&user_state).map_err(|err| {
            log::warn!("failed to issue pubhubs card to {}: {err}", user_state.id);
            api::ErrorCode::InternalError
        })?;

        Ok(CardResp::Success(api::Signed::new(
            &*app.jwt_key,
            &esr,
            card_config.issuance_request_valid_for,
        )?))
    }

    pub fn card_config_or_internal_error(&self) -> api::Result<&CardConfig> {
        self.card_config.as_ref().ok_or_else(|| {
            log::warn!("PubHubs card config requested but not available");
            api::ErrorCode::InternalError
        })
    }

    /// Creates a signed issuance request for a PubHubs card for the given user.
    pub(crate) fn issue_card(
        &self,
        user_state: &super::user::UserState,
    ) -> anyhow::Result<yivi::ExtendedSessionRequest> {
        let card_config = self.card_config_or_internal_error()?;

        let credential =
            yivi::CredentialToBeIssued::new(card_config.card_type.credential().parse()?)
                .valid_for(card_config.valid_for)
                .attribute(
                    card_config.card_type.id().to_string(),
                    user_state.card_id().to_string(),
                )
                .attribute(
                    card_config.card_type.source().to_string(),
                    user_state
                        .registration_source
                        .clone()
                        .unwrap_or_else(|| "?".to_string()),
                )
                .attribute(
                    card_config.card_type.date().to_string(),
                    user_state
                        .registration_date
                        .as_ref()
                        .map(api::NumericDate::date)
                        .unwrap_or_else(|| "?".to_string()),
                );

        Ok(yivi::ExtendedSessionRequest::issuance(vec![credential]))
    }
}
