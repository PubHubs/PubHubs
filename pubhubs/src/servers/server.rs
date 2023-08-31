//! What's common between PubHubs servers
use actix_web::web;
use anyhow::Result;
use futures_util::future::LocalBoxFuture;
use tokio::sync::mpsc;

use std::rc::Weak as WeakRc;
use std::sync::Arc;

/// Common API to the different PubHubs servers, used by the [crate::servers::run::Runner].
///
/// A single instance of the appropriate implementation of [Server] is created
/// for each server that's being run, and it's mainly responsible for creating
/// immutable [App] instances to be sent to the individual threads.
///
/// For efficiency's sake, only the [App] instances are available to each thread,
/// and are immutable. To change the server's state, all apps must be restarted.
///
/// An exception to this no-shared-mutable-state mantra is the discovery or startup phase,
/// see [State::Discovery].
pub trait Server: Sized + 'static {
    type AppT: App<Self>;
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
    ModifyAndRestart(BoxModifier<S>),
}

/// Owned dynamically typed [Modifier].
pub type BoxModifier<S> = Box<dyn Modifier<S>>;

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
///
/// Should be cheaply cloneable, like an `Rc<SomeStruct>`.
pub trait App<S: Server>: Clone + 'static {
    /// Allows [App] to add server-specific endpoints.  Non-server specific endpoints are added by
    /// [AppBase::configure_actix_app].
    fn configure_actix_app(&self, sc: &mut web::ServiceConfig);

    /// Runs the discovery routine for this server.
    ///
    /// May panic if the [Server]'s state is not [State::Discovery].
    fn discover(&self) -> LocalBoxFuture<'_, Result<(), DiscoveryError>>;

    /// Returns the [AppBase] this [App] builds on.
    fn base(&self) -> &AppBase<S>;
}

#[derive(thiserror::Error, Debug)]
pub enum DiscoveryError {
    #[error("discovery did not succeed yet")]
    Retryable(#[source] anyhow::Error),

    #[error("fatal error during discovery")]
    Fatal(#[from] anyhow::Error),
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
            state: State::Discovery {
                task_lock: Arc::new(tokio::sync::Mutex::new(())),
                shared: Arc::new(tokio::sync::RwLock::new(DiscoveryState::default())),
            },
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

    /// Configures common endpoints
    pub fn configure_actix_app(app: &S::AppT, sc: &mut web::ServiceConfig) {
        // Make an actix handler from a method on AppBase
        macro_rules! app_method (
            ($method_name:ident) => {
                AppMethod::new(app, AppBase::<S>::$method_name)
            }
        );

        sc.route(
            "/.phc/discovery/run",
            web::get().to(app_method!(handle_discovery_run)),
        );
    }

    async fn handle_discovery_run(app: S::AppT) -> impl actix_web::Responder {
        let base = app.base();

        let task_lock = match base.state {
            State::Discovery { task_lock, shared } => {
                task_lock
            }
            _ => return actix_web::HttpResponse::BadRequest()
                .reason("not in discovery state")
                .finish(),
        }

        let lock_guard = {
            match task_lock.try_lock() {
                Ok(lock_guard) => lock_guard,
                Err(_) => return actix_web::HttpResponse::ServiceUnavailable().reason("discovery already running").finish(),
            }
        };

        let result = app.discover().await;

        if result.is_err() {
            actix_web::HttpResponse::InternalServerError().finish()
        } else {
            actix_web::HttpResponse::Ok().finish()
        }
    }
}

/// An [App] together with a method on it.  Used to pass [App]s to [actix_web::Handler]s.
#[derive(Clone)]
pub struct AppMethod<App, F> {
    app: App,
    f: F,
}

impl<App: Clone, F> AppMethod<App, F> {
    fn new(app: &App, f: F) -> Self {
        AppMethod {
            app: app.clone(),
            f,
        }
    }
}

/// Implements [actix_web::Handler] for an [AppMethod] with the given number of arguments.
///
/// Based on [actix_web]'s implementation of [actix_web::Handler] for [Fn]s.
macro_rules! factory_tuple ({ $($param:ident)* } => {
    impl<Func, Fut, App, $($param,)*> actix_web::Handler<($($param,)*)> for AppMethod<App, Func>
    where
        Func:  Fn(App, $($param),*) -> Fut + Clone + 'static,
        Fut: core::future::Future,
        App: Clone + 'static,
    {
        type Output = Fut::Output;
        type Future = Fut;

        #[inline]
        #[allow(non_snake_case)]
        fn call(&self, ($($param,)*): ($($param,)*)) -> Self::Future {
            (self.f)(self.app.clone(), $($param,)*)
        }
    }
});

factory_tuple! {}
factory_tuple! { A }
factory_tuple! { A B }
factory_tuple! { A B C }
factory_tuple! { A B C D }
factory_tuple! { A B C D E }
factory_tuple! { A B C D E F }
factory_tuple! { A B C D E F G }
factory_tuple! { A B C D E F G H }
factory_tuple! { A B C D E F G H I }
factory_tuple! { A B C D E F G H I J }
factory_tuple! { A B C D E F G H I J K }
factory_tuple! { A B C D E F G H I J K L }
factory_tuple! { A B C D E F G H I J K L M }
factory_tuple! { A B C D E F G H I J K L M N }
factory_tuple! { A B C D E F G H I J K L M N O }
factory_tuple! { A B C D E F G H I J K L M N O P }

/// State of discovery of details of the PubHubs constellation.
///
/// Will be sent accross threads from [Server] via [AppCreator] to [App].
/// Cheaply cloneable.
#[derive(Clone)]
pub enum State {
    /// Waiting for information from other servers.
    Discovery {
        /// This lock is taken by the task performing discovery.
        ///
        /// If unlocked, either discovery has not started; or it was, but crashed; or discovery
        /// succeeded, but the actix server has not yet restarted.
        task_lock: Arc<tokio::sync::Mutex<()>>,

        /// State shared by the discovery task.  Should only be mutated by the task holding the
        /// `task_lock`.  Any write lock should be held only briefly.
        shared: Arc<tokio::sync::RwLock<DiscoveryState>>,
    },

    /// Server has completed discovery and is running normally.
    UpAndRunning,
}

/// Shared mutable state while the [Server] is in the [State::Discovery] phase.
#[derive(Default)]
pub struct DiscoveryState {
    phc_key: Option<ed25519_dalek::VerifyingKey>,
    transcryptor_key: Option<ed25519_dalek::VerifyingKey>,
    as_key: Option<ed25519_dalek::VerifyingKey>,
}
