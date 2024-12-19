//! What's common between PubHubs servers
use actix_web::web;
use anyhow::{Context as _, Result};
use futures_util::future::LocalBoxFuture;

use core::convert::Infallible;
use std::rc::Rc;

use crate::elgamal;

use crate::client;

use crate::api::{self, DiscoveryRunResp, EndpointDetails, IntoErrorCode as _};
use crate::servers::{self, Config, Constellation, Handle};

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
/// and are mostly immutable. To change the server's state, generally all apps must be restarted.
///
/// An exception to this no-shared-mutable-state is the shared state in [Handle], for example the
/// `crate::servers::run::DiscoveryLimiter` and the object store.
pub trait Server: Sized + 'static {
    type AppT: App<Self>;

    const NAME: Name;

    /// Is moved accross threads to create the [App]s.
    type AppCreatorT: AppCreator<Self>;

    type ExtraConfig;

    /// Additional state when the server is running
    type ExtraRunningState: Clone + core::fmt::Debug;

    /// Type of this server's object store, usually an [`object_store::ObjectStore`], or [`()`].
    type ObjectStoreT: Sync;

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

    fn create_running_state(
        &self,
        constellation: &Constellation,
    ) -> Result<Self::ExtraRunningState>;

    /// This function is called when the server is started to run disovery.
    ///
    /// It is only passed a shared (and thus immutable) reference to itself to prevent any modifications
    /// going unnoticed by [App] instances.
    ///
    /// It can be ordered to stop via the `shutdown_receiver`, in which case
    /// it should return Ok(None).
    ///
    /// If can also return on its own to modify itself via the returned [BoxModifier].
    ///
    /// If it returns an error, the whole binary crashes.
    ///
    /// Before this function's future finishes, it should relinquish all references to `self`.
    /// Otherwise the modification following it will panic.
    ///
    /// It is given its own [App] instance.
    ///
    /// TODO: remove returning BoxModifier since that can be achieved via App instance?
    #[allow(async_fn_in_trait)] // <- we do not need our future to be Send
    async fn run_until_modifier(
        self: Rc<Self>,
        shutdown_receiver: tokio::sync::oneshot::Receiver<Infallible>,
        app: Self::AppT,
    ) -> anyhow::Result<Option<BoxModifier<Self>>>;
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
    type ExtraRunningState: Clone + core::fmt::Debug;
    type ObjectStoreT;

    fn create_running_state(
        server: &ServerImpl<Self>,
        constellation: &Constellation,
    ) -> Result<Self::ExtraRunningState>;
}

impl<D: Details> Server for ServerImpl<D>
where
    D::AppT: App<Self>,
    D::AppCreatorT: AppCreator<Self>,
    D::ObjectStoreT: Sync,
{
    const NAME: Name = D::NAME;

    type AppCreatorT = D::AppCreatorT;
    type AppT = D::AppT;

    type ExtraConfig = D::Extra;
    type ExtraRunningState = D::ExtraRunningState;

    type ObjectStoreT = D::ObjectStoreT;

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

    fn create_running_state(
        &self,
        constellation: &Constellation,
    ) -> Result<Self::ExtraRunningState> {
        D::create_running_state(self, constellation)
    }

    async fn run_until_modifier(
        self: Rc<Self>,
        shutdown_receiver: tokio::sync::oneshot::Receiver<Infallible>,
        app: Self::AppT,
    ) -> anyhow::Result<Option<crate::servers::server::BoxModifier<Self>>> {
        tokio::select! {
            res = shutdown_receiver => {
               res.expect_err("got instance of Infallible");
               #[allow(clippy::needless_return)] // It's more clear this way
               return Ok(None);
            }

            res = self.run_discovery_and_then_wait_forever(app) => {
               #[allow(clippy::needless_return)] // It's more clear this way
                return Err(res.expect_err("got instance of Infallible"));
            }
        }
    }
}

