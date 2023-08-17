use actix_web::web;
use anyhow::Result;
use std::future::Future;
use std::net::SocketAddr;
use std::pin::Pin;
use std::task::{Context, Poll};
use tokio::sync::mpsc;

/// What's common between the different PubHubs servers.
///
/// A single instance of the appropriate implementation of [Server] is created
/// for each server that's being run, and it's mainly responsible for creating
/// immutable [App] instances to be sent to the individual threads.
///
/// For efficiency's sake, only the [App] instances are available to each thread,
/// and are immutable. To change the server's state, all apps must be restarted.
pub trait Server: Unpin + Sized + 'static {
    type AppT: App;
    const NAME: &'static str;

    /// Is moved accross threads to create the [App]s.
    type AppCreatorT: AppCreator<Self>;

    /// Is moved accross threads when the server is restarted
    type Modifier: (FnOnce(&mut Self) -> Result<()>) + Send + 'static + Unpin;

    fn new(config: &crate::servers::Config) -> Self;

    fn app_creator(&self) -> Self::AppCreatorT;
}

/// What's passed to an [App] via [AppCreator] to signal a shutdown command
pub type ShutdownSender<S> = mpsc::Sender<ShutdownCommand<S>>;

pub trait AppCreator<ServerT: Server>: Send + Clone + 'static {
    /// Create an [App] instance.
    ///
    /// The `shutdown_sender` [mpsc::Sender] can be used to restart the server.  It's
    /// up to the implementor to clone it.
    fn create(&self, shutdown_sender: &ShutdownSender<ServerT>) -> ServerT::AppT;
}

/// Runs a [Server]
pub struct Runner<ServerT: Server> {
    pubhubs_server: ServerT,
    actix_server: ActixServer<ServerT>,
    bind_to: SocketAddr,
}

struct ActixServer<ServerT: Server> {
    /// The actual actix TCP server
    inner: actix_web::dev::Server,

    state: State<ServerT>,
}

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

pub enum ShutdownCommand<S: Server> {
    Exit,
    ModifyAndRestart(S::Modifier),
}

impl<S: Server> std::fmt::Display for ShutdownCommand<S> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
        match self {
            ShutdownCommand::Exit => write!(f, "exit"),
            ShutdownCommand::ModifyAndRestart(..) => write!(f, "restart"),
        }
    }
}

impl<S: Server> ActixServer<S> {
    fn new(pubhubs_server: &S, bind_to: &SocketAddr) -> Result<ActixServer<S>> {
        let app_creator = pubhubs_server.app_creator();

        let (shutdown_sender, shutdown_receiver) = mpsc::channel(1);

        Ok(ActixServer {
            inner: actix_web::HttpServer::new(move || {
                let app = app_creator.create(&shutdown_sender);

                actix_web::App::new()
                    .configure(|sc: &mut web::ServiceConfig| app.configure_actix_app(sc))
            })
            .bind(bind_to)?
            .run(),

            state: State::Running { shutdown_receiver },
        })
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

        log::info!("created {}", S::NAME);

        result
    }
}

impl<S: Server> Future for Runner<S> {
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

                    let result = modifier(&mut self.pubhubs_server);

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

/// What's common between the [actix_web::App]s used by the different PubHubs servers.
///
/// Each [actix_web::App] gets access to an instance of the appropriate implementation of [App].
pub trait App {
    fn configure_actix_app(&self, sc: &mut web::ServiceConfig);
}
