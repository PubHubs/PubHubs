//! Implementation of the `/yivi/...` endpoints
use super::server::*;

use crate::api;
use crate::id;
use crate::misc::jwt;
use crate::servers::yivi;

use super::server::YiviCtx;

use std::collections::HashMap;
use std::rc::Rc;

use actix_web::web;

impl App {
    pub fn chained_sessions_ctl_or_bad_request(&self) -> api::Result<&ChainedSessionsCtl> {
        self.chained_sessions_ctl.as_ref().ok_or_else(|| {
            log::debug!("chained sessions control requested, but not available");
            api::ErrorCode::BadRequest
        })
    }

    /// Implements the [`api::auths::YiviWaitForResultEP`] endpoint.
    pub async fn handle_yivi_wait_for_result(
        app: Rc<Self>,
        req: web::Json<api::auths::YiviWaitForResultReq>,
    ) -> api::Result<api::auths::YiviWaitForResultResp> {
        let csc = app.chained_sessions_ctl_or_bad_request()?;

        let api::auths::YiviWaitForResultReq { state } = req.into_inner();

        let Some(state) = AuthState::unseal(&state, &app.auth_state_secret) else {
            return Ok(api::auths::YiviWaitForResultResp::PleaseRestartAuth);
        };

        let Some(session_id) = state.yivi_chained_session_id else {
            log::debug!(
                "yivi-wait-for-result endpoint called on a authentication session without a yivi chained session"
            );
            return Err(api::ErrorCode::BadRequest);
        };

        csc.wait_for_result(session_id).await
    }

    /// Implementes the [`api::auths::YIVI_NEXT_SESSION_PATH`] endpoint.
    pub async fn handle_yivi_next_session(
        app: web::Data<std::rc::Rc<App>>,
        query: web::Query<api::auths::YiviNextSessionQuery>,
        result_jwt: String,
    ) -> impl actix_web::Responder {
        let app = app.into_inner();
        let api::auths::YiviNextSessionQuery { state } = query.into_inner();

        log::trace!(
            "yivi server (or imposter) submits next sessions request; jwt: {result_jwt:?}; auth state: {}",
            state
        );

        let result_jwt = jwt::JWT::from(result_jwt);

        let Some(state) = AuthState::unseal(&state, &app.auth_state_secret) else {
            log::debug!(
                "yivi server (or an imposter) submitted invalid (or expired) auth state to next-session endpoint"
            );
            return actix_web::HttpResponse::BadRequest().finish();
        };

        let Some(chained_session_id) = state.yivi_chained_session_id else {
            log::warn!(
                "yivi server submitted auth state to next-session endpoint without chained session id"
            );
            return actix_web::HttpResponse::BadRequest().finish();
        };

        let Some(csc) = app.chained_sessions_ctl.as_ref() else {
            log::warn!("next-session endpoint invoked, but chained session are not supported");
            return actix_web::HttpResponse::BadRequest().finish();
        };

        let Some(yivi) = app.yivi.as_ref() else {
            log::warn!("next-session endpoint invoked, but yivi is not supported");
            return actix_web::HttpResponse::BadRequest().finish();
        };

        let Ok(..) = yivi::SessionResult::open_signed(&result_jwt, &yivi.server_creds) else {
            log::debug!(
                "invalid yivi signed session result submitted by yivi server (or imposter)",
            );
            log::trace!("invalid signed session result jwt: {result_jwt}");
            return actix_web::HttpResponse::BadRequest().finish();
        };

        log::trace!(
            "yivi server submitted disclosure and is waiting for chained session {chained_session_id}"
        );

        match csc
            .wait_for_next_session(chained_session_id, result_jwt)
            .await
        {
            Ok(None) => actix_web::HttpResponse::NoContent().finish(),
            Ok(Some(session_request)) => {
                log::debug!("sent chained session to yivi server");
                actix_web::HttpResponse::Ok().json(session_request)
            }
            Err(api::ErrorCode::InternalError) => {
                actix_web::HttpResponse::InternalServerError().finish()
            }
            Err(api::ErrorCode::BadRequest) => actix_web::HttpResponse::BadRequest().finish(),
            Err(api::ErrorCode::PleaseRetry) => panic!("not expecting 'please retry' here"),
        }
    }

