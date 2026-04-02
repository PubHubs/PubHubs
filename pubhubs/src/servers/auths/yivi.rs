//! Implementation of the `/yivi/...` endpoints
use super::server::*;

use crate::api;
use crate::id;
use crate::misc;
use crate::misc::jwt;
use crate::misc::stream_ext::StreamExt as _;
use crate::servers::yivi;

use super::server::YiviCtx;

use std::collections::{HashMap, VecDeque};
use std::rc::Rc;

use actix_web::web;
use futures::future::FutureExt as _;
use futures::stream::StreamExt as _;

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

        let Some(ChainedSessionSetup { id: session_id, .. }) = state.yivi_chained_session else {
            log::debug!(
                "yivi-wait-for-result endpoint called on a authentication session without a yivi chained session"
            );
            return Err(api::ErrorCode::BadRequest);
        };

        csc.wait_for_result(session_id).await
    }

    /// Implements the [`api::auths::YIVI_NEXT_SESSION_PATH`] endpoint.
    pub async fn handle_yivi_next_session(
        app: web::Data<std::rc::Rc<App>>,
        query: web::Query<api::auths::YiviNextSessionQuery>,
        result_jwt: String,
    ) -> impl actix_web::Responder {
        use actix_web::Either::{Left, Right};

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
            return Left(actix_web::HttpResponse::BadRequest().finish());
        };

        let Some(ChainedSessionSetup {
            id: chained_session_id,
            drip,
        }) = state.yivi_chained_session
        else {
            log::warn!(
                "yivi server submitted auth state to next-session endpoint without chained session id"
            );
            return Left(actix_web::HttpResponse::BadRequest().finish());
        };

        // NOTE: ChainedSessionsCtl is cheaply cloneable
        let Some(csc) = app.chained_sessions_ctl.clone() else {
            log::warn!("next-session endpoint invoked, but chained sessions are not supported");
            return Left(actix_web::HttpResponse::BadRequest().finish());
        };

        let Some(yivi) = app.yivi.as_ref() else {
            log::warn!("next-session endpoint invoked, but yivi is not supported");
            return Left(actix_web::HttpResponse::BadRequest().finish());
        };

        let Ok(..) = yivi::SessionResult::open_signed(&result_jwt, &yivi.server_creds) else {
            log::debug!(
                "invalid yivi signed session result submitted by yivi server (or imposter)",
            );
            log::trace!("invalid signed session result jwt: {result_jwt}");
            return Left(actix_web::HttpResponse::BadRequest().finish());
        };

        log::trace!(
            "yivi server submitted disclosure and is waiting for chained session {chained_session_id}"
        );

        let request_id = id::Id::random();

        let wfns_fut =
            csc.clone()
                .wait_for_next_session(chained_session_id, request_id, result_jwt);

        if drip {
            // When wfns_fut is dropped (because actix has detected the yivi server has
            // disconnected), we want to abort the WaitForNextSession via AbortWaitForNextSession.
            let on_drop = move || {
                tokio::task::spawn_local(async move {
                    let _ = csc
                        .send_command(CscCommand::AbortWaitForNextSession {
                            chained_session_id,
                            request_id,
                        })
                        .await;
                });
            };

            let wfns_fut = async move {
                let _deferred = misc::defer(on_drop);
                wfns_fut.await
            };

            Right(Left(Self::dripping_wfns_responder(wfns_fut)))
        } else {
            Right(Right(Self::regular_wfns_responder(wfns_fut).await))
        }
    }

    async fn regular_wfns_responder(
        wfns_fut: impl Future<Output = api::Result<NextSession>>,
    ) -> impl actix_web::Responder {
        match wfns_fut.await {
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

    fn dripping_wfns_responder(
        wfns_fut: impl Future<Output = api::Result<NextSession>> + 'static,
    ) -> impl actix_web::Responder {
        let drips = tokio_stream::wrappers::IntervalStream::new(tokio::time::interval(
            core::time::Duration::from_secs(1),
        ))
        .map(|_| Ok(bytes::Bytes::from_static(b" ")));

        let result_bytes_fut = wfns_fut.map(|result| match result {
            Ok(Some(session_request)) => {
                log::debug!("sent chained session to yivi server");
                Ok(serde_json::to_vec_pretty(&session_request)
                    .map_err(|err| {
                        log::error!("failed to serialize session_request to json: {err:#}");
                        api::ErrorCode::InternalError
                    })?
                    .into())
            }
            Ok(None) => {
                log::error!("bug: `None` session_request reached dripping chained session");
                Err(api::ErrorCode::InternalError)
            }
            Err(err) => {
                log::warn!("failed to release session_request to yivi server: {err:#}");
                Err(err)
            }
        });

        let stream = drips.until_overridden_by(result_bytes_fut.into_stream());

        actix_web::HttpResponse::Ok()
            // NB: Content-Type is not checked by irmago at the moment
            .content_type(mime::APPLICATION_JSON)
            .streaming(stream)
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

        let Some(ChainedSessionSetup {
            id: session_id,
            drip,
        }) = state.yivi_chained_session
        else {
            log::debug!(
                "yivi-release-next-session endpoint called on a authentication session without a yivi chained session"
            );
            return Err(api::ErrorCode::BadRequest);
        };

        if next_session.is_none() && drip {
            log::debug!(
                "yivi-release-next-session endpoint on a dripping chained session, but with empty next session."
            );
            return Err(api::ErrorCode::BadRequest);
        }

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

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ChainedSessionsConfig {
    #[serde(with = "crate::misc::time_ext::human_duration")]
    #[serde(default = "default_chained_session_validity")]
    pub session_validity: core::time::Duration,
}

fn default_chained_session_validity() -> core::time::Duration {
    core::time::Duration::from_secs(10 * 60) // 10 minutes
}

impl Default for ChainedSessionsConfig {
    fn default() -> Self {
        crate::misc::serde_ext::default_object()
    }
}

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
        /// `request_id` should be random and is passed in `Self::AbortWaitForNextSession` to abort
        request_id: id::Id,
        disclosure: jwt::JWT,
        resp_sender: WaitForNextSessionCrs,
    },
    AbortWaitForNextSession {
        chained_session_id: id::Id,
        request_id: id::Id,
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
        self,
        chained_session_id: id::Id,
        request_id: id::Id,
        disclosure: jwt::JWT,
    ) -> api::Result<NextSession> {
        let (resp_sender, resp_receiver) = tokio::sync::oneshot::channel();

        self.send_command(CscCommand::WaitForNextSession {
            chained_session_id,
            request_id,
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
                _ = backend.sleep_until_next_expiry() => {
                    backend.expire_next();
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
        /// Yivi servers waiting to be released.  The `Id` refers to the yivi server.
        waiters: HashMap<id::Id, WaitForNextSessionCrs>,
    },
}

/// Backend to [`ChainedSessionsCtl`].
struct ChainedSessionsBackend {
    ctx: YiviCtx,
    sessions: HashMap<id::Id, ChainedSessionState>,

    /// Session ids ordered by expiry instant.  The session that will expire soonest
    /// is in the front.  May contain ids already removed from [`Self::sessions`]
    /// (namely, sessions that completed normally before expiry).
    expiry_queue: VecDeque<(tokio::time::Instant, id::Id)>,
}

impl ChainedSessionsBackend {
    fn new(ctx: YiviCtx) -> Self {
        Self {
            ctx,
            sessions: Default::default(),
            expiry_queue: Default::default(),
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
                request_id,
                disclosure,
                resp_sender,
            } => {
                self.handle_wait_for_next_session(
                    chained_session_id,
                    request_id,
                    disclosure,
                    resp_sender,
                )
                .await
            }
            CscCommand::AbortWaitForNextSession {
                chained_session_id,
                request_id,
            } => {
                self.handle_abort_wait_for_next_session(chained_session_id, request_id)
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

        let expiry =
            tokio::time::Instant::now() + self.ctx.chained_sessions_config.session_validity;
        self.expiry_queue.push_back((expiry, chained_session_id));

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
        request_id: id::Id,
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
                // this is what we want; handled below
            }
            ChainedSessionState::YiviServerWaiting {
                disclosure: stored_disclosure,
                waiters,
            } => {
                if &disclosure != stored_disclosure {
                    log::warn!(
                        "second yivi server submitted a different disclosure for chained session {chained_session_id}"
                    );
                    Self::respond_to(
                        resp_sender,
                        Err(api::ErrorCode::BadRequest),
                        chained_session_id,
                    );
                    return;
                }
                log::trace!(
                    "an additional yivi server ({request_id}) is waiting for chained session {chained_session_id}"
                );
                let should_be_none = waiters.insert(request_id, resp_sender);
                if should_be_none.is_some() {
                    log::error!("bug: 256-bit random `request_id` collided - was it random?");
                    panic!("bug: random `request_id`s collided");
                }
                return;
            }
        }

        let old_session = std::mem::replace(
            session,
            ChainedSessionState::YiviServerWaiting {
                disclosure: disclosure.clone(),
                waiters: [(request_id, resp_sender)].into(),
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

    async fn handle_abort_wait_for_next_session(
        &mut self,
        chained_session_id: id::Id,
        request_id: id::Id,
    ) {
        let Some(session) = self.sessions.get_mut(&chained_session_id) else {
            log::trace!(
                "wanting to abort yivi server request {request_id} of chained session \
                {chained_session_id}, but this session is not there (anymore)"
            );
            return;
        };

        match session {
            ChainedSessionState::WaitingForYiviServer { .. } => {
                log::warn!(
                    "to be aborted yivi server request {request_id} of chained session \
                    {chained_session_id} is not (yet) recorded in chained session state \
                    (nor any other yivi server request)"
                );
            }
            ChainedSessionState::YiviServerWaiting { waiters, .. } => {
                let removed = waiters.remove(&request_id);

                if removed.is_none() {
                    log::warn!(
                        "to be aborted yivi server request {request_id} of chained session \
                        {chained_session_id} is not (yet) recorded in chained session state"
                    );
                }

                // NOTE: there is no need to actually send anything over the response sender in
                // `removed` back to the waiting yivi server, because it has aborted.
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
                    "request to release a yivi server that's not there yet, \
                    in chained session {chained_session_id}"
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
        let Some(ChainedSessionState::YiviServerWaiting { waiters, .. }) =
            self.sessions.remove(&chained_session_id)
        else {
            panic!("chained session state changed unexpectedly");
        };

        if waiters.is_empty() {
            Self::respond_to(
                resp_sender,
                Ok(api::auths::YiviReleaseNextSessionResp::YiviServerGone),
                chained_session_id,
            );
            return;
        }

        for waiter in waiters.into_values() {
            Self::respond_to(waiter, Ok(next_session_request.clone()), chained_session_id);
        }

        Self::respond_to(
            resp_sender,
            Ok(api::auths::YiviReleaseNextSessionResp::Success {}),
            chained_session_id,
        );
    }

    async fn sleep_until_next_expiry(&self) {
        match self.expiry_queue.front() {
            Some((expiry, _)) => tokio::time::sleep_until(*expiry).await,
            None => std::future::pending().await,
        }
    }

    fn expire_next(&mut self) {
        let now = tokio::time::Instant::now();

        while let Some((_, id)) = self.expiry_queue.pop_front_if(|(expiry, _)| *expiry <= now) {
            let Some(session) = self.sessions.remove(&id) else {
                continue; // already completed normally
            };

            log::debug!("chained session {id} expired");
            match session {
                ChainedSessionState::WaitingForYiviServer { waiters } => {
                    for waiter in waiters {
                        Self::respond_to(
                            waiter,
                            Ok(api::auths::YiviWaitForResultResp::SessionGone),
                            id,
                        );
                    }
                }
                ChainedSessionState::YiviServerWaiting { waiters, .. } => {
                    for waiter in waiters.into_values() {
                        Self::respond_to(waiter, Ok(None), id);
                    }
                }
            }
        }
    }
}