impl<D: Details> ServerImpl<D>
where
    D::AppT: App<Self>,
    D::AppCreatorT: AppCreator<Self>,
    D::ObjectStoreT: Sync,
{
    async fn run_discovery_and_then_wait_forever(
        self: Rc<Self>,
        app: D::AppT,
    ) -> anyhow::Result<Infallible> {
        self.run_discovery(app).await?;

        std::future::pending::<Infallible>().await; // wait forever
        unreachable!();
    }

    async fn run_discovery(self: Rc<Self>, app: D::AppT) -> anyhow::Result<()> {
        crate::misc::task::retry(|| async {
            (match
                AppBase::<Self>::handle_discovery_run(app.clone()).await.retryable()/* <- turns retryable error Err(err) into Ok(None) */?
            {
                Some(DiscoveryRunResp::Restarting | DiscoveryRunResp::UpToDate) => Ok(Some(())),
                None => Ok(None),
            }) as anyhow::Result<Option<()>>
        })
        .await?
        .ok_or_else(|| anyhow::anyhow!("timeout waiting for discovery of {server_name}", server_name = D::NAME))
    }
}

/// What's cloned and moved accross threads by a [Server] to create its [App] instances.
pub trait AppCreator<ServerT: Server>: Send + Clone + 'static {
    /// Creates a new instance of this [AppCreator] based on the given configuration.
    fn new(config: &servers::Config) -> anyhow::Result<Self>;

    /// Create an [App] instance.
    ///
    /// The `handle` [Handle] can be used to restart the server.  It's
    /// up to the implementor to clone it.
    fn into_app(self, handle: &Handle<ServerT>) -> ServerT::AppT;

    fn base(&self) -> &AppCreatorBase<ServerT>;
    fn base_mut(&mut self) -> &mut AppCreatorBase<ServerT>;
}

/// What modifies a [Server] via [Command::Modify].
///
/// It is [Send] and `'static` because it's moved accross threads, from an [App] to the task
/// running the [Server].
///
/// We do not use a trait like `(FnOnce(&mut ServerT)) + Send + 'static`,
/// because it can not (yet) be implemented by users.
pub trait Modifier<ServerT: Server>: Send + 'static {
    /// Stops server, perform modification, and restarts server if true was returned.
    fn modify(self: Box<Self>, server: &mut ServerT) -> bool;

    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error>;
}

impl<
        S: Server,
        F: FnOnce(&mut S) -> bool + Send + 'static,
        D: std::fmt::Display + Send + 'static,
    > Modifier<S> for (F, D)
{
    fn modify(self: Box<Self>, server: &mut S) -> bool {
        self.0(server)
    }

    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
        self.1.fmt(f)
    }
}

/// [Modifier] that stops the server
pub struct Exiter;

impl<S: Server> Modifier<S> for Exiter {
    fn modify(self: Box<Self>, _server: &mut S) -> bool {
        false
    }

    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
        f.write_str("exiter")
    }
}

/// Owned dynamically typed [Modifier].
pub type BoxModifier<S> = Box<dyn Modifier<S>>;

impl<S: Server> std::fmt::Display for BoxModifier<S> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
        Modifier::fmt(&**self, f)
    }
}

/// What inspects a server via [Command::Inspect].
pub trait Inspector<ServerT: Server>: Send + 'static {
    /// Calls this function with server as argument
    fn inspect(self: Box<Self>, server: &ServerT);

    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error>;
}

impl<S: Server, F: FnOnce(&S) + Send + 'static, D: std::fmt::Display + Send + 'static> Inspector<S>
    for (F, D)
{
    fn inspect(self: Box<Self>, server: &S) {
        self.0(server)
    }

    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
        self.1.fmt(f)
    }
}

/// Owned dynamically typed [Inspector].
pub type BoxInspector<S> = Box<dyn Inspector<S>>;

impl<S: Server> std::fmt::Display for BoxInspector<S> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
        Inspector::fmt(&**self, f)
    }
}

/// Commands an [App] can issue to a [crate::servers::run::Runner].
pub enum Command<S: Server> {
    /// Stop the server, apply the enclosed modification, and, depending on the result restart
    /// the server.
    ///
    /// Server restarts should be performed sparingly, and may take seconds to minutes (because
    /// actix waits for workers to shutdown gracefully.)
    Modify(BoxModifier<S>),

    /// Calls the enclosed function on the server
    Inspect(BoxInspector<S>),

    /// Stops the server
    Exit,
}

