//! User endpoints related to the issuance of cards
use crate::api;
use crate::api::OpenError;
use crate::attr;
use crate::handle::Handle;
use crate::misc::time_ext;
use crate::servers::yivi;

use actix_web::web;

use std::rc::Rc;

use super::server::*;

/// Configuration of PubHubs card issuance
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct CardConfig {
    /// What type of card to issue
    #[serde(rename = "type")]
    #[serde(default)]
    pub card_type: CardType,

    /// The attribute type associated to the pubhubs card
    #[serde(default = "default_card_attr_type")]
    pub card_attr_type: Handle,

    /// For how long is a PubHubs card valid?
    #[serde(with = "time_ext::human_duration")]
    #[serde(default = "default_card_valid_for")]
    pub valid_for: core::time::Duration,

    /// What registration source to use.  Default: [`crate::servers::Config::phc_url`].
    ///
    /// Use [`App::registration_source()`] to get the default.
    #[serde(default)]
    registration_source: Option<String>,
}

fn default_card_attr_type() -> Handle {
    "ph_card".parse().unwrap()
}

impl Default for CardConfig {
    fn default() -> Self {
        serde_json::from_value(serde_json::json!({}))
            .expect("expected all fields of CardConfig to have default values")
    }
}

fn default_card_valid_for() -> core::time::Duration {
    core::time::Duration::from_secs(2 * 7 * 24 * 3600) // two weeks
}

/// The different types of PubHubs cards
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone, Copy, Default)]
#[serde(rename_all = "snake_case")]
pub enum CardType {
    Demo,
    #[default]
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
    /// Gets the registration source to use when issuing a pubhubs card
    fn registration_source<'a>(&'a self, yivi: &'a YiviCtx) -> &'a str {
        if let Some(rs) = yivi.card_config.registration_source.as_ref() {
            return rs.as_str();
        }

        self.phc_url.as_str()
    }

    /// Creates a yivi issuance request and pubhubs attribute for a PubHubs card
    pub(crate) fn issue_card(
        &self,
        card_pseud_package: api::phc::user::CardPseudPackage,
        comment: Option<String>,
    ) -> api::Result<(yivi::ExtendedSessionRequest, attr::Attr)> {
        let yivi = self.get_yivi()?;

        let mut registration_date: String = card_pseud_package
            .registration_date
            .as_ref()
            .map(api::NumericDate::date)
            .unwrap_or_else(|| "?".to_string());

        if let Some(comment) = comment {
            registration_date = format!("{registration_date}, {comment}");
        }

        let card_pseud = card_pseud_package.card_pseud.to_string();

        let credential = yivi::CredentialToBeIssued::new(
            yivi.card_config
                .card_type
                .credential()
                .parse()
                .map_err(|err| {
                    log::error!("failed to parse pubhubs card yivi credential: {err}");
                    api::ErrorCode::InternalError
                })?,
        )
        .valid_for(yivi.card_config.valid_for)
        .attribute(
            yivi.card_config.card_type.id().to_string(),
            card_pseud.clone(),
        )
        .attribute(
            yivi.card_config.card_type.source().to_string(),
            self.registration_source(yivi).to_string(),
        )
        .attribute(
            yivi.card_config.card_type.date().to_string(),
            registration_date,
        );

        let esr = yivi::ExtendedSessionRequest::issuance(vec![credential]);

        let Some(attr_type) = self.attr_type_from_handle(&yivi.card_config.card_attr_type) else {
            log::error!(
                "pubhubs card attribute type {} not found",
                yivi.card_config.card_attr_type
            );
            return Err(api::ErrorCode::InternalError);
        };

        let attr = attr::Attr {
            attr_type: attr_type.id,
            value: card_pseud,
            bannable: attr_type.bannable,
            not_identifying: !attr_type.identifying,
            not_addable: false,
        };

        Ok((esr, attr))
    }

    /// Implements [`api::auths::CardEP`].
    pub async fn handle_card(
        app: Rc<Self>,
        req: web::Json<api::auths::CardReq>,
    ) -> api::Result<api::auths::CardResp> {
        let yivi = app.get_yivi()?;
        let running_state = app.running_state_or_please_retry()?;

        let api::auths::CardReq {
            card_pseud_package: cpp_signed,
            comment,
        } = req.into_inner();

        let card_pseudonym_package =
            match cpp_signed.open(&*running_state.constellation.phc_jwt_key, None) {
                Ok(cpp) => cpp,
                Err(OpenError::OtherConstellation(..)) | Err(OpenError::InternalError) => {
                    return Err(api::ErrorCode::InternalError);
                }
                Err(OpenError::OtherwiseInvalid) => {
                    return Err(api::ErrorCode::BadRequest);
                }
                Err(OpenError::Expired) | Err(OpenError::InvalidSignature) => {
                    return Ok(api::auths::CardResp::PleaseRetryWithNewCardPseud);
                }
            };

        let (esr, attr) = app.issue_card(card_pseudonym_package, comment)?;

        let issuance_request = esr.sign(&yivi.requestor_creds).map_err(|err| {
            log::error!("failed to sign extended session request for issuance of card: {err:?}");
            api::ErrorCode::InternalError
        })?;

        let attr = api::Signed::<attr::Attr>::new(
            &running_state.attr_signing_key,
            &attr,
            app.auth_window,
        )?;

        Ok(api::auths::CardResp::Success {
            attr,
            issuance_request,
            yivi_requestor_url: yivi.requestor_url.clone(),
        })
    }
}
