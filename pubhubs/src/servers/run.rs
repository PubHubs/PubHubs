//! Running PubHubs [Server]s
use core::future::Future;
use core::pin::Pin;
use core::task::{Context, Poll};
use std::net::SocketAddr;

use actix_web::web;
use anyhow::Result;
use tokio::sync::mpsc;

use crate::servers::{for_all_servers, App, AppBase, AppCreator, Server, ShutdownCommand};

/// Runs the PubHubs server(s) from the given configuration.
///
/// Returns if one of the servers crashes.
pub async fn run(config: crate::servers::Config) -> Result<()> {
    let mut joinset = tokio::task::JoinSet::<Result<()>>::new();

    macro_rules! run_server {
        ($server:ident) => {
            if let Some(server_config) = config.$server.as_ref() {
                joinset.spawn(crate::servers::run::Runner::<
                    crate::servers::$server::Server,
                >::new(&config, server_config)?);
            }
        };
    }

    for_all_servers!(run_server);

    // Wait for one of the servers to return, panic or be cancelled.
    // By returning, joinset is dropped and all server tasks are aborted.
    joinset.join_next().await.expect("no servers to wait on")?
}

/// Runs a [Server].  Implements [Future].
pub struct Runner<ServerT: Server> {
    pubhubs_server: ServerT,
    actix_server: ActixServer<ServerT>,
    bind_to: SocketAddr,
}

/// Keeps track of the [State] of an Actix HTTP server
struct ActixServer<ServerT: Server> {
    /// The actual actix TCP server
    inner: actix_web::dev::Server,

    state: State<ServerT>,
}

/// State of the server as far as the [Runner] is concerned.  [Server]s may have more internal
/// state.
enum State<S: Server> {
    /// Waiting for shutdown command, or actix to stop
    Running {
        /// Receiver used by [App]s to signal this [Runner] to either stop or restart
        /// the actix server.  During a restart, the [Server] (and thus the resulting [App]s too)
        /// may be modified.
        shutdown_receiver: mpsc::Receiver<ShutdownCommand<S>>,
    },

    /// Shutdown command received; just waiting for actix to stop
    ShutdownReceived {
        /// What to do after the actix TCP server stops.
        shutdown_command: ShutdownCommand<S>,

        /// The future that drives the halting of actix, [None] if already complete
        fut: Option<Pin<Box<dyn Future<Output = ()> + Send>>>,
    },

    Exited,
}

impl<S: Server> std::fmt::Display for State<S> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
        match self {
            State::Running { .. } => write!(f, "running"),
            State::ShutdownReceived {
                shutdown_command, ..
            } => {
                write!(f, "received {} command", shutdown_command)
            }
            State::Exited => write!(f, "exited"),
        }
    }
}

impl<S: Server> Runner<S> {
    pub fn new<T>(
        global_config: &crate::servers::Config,
        server_config: &crate::servers::config::ServerConfig<T>,
    ) -> Result<Self> {
        let pubhubs_server = S::new(global_config);
        let bind_to = server_config.bind_to; // SocketAddr : Copy

        let result = Ok(Runner {
            actix_server: ActixServer::new(&pubhubs_server, &bind_to)?,
            pubhubs_server,
            bind_to,
        });

        result
    }
}

impl<S: Server + Unpin> Future for Runner<S> {
    // NOTE: We rely on the fact that all fields of Runner, and thus Runner itself, is Unpin.
    // When one of the fields of Runner becomes !Unpin, we should add 'structural pinning' and
    // corresponding 'projections' for those; see the module level documentation of [std::pin].
    //
    // To ensure safety, it might be best to use a crate to provide these projections for us.
    // The futures crate seems to use the pin-project-lite crate.
    type Output = Result<()>;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        // The main task is to drive the self.actix_server.inner future, but we must also
        // check if there's a shutdown command (when we're in the Running state)
        // and make sure the stopping of actix server is driven (when we're in the ShutdownReceived
        // state.)
        log::debug!(
            "{} is being polled in state {} - this should happen only occasionally",
            S::NAME,
            self.actix_server.state
        );
        match &mut self.actix_server.state {
            State::Running { shutdown_receiver } => {
                match shutdown_receiver.poll_recv(cx) {
                    Poll::Ready(None) => panic!("shutdown channel should never be closed"),
                    Poll::Ready(Some(shutdown_command)) => {
                        self.actix_server.state = State::ShutdownReceived {
                            shutdown_command,
                            fut: Some(Box::pin(self.actix_server.inner.handle().stop(true))),
                        }
                    }
                    Poll::Pending => { /* ok, continue */ }
                }
            }

            State::ShutdownReceived { ref mut fut, .. } => {
                if let Some(some_fut) = fut {
                    match Pin::new(some_fut).poll(cx) {
                        Poll::Ready(()) => {
                            *fut = None;
                        }
                        Poll::Pending => { /* ok, continue */ }
                    }
                }
            }

            State::Exited => panic!("ready already returned from this future"),
        }

        loop {
            let result: std::io::Result<()> =
                std::task::ready!(Pin::new(&mut self.actix_server.inner).poll(cx));

            // Actix server stopped.  What we do next depends on the state, but the default
            // is to exit.
            let state = std::mem::replace(&mut self.actix_server.state, State::Exited);

            match state {
                State::Running { .. }
                | State::ShutdownReceived {
                    shutdown_command: ShutdownCommand::Exit,
                    ..
                } => {
                    log::info!("stopping {}", S::NAME);
                    return Poll::Ready(result.map_err(Into::into));
                }

                State::ShutdownReceived {
                    shutdown_command: ShutdownCommand::ModifyAndRestart(modifier),
                    ..
                } => {
                    log::info!("attempting to restart {}", S::NAME);

                    if result.is_err() {
                        return Poll::Ready(result.map_err(Into::into));
                    }

                    let result = modifier.modify(&mut self.pubhubs_server);

                    if result.is_err() {
                        return Poll::Ready(result.map_err(Into::into));
                    }

                    // modification succeeded, so recreate actix server
                    self.actix_server = ActixServer::new(&self.pubhubs_server, &self.bind_to)?;

                    // now loop, so that the actix_server.inner and receiver are polled
                }

                State::Exited => panic!("should already have panicked in the previous match"),
            }
        }
    }
}

impl<S: Server> ActixServer<S> {
    fn new(pubhubs_server: &S, bind_to: &SocketAddr) -> Result<ActixServer<S>> {
        let app_creator = pubhubs_server.app_creator();

        let (shutdown_sender, shutdown_receiver) = mpsc::channel(1);

        log::info!("{}: binding actix server to {}", S::NAME, bind_to);

        Ok(ActixServer {
            inner: actix_web::HttpServer::new(move || {
                let app = app_creator.create(&shutdown_sender);

                actix_web::App::new().configure(|sc: &mut web::ServiceConfig| {
                    // first configure endpoints common to all servers
                    AppBase::<S>::configure_actix_app(&app, sc);

                    // and then server-specific endpoints
                    app.configure_actix_app(sc);
                })
            })
            .bind(bind_to)?
            .run(),

            state: State::Running { shutdown_receiver },
        })
    }
}