    /// Implements the [`api::auths::YiviReleaseNextSessionEP`] endpoint.
    pub async fn handle_yivi_release_next_session(
        app: Rc<Self>,
        req: web::Json<api::auths::YiviReleaseNextSessionReq>,
    ) -> api::Result<api::auths::YiviReleaseNextSessionResp> {
        let csc = app.chained_sessions_ctl_or_bad_request()?;
        let yivi = app.get_yivi()?;

        let api::auths::YiviReleaseNextSessionReq {
            state,
            next_session,
        } = req.into_inner();

        let Some(state) = AuthState::unseal(&state, &app.auth_state_secret) else {
            return Ok(api::auths::YiviReleaseNextSessionResp::PleaseRestartAuth);
        };

        let Some(session_id) = state.yivi_chained_session_id else {
            log::debug!(
                "yivi-release-next-session endpoint called on a authentication session without a yivi chained session"
            );
            return Err(api::ErrorCode::BadRequest);
        };

        let esr = if let Some(jwt) = next_session {
            Some(
                yivi::ExtendedSessionRequest::open_signed(
                    &jwt,
                    &yivi.requestor_creds.to_verifying_credentials(),
                )
                .map_err(|err| {
                    log::debug!("failed to open signed extended session request: {}", err);
                    api::ErrorCode::BadRequest
                })?,
            )
        } else {
            None
        };

        csc.release_next_session(session_id, esr).await
    }
}

/// Keeps track of chained sessions
///
/// Create using [`Self::new`].  Cheaply cloneable.  
#[derive(Clone)]
pub struct ChainedSessionsCtl {
    sender: tokio::sync::mpsc::Sender<CscCommand>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, Default)]
pub struct ChainedSessionsConfig {}

type NextSession = Option<yivi::ExtendedSessionRequest>;

type CreateSessionCrs = tokio::sync::oneshot::Sender<api::Result<id::Id>>;
type WaitForResultCrs =
    tokio::sync::oneshot::Sender<api::Result<api::auths::YiviWaitForResultResp>>;
type WaitForNextSessionCrs = tokio::sync::oneshot::Sender<api::Result<NextSession>>;
type ReleaseNextSessionCrs =
    tokio::sync::oneshot::Sender<api::Result<api::auths::YiviReleaseNextSessionResp>>;

enum CscCommand {
    CreateSession {
        resp_sender: CreateSessionCrs,
    },
    WaitForResult {
        chained_session_id: id::Id,
        resp_sender: WaitForResultCrs,
    },
    WaitForNextSession {
        chained_session_id: id::Id,
        disclosure: jwt::JWT,
        resp_sender: WaitForNextSessionCrs,
    },
    ReleaseNextSession {
        chained_session_id: id::Id,
        next_session_request: NextSession,
        resp_sender: ReleaseNextSessionCrs,
    },
}

impl ChainedSessionsCtl {
    /// Creates a new chained session, returning its [`id::Id`]
    pub async fn create_session(&self) -> api::Result<id::Id> {
        let (resp_sender, resp_receiver) = tokio::sync::oneshot::channel();

        self.send_command(CscCommand::CreateSession { resp_sender })
            .await?;

        let Ok(resp) = resp_receiver.await else {
            log::warn!("chained session control create-session response channel closed early");
            return Err(api::ErrorCode::InternalError);
        };

        resp
    }

    /// Wait for the disclosure to arrive for the given chained session
    pub async fn wait_for_result(
        &self,
        chained_session_id: id::Id,
    ) -> api::Result<api::auths::YiviWaitForResultResp> {
        let (resp_sender, resp_receiver) = tokio::sync::oneshot::channel();

        self.send_command(CscCommand::WaitForResult {
            chained_session_id,
            resp_sender,
        })
        .await?;

        let Ok(resp) = resp_receiver.await else {
            log::warn!("chained session control wait-for-result response channel closed early");
            return Err(api::ErrorCode::InternalError);
        };

        resp
    }

    /// Registers incoming disclosure and waits for the next session.
    ///
    /// Returns `None` if the yivi session is to be ended normally, without starting a next
    /// session.
    pub async fn wait_for_next_session(
        &self,
        chained_session_id: id::Id,
        disclosure: jwt::JWT,
    ) -> api::Result<NextSession> {
        let (resp_sender, resp_receiver) = tokio::sync::oneshot::channel();

        self.send_command(CscCommand::WaitForNextSession {
            chained_session_id,
            disclosure,
            resp_sender,
        })
        .await?;

        let Ok(resp) = resp_receiver.await else {
            log::warn!(
                "chained session control wait-for-next-session response channel closed early"
            );
            return Err(api::ErrorCode::InternalError);
        };

        resp
    }

