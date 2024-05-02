//! What's common between PubHubs servers
use actix_web::web;
use anyhow::Result;
use futures_util::future::LocalBoxFuture;
use tokio::sync::mpsc;

use std::sync::Arc;

use crate::elgamal;

use crate::client;

use crate::api::{self, EndpointDetails};
use crate::servers::{self, Constellation};

/// Enumerates the names of the different PubHubs servers
#[derive(
    serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash, clap::ValueEnum,
)]
pub enum Name {
    #[serde(rename = "phc")]
    PubhubsCentral,

    #[serde(rename = "transcryptor")]
    Transcryptor,

    #[serde(rename = "auths")]
    AuthenticationServer,
}

impl std::fmt::Display for Name {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
        write!(
            f,
            "{}",
            match self {
                Name::PubhubsCentral => "PubHubs Central",
                Name::Transcryptor => "Transcryptor",
                Name::AuthenticationServer => "Authentication Server",
            }
        )
    }
}

/// Common API to the different PubHubs servers, used by the [crate::servers::run::Runner].
///
/// A single instance of the [ServerImpl] implementation of [Server] is created
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

    const NAME: Name;

    /// Is moved accross threads to create the [App]s.
    type AppCreatorT: AppCreator<Self>;

    type ExtraConfig;

    /// Additional state when the server is running
    type RunningState: Clone;

    fn new(config: &crate::servers::Config) -> anyhow::Result<Self>;

    fn app_creator(&self) -> &Self::AppCreatorT;
    fn app_creator_mut(&mut self) -> &mut Self::AppCreatorT;

    fn config(&self) -> &crate::servers::Config;

    fn server_config(&self) -> &servers::config::ServerConfig<Self::ExtraConfig> {
        Self::server_config_from(self.config())
    }

    fn server_config_from(
        config: &servers::Config,
    ) -> &servers::config::ServerConfig<Self::ExtraConfig>;

    fn create_running_state(&self, constellation: &Constellation) -> Result<Self::RunningState>;
}

/// Basic implementation of [Server].
pub struct ServerImpl<D: Details> {
    config: servers::Config,
    app_creator: D::AppCreatorT,
}

/// Details needed to create a [ServerImpl] type.
pub trait Details: crate::servers::config::GetServerConfig + 'static + Sized {
    const NAME: Name;
    type AppCreatorT;
    type AppT;
    type RunningState: Clone;

    fn create_running_state(
        server: &ServerImpl<Self>,
        constellation: &Constellation,
    ) -> Result<Self::RunningState>;
}

impl<D: Details> Server for ServerImpl<D>
where
    D::AppT: App<Self>,
    D::AppCreatorT: AppCreator<Self>,
{
    const NAME: Name = D::NAME;

    type AppCreatorT = D::AppCreatorT;
    type AppT = D::AppT;

    type ExtraConfig = D::Extra;
    type RunningState = D::RunningState;

    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        Ok(Self {
            app_creator: Self::AppCreatorT::new(config)?,
            config: config.clone(),
        })
    }

    fn app_creator(&self) -> &Self::AppCreatorT {
        &self.app_creator
    }

    fn app_creator_mut(&mut self) -> &mut Self::AppCreatorT {
        &mut self.app_creator
    }

    fn config(&self) -> &servers::Config {
        &self.config
    }

    fn server_config_from(
        config: &servers::Config,
    ) -> &servers::config::ServerConfig<Self::ExtraConfig> {
        D::server_config(config)
    }

    fn create_running_state(&self, constellation: &Constellation) -> Result<Self::RunningState> {
        D::create_running_state(self, constellation)
    }
}

/// What's passed to an [App] via [AppCreator] to signal a shutdown command
pub type ShutdownSender<S> = mpsc::Sender<ShutdownCommand<S>>;

