//! What's common between PubHubs servers
use actix_web::web;
use anyhow::Result;
use tokio::sync::mpsc;

/// Common API to the different PubHubs servers, used by the [crate::servers::run::Runner].
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

/// What moved accross threads by a [Server] to create its [App] instances.
pub trait AppCreator<ServerT: Server>: Send + Clone + 'static {
    /// Create an [App] instance.
    ///
    /// The `shutdown_sender` [mpsc::Sender] can be used to restart the server.  It's
    /// up to the implementor to clone it.
    fn create(&self, shutdown_sender: &ShutdownSender<ServerT>) -> ServerT::AppT;
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

/// What's common between the [actix_web::App]s used by the different PubHubs servers.
///
/// Each [actix_web::App] gets access to an instance of the appropriate implementation of [App].
pub trait App {
    fn configure_actix_app(&self, sc: &mut web::ServiceConfig);
}

/// What's internally common between PubHubs servers.
pub struct ServerBase {
    config: crate::servers::Config,
}

impl ServerBase {
    pub fn new(config: &crate::servers::Config) -> Self {
        Self {
            config: config.clone(),
        }
    }
}