    /// Hands the next session request (if any) to the waiting yivi server
    pub async fn release_next_session(
        &self,
        chained_session_id: id::Id,
        next_session_request: NextSession,
    ) -> api::Result<api::auths::YiviReleaseNextSessionResp> {
        let (resp_sender, resp_receiver) = tokio::sync::oneshot::channel();

        self.send_command(CscCommand::ReleaseNextSession {
            chained_session_id,
            next_session_request,
            resp_sender,
        })
        .await?;

        let Ok(resp) = resp_receiver.await else {
            log::warn!(
                "chained session control release-next-session response channel closed early"
            );
            return Err(api::ErrorCode::InternalError);
        };

        resp
    }

    async fn send_command(&self, cmd: CscCommand) -> api::Result<()> {
        self.sender.send(cmd).await.map_err(|_| {
            log::warn!("chained session control command channel closed early");
            api::ErrorCode::InternalError
        })
    }

    /// Creates a new [`ChainedSessionsCtl`] instance, and spawns a background task to drive it.
    pub fn new(ctx: YiviCtx) -> Self {
        let (sender, receiver) = tokio::sync::mpsc::channel(10);

        tokio::spawn(async {
            log::trace!("spawned chained sessions control task");

            ChainedSessionsCtl::drive(ctx, receiver).await;

            log::trace!("chained sessions control task is about to complete");
        });

        Self { sender }
    }

    async fn drive(ctx: YiviCtx, mut receiver: tokio::sync::mpsc::Receiver<CscCommand>) {
        let mut backend = ChainedSessionsBackend::new(ctx);

        loop {
            tokio::select! {
                cmd_maybe = receiver.recv() => {
                    let Some(cmd) = cmd_maybe else {
                        // channel is closed, no more commands are coming, so we can abort
                        return
                    };

                    backend.handle_cmd(cmd).await;
                }
            };
        }
    }
}

enum ChainedSessionState {
    WaitingForYiviServer {
        waiters: Vec<WaitForResultCrs>,
    },
    YiviServerWaiting {
        disclosure: jwt::JWT,
        waiter: WaitForNextSessionCrs,
    },
}

/// Backend to [`ChainedSessionsCtl`].
struct ChainedSessionsBackend {
    #[expect(dead_code)]
    ctx: YiviCtx,
    sessions: HashMap<id::Id, ChainedSessionState>,
}

impl ChainedSessionsBackend {
    fn new(ctx: YiviCtx) -> Self {
        Self {
            ctx,
            sessions: Default::default(),
        }
    }

    async fn handle_cmd(&mut self, cmd: CscCommand) {
        match cmd {
            CscCommand::WaitForResult {
                chained_session_id,
                resp_sender,
            } => {
                self.handle_wait_for_result(chained_session_id, resp_sender)
                    .await
            }
            CscCommand::WaitForNextSession {
                chained_session_id,
                disclosure,
                resp_sender,
            } => {
                self.handle_wait_for_next_session(chained_session_id, disclosure, resp_sender)
                    .await
            }
            CscCommand::CreateSession { resp_sender } => {
                self.handle_create_session(resp_sender).await
            }
            CscCommand::ReleaseNextSession {
                chained_session_id,
                next_session_request,
                resp_sender,
            } => {
                self.handle_release_next_session(
                    chained_session_id,
                    next_session_request,
                    resp_sender,
                )
                .await
            }
        }
    }

    fn respond_to<T>(
        resp_sender: tokio::sync::oneshot::Sender<T>,
        resp: T,
        chained_session_id: id::Id,
    ) {
        if resp_sender.send(resp).is_err() {
            log::warn!(
                "response channel for chained session {chained_session_id} was closed before response could be sent"
            );
        }
    }

    async fn handle_create_session(&mut self, resp_sender: CreateSessionCrs) {
        let chained_session_id = id::Id::random();

        assert!(
            self.sessions
                .insert(
                    chained_session_id,
                    ChainedSessionState::WaitingForYiviServer { waiters: vec![] }
                )
                .is_none(),
            "against all odds, 256-bit random ids collided!"
        );

        log::trace!("chained session {chained_session_id} created");

        Self::respond_to(resp_sender, Ok(chained_session_id), chained_session_id);
    }