/// What's moved  accross threads by a [Server] to create its [App] instances.
pub trait AppCreator<ServerT: Server>: Send + Clone + 'static {
    /// Creates a new instance of this [AppCreator] based on the given configuration.
    fn new(config: &servers::Config) -> anyhow::Result<Self>;

    /// Create an [App] instance.
    ///
    /// The `shutdown_sender` [mpsc::Sender] can be used to restart the server.  It's
    /// up to the implementor to clone it.
    fn into_app(self, shutdown_sender: &ShutdownSender<ServerT>) -> ServerT::AppT;

    fn base(&self) -> &AppCreatorBase<ServerT>;
    fn base_mut(&mut self) -> &mut AppCreatorBase<ServerT>;
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
    #[allow(dead_code)]
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

    /// Runs the discovery routine for this server given [api::DiscoveryInfoResp] already
    /// obtained from Pubhubs Central.
    ///
    /// May panic if the [Server]'s state is not [State::Discovery].
    ///
    /// The [Constellation] returned will be used for the new state [State::UpAndRunning].
    ///
    /// The default implementation does nothing unless PubHubs Central is already up and running.
    /// If PHC is, the implementation proceeds to contact itself via the URL mentioned in PHC's
    /// constellation, and check that it reaches itself using the `self_check_code`.
    ///
    /// If that all checks out, the default implementation returns the [Constellation] from
    /// PHC's [api::DiscoveryInfoResp].
    fn discover(
        &self,
        phc_inf: api::DiscoveryInfoResp,
    ) -> LocalBoxFuture<'_, api::Result<Constellation>> {
        Box::pin(async move {
            if S::NAME == Name::PubhubsCentral {
                log::error!("Pubhubs Central should implement discovery itself!");
                return api::err(api::ErrorCode::InternalError);
            }

            if phc_inf.state != api::ServerState::UpAndRunning {
                return api::err(api::ErrorCode::NotYetReady);
            }

            // NOTE: phc_inf has already been (partially) checked
            let c = phc_inf
                .constellation
                .as_ref()
                .expect("that constellation is not none should already have been checked");

            let url = c.url(S::NAME);

            let di = api::return_if_ec!(api::query::<api::DiscoveryInfo>(url, &())
                .await
                .into_server_result());

            let base = self.base();

            api::return_if_ec!(client::discovery::DiscoveryInfoCheck {
                name: S::NAME,
                phc_url: &base.phc_url,
                self_check_code: Some(&base.self_check_code),
                constellation: Some(c),
            }
            .check(di, url));

            api::ok(phc_inf.constellation.unwrap())
        })
    }

    /// Returns the [AppBase] this [App] builds on.
    fn base(&self) -> &AppBase<S>;

    /// Should return the master encryption key part for PHC and the transcryption.
    fn master_enc_key_part(&self) -> Option<&elgamal::PrivateKey> {
        if matches!(S::NAME, Name::PubhubsCentral | Name::Transcryptor) {
            panic!("this default impl should have been  overriden for PHC and T")
        }
        None
    }
}

/// What's internally common between PubHubs [AppCreator]s.
pub struct AppCreatorBase<S: Server> {
    pub state: State<S::RunningState>,
    pub phc_url: url::Url,
    pub self_check_code: String,
    pub jwt_key: api::SigningKey,
    pub enc_key: elgamal::PrivateKey,
}

impl<S: Server> Clone for AppCreatorBase<S> {
    fn clone(&self) -> Self {
        Self {
            state: self.state.clone(),
            phc_url: self.phc_url.clone(),
            self_check_code: self.self_check_code.clone(),
            jwt_key: self.jwt_key.clone(),
            enc_key: self.enc_key.clone(),
        }
    }
}

impl<S: Server> AppCreatorBase<S> {
    pub fn new(config: &crate::servers::Config) -> Self {
        let server_config = S::server_config_from(config);

        Self {
            state: State::Discovery {
                task_lock: Arc::new(tokio::sync::Mutex::new(())),
            },
            self_check_code: server_config.self_check_code(),
            jwt_key: server_config
                .jwt_key
                .clone()
                .unwrap_or_else(api::SigningKey::generate),
            enc_key: server_config
                .enc_key
                .clone()
                .unwrap_or_else(elgamal::PrivateKey::random),
            phc_url: config.phc_url.clone(),
        }
    }
}

/// What's internally common between PubHubs [App]s.
pub struct AppBase<S: Server> {
    pub state: State<S::RunningState>,
    pub shutdown_sender: ShutdownSender<S>,
    pub self_check_code: String,
    pub phc_url: url::Url,
    pub jwt_key: api::SigningKey,
    pub enc_key: elgamal::PrivateKey,
}

