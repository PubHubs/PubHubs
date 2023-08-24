//! What's common between PubHubs servers
use actix_web::web;
use anyhow::Result;
use tokio::sync::mpsc;

use std::sync::Arc;

/// Common API to the different PubHubs servers, used by the [crate::servers::run::Runner].
///
/// A single instance of the appropriate implementation of [Server] is created
/// for each server that's being run, and it's mainly responsible for creating
/// immutable [App] instances to be sent to the individual threads.
///
/// For efficiency's sake, only the [App] instances are available to each thread,
/// and are immutable. To change the server's state, all apps must be restarted.
pub trait Server: Sized + 'static {
    type AppT: App;
    const NAME: &'static str;

    /// Is moved accross threads to create the [App]s.
    type AppCreatorT: AppCreator<Self>;

    fn new(config: &crate::servers::Config) -> Self;

    fn app_creator(&self) -> Self::AppCreatorT;
}

/// What's passed to an [App] via [AppCreator] to signal a shutdown command
pub type ShutdownSender<S> = mpsc::Sender<ShutdownCommand<S>>;

/// What's moved  accross threads by a [Server] to create its [App] instances.
pub trait AppCreator<ServerT: Server>: Send + Clone + 'static {
    /// Create an [App] instance.
    ///
    /// The `shutdown_sender` [mpsc::Sender] can be used to restart the server.  It's
    /// up to the implementor to clone it.
    fn create(&self, shutdown_sender: &ShutdownSender<ServerT>) -> ServerT::AppT;
}

/// What modifies a [Server] when it is restarted via [ShutdownCommand::ModifyAndRestart].
///
/// It is [Send] and `'static` because it's moved accross threads, from an [App] to the task
/// running the [Server].
///
/// We do not use a trait like `(FnOnce(&mut ServerT) -> Result<()>) + Send + 'static`,
/// because it can not (yet) be implemented by users.
pub trait Modifier<ServerT: Server>: Send + 'static {
    /// Performs the modification to the [Server].  If an error is returned, the server is not
    /// restarted, but exits.
    fn modify(self: Box<Self>, server: &mut ServerT) -> Result<()>;
}

impl<S: Server, F: FnOnce(&mut S) -> Result<()> + Send + 'static> Modifier<S> for F {
    fn modify(self: Box<Self>, server: &mut S) -> Result<()> {
        self(server)
    }
}

/// Commands an [App] can issue to a [crate::servers::run::Runner] via a [ShutdownSender].
pub enum ShutdownCommand<S: Server> {
    /// Stop the server
    Exit,

    /// Stop the server, apply the enclosed modification, and, if it succeeded, restart the server.
    ///
    /// Server restarts should be performed sparingly, and may take seconds to minutes (because
    /// actix waits for workers to shutdown gracefully.)
    ModifyAndRestart(Box<dyn Modifier<S>>),
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

/// What's internally common between PubHubs [Server]s.
pub struct ServerBase {
    pub config: crate::servers::Config,
    pub state: State,
}

impl ServerBase {
    pub fn new(config: &crate::servers::Config) -> Self {
        Self {
            config: config.clone(),
            state: State::Discovery(Arc::new(tokio::sync::Mutex::new(false))),
        }
    }
}

/// What's internally common between PubHubs [AppCreator]s.
#[derive(Clone)]
pub struct AppCreatorBase {
    pub state: State,
}

impl AppCreatorBase {
    pub fn new(server_base: &ServerBase) -> Self {
        Self {
            state: server_base.state.clone(),
        }
    }
}

/// What's internally common between PubHubs [App]s.
pub struct AppBase<S: Server> {
    pub state: State,
    pub shutdown_sender: ShutdownSender<S>,
}

impl<S: Server> AppBase<S> {
    pub fn new(creator_base: &AppCreatorBase, shutdown_sender: &ShutdownSender<S>) -> Self {
        Self {
            state: creator_base.state.clone(),
            shutdown_sender: shutdown_sender.clone(),
        }
    }

    /// Issues ShutdownCommand to server.  Does not wait for the command to complete
    ///
    /// Might fail if the server is already down, or someone else issued a [ShutdownCommand]
    /// already.
    pub fn shutdown_server(&self, command: ShutdownCommand<S>) -> bool {
        let result = self.shutdown_sender.try_send(command);

        if result.is_ok() {
            return true;
        }

        let (command, reason) = match result.unwrap_err() {
            tokio::sync::mpsc::error::TrySendError::Full(cmd) => {
                (cmd, "another shutdown command has already been issued")
            }
            tokio::sync::mpsc::error::TrySendError::Closed(cmd) => (cmd, "already offline"),
        };

        log::warn!(
            "failed to issue {} command to {}: {}",
            command,
            S::NAME,
            reason
        );

        return false;
    }

    /// Issues the restart command to the [Server] with the given [Modifier].  See [Self::shutdown_server].
    /// for more details.
    pub fn restart_server(&self, modifier: impl Modifier<S>) -> bool {
        self.shutdown_server(ShutdownCommand::ModifyAndRestart(Box::new(modifier)))
    }

    /// Issues the stop command to the [Server].  See [Self::shutdown_server].
    pub fn stop_server(&self) -> bool {
        self.shutdown_server(ShutdownCommand::Exit)
    }
}

/// State of discovery of details of the PubHubs constellation.
///
/// Will be sent accross threads from [Server] via [AppCreator] to [App].
/// Cheaply cloneable.
#[derive(Clone)]
pub enum State {
    /// Waiting for information from other servers.
    ///
    /// The lock is taken by the task performing discovery.
    ///
    /// If unlocked and false, discovery has not yet started.
    ///
    /// If unlocked and  true, discovery is complete, but the actix server has not yet
    /// been restarted.
    Discovery(Arc<tokio::sync::Mutex<bool>>),

    /// Server has completed discovery and is running normally.
    UpAndRunning,
}
