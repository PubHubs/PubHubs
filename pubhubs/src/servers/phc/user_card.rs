//! User endpoints related to the issuance of the pubhubs yivi card
use std::collections::{HashMap, VecDeque};
use std::rc::Rc;

use anyhow::Context as _;

use crate::api;
use crate::id;
use crate::misc::jwt::JWT;
use crate::misc::time_ext;
use crate::servers::yivi;

use super::server::*;
use crate::api::phc::user::*;

/// Configuration of PubHubs card issuance
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct CardConfig {
    /// Credentials used by PHC to issue pubhubs yivi cards
    pub requestor_creds: yivi::Credentials<yivi::SigningKey>,

    /// What type of card to issue
    #[serde(rename = "type")]
    pub card_type: CardType,

    #[serde(with = "time_ext::human_duration")]
    pub valid_for: core::time::Duration,
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
    pub fn card_config_or_internal_error(&self) -> api::Result<&CardConfig> {
        log::warn!("PubHubs card config requested but not available");
        self.card_config
            .as_ref()
            .ok_or(api::ErrorCode::InternalError)
    }

    /// Creates a signed issuance request for a PubHubs card for the given user.
    pub(crate) fn issue_card(&self, user_state: &super::user::UserState) -> anyhow::Result<JWT> {
        let card_config = self.card_config_or_internal_error()?;

        // TODO: properly set id, source, and date

        let credential =
            yivi::CredentialToBeIssued::new(card_config.card_type.credential().parse()?)
                .valid_for(card_config.valid_for)
                .attribute(card_config.card_type.id().to_string(), "id".to_string())
                .attribute(
                    card_config.card_type.source().to_string(),
                    "source".to_string(),
                )
                .attribute(card_config.card_type.date().to_string(), "date".to_string()); // TODO:
                                                                                          // replace

        let esr = yivi::ExtendedSessionRequest::issuance(vec![credential]);

        esr.sign(&card_config.requestor_creds)
    }
}
