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

        let result_jwt_id = result_jwt.id();

        log::debug!(
            "received authentic request for pubhubs card - jwt id {}",
            result_jwt_id
        );

        let (response_sender, response_receiver) = tokio::sync::oneshot::channel();

        if app
            .shared
            .wait_for_card_sender
            .send(WaitForCardInternalReq {
                yivi_result_jwt_id: result_jwt_id,
                response_sender,
            })
            .await
            .is_err()
        {
            log::warn!("wait for card: failed to send internal request: channel was cloed");
            return Ok(None);
        }

        let Ok(resp) = response_receiver.await else {
            log::warn!("wait for card: got no response to internal request");
            return Ok(None);
        };

        match resp {
            WaitForCardInternalResp::Timeout | WaitForCardInternalResp::AlreadyExists => Ok(None),
            WaitForCardInternalResp::IssueCard(jwt_maybe) => Ok(jwt_maybe),
        }
    }

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

pub(crate) struct WaitForCardInternalReq {
    yivi_result_jwt_id: id::Id,
    response_sender: tokio::sync::oneshot::Sender<WaitForCardInternalResp>,
}

pub(crate) enum WaitForCardInternalResp {
    Timeout,
    AlreadyExists,

    /// Issue card (or not if `None`)
    IssueCard(Option<JWT>),
}

pub(crate) struct IssueCardInternalReq {
    pub yivi_result_jwt_id: id::Id,
    pub issue_card: Option<JWT>,
}

/// Main function of a task spawned once for pubhubs central to handle incoming requests
/// to issue pubhubs cards.  
///
/// There are two types of requests:  those from [`handle_user_yivi_wait_for_card`] caused
/// by the Yivi server waiting for a pubhubs card to be issued, and those
/// from [`api::phc::user::EnterEP`] that informing us that a card may actually be issued.
pub(super) async fn card_request_handler(
    mut wait_for_card_receiver: tokio::sync::mpsc::Receiver<WaitForCardInternalReq>,
    mut issue_card_receiver: tokio::sync::mpsc::Receiver<IssueCardInternalReq>,
) {
    log::trace!("starting card_request_handler");

    let mut requests_by_id: HashMap<id::Id, (WaitForCardInternalReq, std::time::Instant)> =
        Default::default();

    // `(timeout_at, yivi_result_jwt_id)` pairs, kept in (lexicographically) sorted order.
    // The `timeout_at` is first so that the entries that will expire first are at the front of the queue
    let mut timeout_queue: VecDeque<(std::time::Instant, id::Id)> = Default::default();

    loop {
        tokio::select! {
            req_maybe = wait_for_card_receiver.recv() => {
                let Some(req) = req_maybe else {
                    break;
                };

                let yrj_id = req.yivi_result_jwt_id;

                let entry = requests_by_id.entry(yrj_id);
                if matches!(entry, std::collections::hash_map::Entry::Occupied(..)) {
                    let _ = req.response_sender.send(WaitForCardInternalResp::AlreadyExists);
                    continue
                }

                // TODO: make timeout configurable?
                let timeout_at = std::time::Instant::now() + core::time::Duration::from_secs(60);
                entry.or_insert((req, timeout_at));

                let tqe = (timeout_at, yrj_id);
                let Err(idx) = timeout_queue.binary_search(&tqe) else {
                    panic!("entry already in timeout queue, but not in requests_by_id map");
                };

                timeout_queue.insert(idx, tqe);

                // NOTE: we cannot use timeout_queue.push_back here, because there might already
                // be an entry with the exact same timestamp
            },

            req_maybe = issue_card_receiver.recv() => {
                let Some(req) = req_maybe else {
                    break;
                };

                let Some((wfc_req, timeout_at)) = requests_by_id.remove(&req.yivi_result_jwt_id) else {
                    log::debug!("wait-for-card session {} not found", req.yivi_result_jwt_id);
                    continue;
                };

                let tqe = (timeout_at, wfc_req.yivi_result_jwt_id);

                let Ok(idx) = timeout_queue.binary_search(&tqe) else {
                    panic!("item missing from timeout queue");
                };

                assert!(timeout_queue.remove(idx).is_some(), "failed to remove entry from the timeout queue that we just found");

                if wfc_req.response_sender.send(WaitForCardInternalResp::IssueCard(req.issue_card)).is_err(){
                    log::warn!("failed to issue card; channel already closed");
                };
            },

            // wait for the next wait-for-card session to expire.
            _ = tokio::time::sleep(
                match timeout_queue.front() {
                    Some((timeout_at,..)) => {
                        timeout_at.saturating_duration_since(std::time::Instant::now())
                            // wait 10ms longer to avoid waiting too briefly
                            .saturating_add(core::time::Duration::from_millis(10))
                    },
                    None => { core::time::Duration::MAX}
            }) => {
                let now = std::time::Instant::now();

                while let Some((timeout_at,..)) = timeout_queue.front() &&  *timeout_at <= now {

                    let Some((.., yrj_id)) = timeout_queue.pop_front() else {
                        panic!("timeout queue is suddenly empty");
                    };

                    let Some((req, ..)) = requests_by_id.remove(&yrj_id) else {
                        panic!("entry disappeared from requests_by_id dict");
                    };

                    let _ = req.response_sender.send(WaitForCardInternalResp::Timeout);

                    log::debug!("wait-for-card session {yrj_id} expired");
                }
            }
        }
    }

    log::trace!("card request handler exiting..");
}