impl<S: Server> AppBase<S> {
    pub fn new(creator_base: AppCreatorBase<S>, shutdown_sender: &ShutdownSender<S>) -> Self {
        Self {
            state: creator_base.state,
            shutdown_sender: shutdown_sender.clone(),
            phc_url: creator_base.phc_url,
            self_check_code: creator_base.self_check_code,
            jwt_key: creator_base.jwt_key,
            enc_key: creator_base.enc_key,
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

        false
    }

    /// Issues the restart command to the [Server] with the given [Modifier].  See [Self::shutdown_server].
    /// for more details.
    pub fn restart_server(&self, modifier: impl Modifier<S>) -> bool {
        self.shutdown_server(ShutdownCommand::ModifyAndRestart(Box::new(modifier)))
    }

    /// Issues the stop command to the [Server].  See [Self::shutdown_server].
    #[allow(dead_code)]
    pub fn stop_server(&self) -> bool {
        self.shutdown_server(ShutdownCommand::Exit)
    }

    /// Configures common endpoints
    pub fn configure_actix_app(app: &S::AppT, sc: &mut web::ServiceConfig) {
        api::DiscoveryRun::add_to(app, sc, Self::handle_discovery_run);
        api::DiscoveryInfo::add_to(app, sc, Self::handle_discovery_info);
    }

    /// Run the discovery process, and restarts server if necessary.  Returns when
    /// the discovery process is completed, but before a possible restart.
    ///
    /// Takes the discovery `task_lock`.
    async fn handle_discovery_run(app: S::AppT) -> api::Result<()> {
        let base = app.base();

        let task_lock = match &base.state {
            State::Discovery { task_lock } => task_lock,
            _ => return api::err(api::ErrorCode::NoLongerInCorrectState),
        };

        let lock_guard = {
            match task_lock.try_lock() {
                Ok(lock_guard) => lock_guard,
                Err(_) => {
                    return api::err(api::ErrorCode::AlreadyRunning);
                }
            }
        };

        let phc_discovery_info = {
            let result = Self::discover_phc(app.clone()).await;
            if result.is_err() {
                return api::err(result.unwrap_err());
            }
            result.unwrap()
        };

        let result = app.discover(phc_discovery_info).await;

        drop(lock_guard);

        if result.is_err() {
            return api::err(result.unwrap_err());
        }

        let constellation = Box::new(result.unwrap());

        // restart server

        let success: bool = app.base().restart_server(|server: &mut S| -> Result<()> {
            let extra = server.create_running_state(&constellation)?;

            server.app_creator_mut().base_mut().state =
                crate::servers::server::State::UpAndRunning {
                    constellation,
                    extra,
                };

            Ok(())
        });

        if !success {
            log::error!("failed to restart server for discovery");
            return api::err(api::ErrorCode::InternalError);
        }

        api::ok(())
    }

    async fn discover_phc(app: S::AppT) -> api::Result<api::DiscoveryInfoResp> {
        let base = app.base();

        let pdi = {
            let result = api::query::<api::DiscoveryInfo>(&base.phc_url, &()).await;

            if result.is_err() {
                return api::Result::Err(result.unwrap_err().into_server_error());
            }

            result.unwrap()
        };

        client::discovery::DiscoveryInfoCheck {
            phc_url: &base.phc_url,
            name: Name::PubhubsCentral,
            self_check_code: if S::NAME == Name::PubhubsCentral {
                Some(&base.self_check_code)
            } else {
                None
            },
            constellation: None,
        }
        .check(pdi, &base.phc_url)
    }

    async fn handle_discovery_info(app: S::AppT) -> api::Result<api::DiscoveryInfoResp> {
        let app_base = app.base();

        api::ok(api::DiscoveryInfoResp {
            name: S::NAME,
            self_check_code: app_base.self_check_code.clone(),
            phc_url: app_base.phc_url.clone(),
            // NOTE on efficiency:  the ed25519_dalek::SigningKey contains a precomputed
            // ed25519_dalek::VerifyingKey, which contains a precomputed compressed (=serialized)
            // form.  So no expensive cryptographic operations like finite field inversion
            // or scalar multiplication are performed here.
            jwt_key: app_base.jwt_key.verifying_key().into(),
            state: (&app_base.state).into(),
            enc_key: app_base.enc_key.public_key().clone(),
            master_enc_key_part: app
                .master_enc_key_part()
                .map(|privk| privk.public_key().clone()),
            constellation: match &app_base.state {
                State::UpAndRunning { constellation, .. } => Some(*constellation.clone()),
                State::Discovery { .. } => None,
            },
        })
    }

    /// Returns the server's running state if it is, and otherwise [api::ErrorCode::NotYetReady].
    pub(super) fn running_state(&self) -> api::Result<(&S::RunningState, &Constellation)> {
        match self.state {
            State::UpAndRunning {
                ref extra,
                ref constellation,
            } => api::Result::Ok((extra, constellation)),
            State::Discovery { .. } => api::Result::Err(api::ErrorCode::NotYetReady),
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
    pub fn new(app: &App, f: F) -> Self {
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
pub enum State<RunningState: Clone> {
    /// Waiting for information from other servers.
    Discovery {
        /// This lock is taken by the task performing discovery.
        ///
        /// If unlocked, either discovery has not started; or it was, but crashed; or discovery
        /// succeeded, but the actix server has not yet restarted.
        task_lock: Arc<tokio::sync::Mutex<()>>,
    },

    /// Server has completed discovery and is running normally.
    UpAndRunning {
        constellation: Box<Constellation>,
        extra: RunningState,
    },
}