    async fn handle_wait_for_result(
        &mut self,
        chained_session_id: id::Id,
        resp_sender: WaitForResultCrs,
    ) {
        let Some(session) = self.sessions.get_mut(&chained_session_id) else {
            Self::respond_to(
                resp_sender,
                Ok(api::auths::YiviWaitForResultResp::SessionGone),
                chained_session_id,
            );
            return;
        };

        match session {
            ChainedSessionState::WaitingForYiviServer { waiters } => {
                log::trace!(
                    "registered waiter for the result of chained session {chained_session_id}",
                );
                waiters.push(resp_sender)
            }
            ChainedSessionState::YiviServerWaiting { disclosure, .. } => {
                log::trace!(
                    "result for chained session {chained_session_id} requested and immediately available"
                );
                Self::respond_to(
                    resp_sender,
                    Ok(api::auths::YiviWaitForResultResp::Success {
                        disclosure: disclosure.clone(),
                    }),
                    chained_session_id,
                )
            }
        }
    }

    async fn handle_wait_for_next_session(
        &mut self,
        chained_session_id: id::Id,
        disclosure: jwt::JWT,
        resp_sender: WaitForNextSessionCrs,
    ) {
        let Some(session) = self.sessions.get_mut(&chained_session_id) else {
            log::warn!(
                "yivi server submitted disclosure for a chained session {chained_session_id} that cannot be found - was the yivi server too slow?"
            );
            Self::respond_to(resp_sender, Ok(None), chained_session_id);
            return;
        };

        // check session is ready for the yivi server
        match session {
            ChainedSessionState::WaitingForYiviServer { .. } => {
                // this is what we want
            }
            ChainedSessionState::YiviServerWaiting { .. } => {
                log::warn!(
                    "a second yivi server wanted to wait for chained session {chained_session_id}"
                );
                Self::respond_to(resp_sender, Ok(None), chained_session_id);
                return;
            }
        }

        let old_session = std::mem::replace(
            session,
            ChainedSessionState::YiviServerWaiting {
                disclosure: disclosure.clone(),
                waiter: resp_sender,
            },
        );

        match old_session {
            ChainedSessionState::WaitingForYiviServer { waiters } => {
                // release waiters
                log::trace!(
                    "releasing {} waiter(s) on the result of chained session {chained_session_id}",
                    waiters.len()
                );
                for waiter in waiters.into_iter() {
                    Self::respond_to(
                        waiter,
                        Ok(api::auths::YiviWaitForResultResp::Success {
                            disclosure: disclosure.clone(),
                        }),
                        chained_session_id,
                    )
                }
            }
            ChainedSessionState::YiviServerWaiting { .. } => {
                panic!("session changed unexpectedly");
            }
        }
    }

    async fn handle_release_next_session(
        &mut self,
        chained_session_id: id::Id,
        next_session_request: NextSession,
        resp_sender: ReleaseNextSessionCrs,
    ) {
        let Some(session) = self.sessions.get_mut(&chained_session_id) else {
            log::debug!(
                "request to release chained session {chained_session_id} that cannot be found "
            );
            Self::respond_to(
                resp_sender,
                Ok(api::auths::YiviReleaseNextSessionResp::SessionGone),
                chained_session_id,
            );
            return;
        };

        // check session is ready for the yivi server
        match session {
            ChainedSessionState::WaitingForYiviServer { .. } => {
                log::debug!(
                    "request to release a yivi server that's not there yet, inchained session {chained_session_id}"
                );
                Self::respond_to(
                    resp_sender,
                    Ok(api::auths::YiviReleaseNextSessionResp::TooEarly),
                    chained_session_id,
                );
                return;
            }
            ChainedSessionState::YiviServerWaiting { .. } => {
                // this is what we want
            }
        }

        log::trace!(
            "yivi server is about to be released from chained session {chained_session_id}"
        );
        let Some(ChainedSessionState::YiviServerWaiting { waiter, .. }) =
            self.sessions.remove(&chained_session_id)
        else {
            panic!("chained session state changed unexpectedly");
        };

        Self::respond_to(waiter, Ok(next_session_request), chained_session_id);

        Self::respond_to(
            resp_sender,
            Ok(api::auths::YiviReleaseNextSessionResp::Success {}),
            chained_session_id,
        );
    }
}