impl<S: Server> std::fmt::Display for Command<S> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
        match self {
            Command::Inspect(inspector) => write!(f, "inspector {}", inspector),
            Command::Modify(modifier) => write!(f, "modifier {}", modifier),
            Command::Exit => write!(f, "exit"),
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

    /// Checks whether the given constellation properly reflects this server's configuration.
    fn check_constellation(&self, constellation: &Constellation) -> bool;

    /// Runs the discovery routine for this server given [api::DiscoveryInfoResp] already
    /// obtained from Pubhubs Central.  If the server is not PHC itself, the [Constellation]
    /// in this [api::DiscoveryInfoResp] must be set.
    ///
    /// This function return some constellation if the constellation of this server needs to be updated.
    ///
    /// Returns None if everything checks out.  If one of the other servers is not up-to-date
    /// according to this server, discovery of that server is invoked and
    /// [api::ErrorCode::NotYetReady] is returned.
    fn discover(
        &self,
        phc_inf: api::DiscoveryInfoResp,
    ) -> LocalBoxFuture<'_, api::Result<Option<Constellation>>> {
        log::debug!("{server_name}: running disovery", server_name = S::NAME);

        Box::pin(async move {
            if S::NAME == Name::PubhubsCentral {
                log::error!(
                    "{} should implement discovery itself!",
                    Name::PubhubsCentral
                );
                return api::err(api::ErrorCode::InternalError);
            }

            assert!(
                phc_inf.constellation.is_some(),
                "this `discover` method should only be run when phc_inf.constellation is some"
            );

            if let Some(rs) = self.base().running_state.as_ref() {
                if !self.check_constellation(phc_inf.constellation.as_ref().unwrap()) {
                    log::warn!(
                        "{server_name}: {phc}'s constellation seems to be out-of-date - requesting rediscovery",
                        server_name = S::NAME,
                        phc = Name::PubhubsCentral
                    );
                    // PHC's discovery is out of date; invoke discovery and return
                    api::return_if_ec!(self
                        .base()
                        .client
                        .query::<api::DiscoveryRun>(&phc_inf.phc_url, &())
                        .await
                        .into_server_result());
                    return api::err(api::ErrorCode::NotYetReady);
                }

                log::trace!(
                    "{server_name}: {phc}'s constellation looks alright! ",
                    server_name = S::NAME,
                    phc = Name::PubhubsCentral
                );

                if *phc_inf.constellation.as_ref().unwrap() == *rs.constellation {
                    log::trace!(
                        "{server_name}: my constellation is up-to-date!",
                        server_name = S::NAME,
                    );

                    return api::ok(None);
                }
            }

            log::info!(
                "{}: my constellation is {}",
                S::NAME,
                if self.base().running_state.is_some() {
                    "out of date"
                } else {
                    "not yet set"
                }
            );

            // NOTE: phc_inf has already been (partially) checked
            let c = phc_inf
                .constellation
                .as_ref()
                .expect("that constellation is not none should already have been checked");

            let url = c.url(S::NAME);

            // obtain DiscoveryInfo from oneself
            let di = api::return_if_ec!(self
                .base()
                .client
                .query::<api::DiscoveryInfo>(url, &())
                .await
                .into_server_result());

            let base = self.base();

            api::return_if_ec!(client::discovery::DiscoveryInfoCheck {
                name: S::NAME,
                phc_url: &base.phc_url,
                self_check_code: Some(&base.self_check_code),
                constellation: None,
                // NOTE: we're not checking whether our own constellation is up-to-date,
                // because it likely is not - why would we run discovery otherwise?
            }
            .check(di, url));

            api::ok(Some(phc_inf.constellation.unwrap()))
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
    pub running_state: Option<RunningState<S::ExtraRunningState>>,
    pub phc_url: url::Url,
    pub self_check_code: String,
    pub jwt_key: api::SigningKey,
    pub enc_key: elgamal::PrivateKey,
    pub admin_key: api::VerifyingKey,
    pub shared: SharedState<S>,
}

// need to implement this manually, because we do not want `Server` to implement `Clone`
impl<S: Server> Clone for AppCreatorBase<S> {
    fn clone(&self) -> Self {
        Self {
            running_state: self.running_state.clone(),
            phc_url: self.phc_url.clone(),
            self_check_code: self.self_check_code.clone(),
            jwt_key: self.jwt_key.clone(),
            enc_key: self.enc_key.clone(),
            admin_key: self.admin_key.clone(),
            shared: self.shared.clone(),
        }
    }
}

impl<S: Server> AppCreatorBase<S>
where
    S::ObjectStoreT: for<'a> TryFrom<&'a Option<servers::config::ObjectStoreConfig>, Error = anyhow::Error>
        + Sync,
{
    pub fn new(config: &crate::servers::Config) -> anyhow::Result<Self> {
        assert_eq!(
            config.preparation_state,
            crate::servers::config::PreparationState::Complete
        );

        let server_config = S::server_config_from(config);

        Ok(Self {
            running_state: None,
            self_check_code: server_config
                .self_check_code
                .clone()
                .expect("self_check_code was not set nor generated"),
            jwt_key: server_config
                .jwt_key
                .clone()
                .expect("jwt_key was not set nor generated"),
            enc_key: server_config
                .enc_key
                .clone()
                .expect("enc_key was not set nor generated"),
            phc_url: config.phc_url.as_ref().clone(),
            admin_key: server_config
                .admin_key
                .clone()
                .expect("admin_key was not set nor generated"),
            shared: SharedState::new(SharedStateInner {
                object_store: TryFrom::try_from(&server_config.object_store)
                    .with_context(|| format!("Creating object store for {}", S::NAME))?,
            }),
        })
    }
}

/// What's internally common between PubHubs [App]s.
///
/// Should *NOT* be cloned.
pub struct AppBase<S: Server> {
    pub running_state: Option<RunningState<S::ExtraRunningState>>,
    pub handle: Handle<S>,
    pub self_check_code: String,
    pub phc_url: url::Url,
    pub jwt_key: api::SigningKey,
    pub enc_key: elgamal::PrivateKey,
    pub admin_key: api::VerifyingKey,
    pub shared: SharedState<S>,
    pub client: client::Client,
}

impl<S: Server> AppBase<S> {
    pub fn new(creator_base: AppCreatorBase<S>, handle: &Handle<S>) -> Self {
        Self {
            running_state: creator_base.running_state,
            handle: handle.clone(),
            phc_url: creator_base.phc_url,
            self_check_code: creator_base.self_check_code,
            jwt_key: creator_base.jwt_key,
            enc_key: creator_base.enc_key,
            admin_key: creator_base.admin_key,
            shared: creator_base.shared,
            client: client::Client::builder()
                .agent(client::Agent::Server(S::NAME))
                .finish(),
        }
    }

    pub fn running_state(&self) -> Result<&RunningState<S::ExtraRunningState>, api::ErrorCode> {
        match self.running_state {
            Some(ref rs) => Ok(rs),
            None => {
                log::error!("tried to get runnng state while not running");
                Err(api::ErrorCode::InternalError)
            }
        }
    }

    /// Configures common endpoints
    pub fn configure_actix_app(app: &S::AppT, sc: &mut web::ServiceConfig) {
        api::DiscoveryRun::add_to(app, sc, Self::handle_discovery_run);
        api::DiscoveryInfo::add_to(app, sc, Self::handle_discovery_info);

        api::admin::UpdateConfig::add_to(app, sc, Self::handle_admin_post_config);
        api::admin::Info::add_to(app, sc, Self::handle_admin_info);
    }

    /// Checks the signature on the given request that should be signed with the admin key.
    fn open_admin_req<T: api::HavingMessageCode + serde::de::DeserializeOwned>(
        &self,
        signed_req: api::Signed<T>,
    ) -> api::Result<T> {
        signed_req.open(&*self.admin_key).map_err(|err| match err {
            api::ErrorCode::InvalidSignature => api::ErrorCode::InvalidAdminKey,
            err => err,
        })
    }

    /// Changes server config, and restarts server
    async fn handle_admin_post_config(
        app: S::AppT,
        signed_req: web::Json<api::Signed<api::admin::UpdateConfigReq>>,
    ) -> api::Result<api::admin::UpdateConfigResp> {
        let signed_req = signed_req.into_inner();

        let base = app.base();

        let req = api::return_if_ec!(base.open_admin_req(signed_req));

        // Before restarting the server, check that the modification would work,
        // so we can return an error to the requestor.  Once we issue a modification command
        // the present connection is severed, and so no error can be returned.

        let config = api::return_if_ec!(base
            .handle
            .inspect(
                "admin's retrieval of current configuration",
                |server: &S| -> Config { server.config().clone() }
            )
            .await
            .into_ec(|_| {
                log::warn!("{}: failed to retrieve configuration from server", S::NAME,);
                api::ErrorCode::NotYetReady // probably the server is restarting
            }));

        let mut new_config: Config = api::return_if_ec!(config
            .json_updated(&req.pointer, req.new_value.clone())
            .into_ec(|err| {
                log::warn!(
                    "{}: failed to modify configuration at {} to {}: {err}",
                    S::NAME,
                    req.pointer,
                    req.new_value
                );
                api::ErrorCode::BadRequest
            }));

        drop(config);

        // reprepare config...
        api::return_if_ec!(new_config.preliminary_prep().into_ec(|err| {
            log::warn!(
                "{}: failed to reprepare (preliminary step) modified configuration: {err}",
                S::NAME
            );
            api::ErrorCode::BadRequest
        }));
        api::return_if_ec!(new_config.prepare().into_ec(|err| {
            log::warn!(
                "{}: failed to reprepare modified configuration: {err}",
                S::NAME
            );
            api::ErrorCode::BadRequest
        }));

        // All is well - let's restart the server with the new configuration
        api::return_if_ec!(base
        .handle
        .modify(
            "admin update of current in-memory configuration",
            move |server: &mut S| {

                let new_server_maybe = S::new(&new_config);

                if let Err(err) = new_server_maybe {
                    log::error!("Could not create new {} with changed configuration: {}. Restarting old server.", S::NAME, err);
                    return true; // restart
                }

                *server = new_server_maybe.unwrap();

                true // restart
            }
        )
        .await
        .into_ec(|_| {
            log::warn!("{}: failed to enqueue modification", S::NAME);
            api::ErrorCode::NotYetReady
        }));

        api::ok(api::admin::UpdateConfigResp {})
    }

    /// Retrieve non-public information about the server
    async fn handle_admin_info(
        app: S::AppT,
        signed_req: web::Json<api::Signed<api::admin::InfoReq>>,
    ) -> api::Result<api::admin::InfoResp> {
        let signed_req = signed_req.into_inner();

        let base = app.base();

        let _req = api::return_if_ec!(base.open_admin_req(signed_req));

        let config = api::return_if_ec!(base
            .handle
            .inspect(
                "admin's retrieval of current configuration",
                |server: &S| -> Config { server.config().clone() }
            )
            .await
            .into_ec(|_| {
                log::warn!("{}: failed to retrieve configuration from server", S::NAME,);
                api::ErrorCode::NotYetReady // probably the server is restarting
            }));

        api::ok(api::admin::InfoResp { config })
    }

    /// Run the discovery process, and restarts server if necessary.  Returns when
    /// the discovery process is completed, but before a possible restart.
    async fn handle_discovery_run(app: S::AppT) -> api::Result<api::DiscoveryRunResp> {
        app.base().handle.request_discovery(app.clone()).await
    }

    pub(super) async fn discover_phc(app: S::AppT) -> api::Result<api::DiscoveryInfoResp> {
        let base = app.base();

        let pdi = {
            let result = base
                .client
                .query::<api::DiscoveryInfo>(&base.phc_url, &())
                .await;

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
            // NOTE: don't check whether our constellation coincides with PHC's constellation here,
            // because if they're not the same that will cause an error to be returned, while
            // we want to initiate a restart instead.
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
            enc_key: app_base.enc_key.public_key().clone(),
            master_enc_key_part: app
                .master_enc_key_part()
                .map(|privk| privk.public_key().clone()),
            constellation: app_base
                .running_state
                .as_ref()
                .map(|rs| (*rs.constellation).clone()),
        })
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

/// Additional state when discovery has been completed
#[derive(Clone, Debug)]
pub struct RunningState<Extra: Clone + core::fmt::Debug> {
    pub constellation: Box<Constellation>,
    pub extra: Extra,
}

/// Shared state between [App]s.  Use sparingly!
pub struct SharedState<S: Server> {
    inner: std::sync::Arc<SharedStateInner<S>>,
}

impl<S: Server> Clone for SharedState<S> {
    fn clone(&self) -> Self {
        Self {
            inner: self.inner.clone(),
        }
    }
}

impl<S: Server> std::ops::Deref for SharedState<S> {
    type Target = SharedStateInner<S>;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl<S: Server> SharedState<S> {
    fn new(inner: SharedStateInner<S>) -> Self {
        Self {
            inner: std::sync::Arc::new(inner),
        }
    }
}

pub struct SharedStateInner<S: Server> {
    object_store: S::ObjectStoreT,
}
