//! Running PubHubs [Server]s
use std::net::SocketAddr;
use std::num::NonZero;
use std::rc::Rc;
use std::sync::Arc;

use actix_web::web;
use anyhow::{bail, Context as _, Result};
use core::convert::Infallible;
use tokio::sync::mpsc;

use crate::api;
use crate::servers::{
    for_all_servers, server::RunningState, App, AppBase, AppCreator, Command, Name, Server,
};

/// A set of running PubHubs servers.
pub struct Set {
    /// Handle to the task waiting on [SetInner::wait].
    wait_jh: tokio::task::JoinHandle<usize>,
}

impl Set {
    /// Creates a new set of PubHubs servers from the given config.
    /// To signal shutdown of these senders, drop the returned `sender`.
    pub fn new(
        config: &crate::servers::Config,
    ) -> Result<(Self, tokio::sync::oneshot::Sender<Infallible>)> {
        let (inner, shutdown_sender) = SetInner::new(config)?;

        let wait_jh = tokio::task::spawn(inner.wait());

        Ok((Self { wait_jh }, shutdown_sender))
    }

    /// Waits for one of the servers to return, panic, or be cancelled.
    /// If that happens, the other servers are directed to shutdown as well.
    ///
    /// Returns the number of servers that did *not* shutdown cleanly.
    ///
    /// Panics when the tokio runtime is shut down.
    pub async fn wait(self) -> usize {
        match self.wait_jh.await {
            Ok(nr) => nr,
            Err(join_error) => {
                panic!(
                    "task waiting on servers to exit was cancelled or panicked: {}",
                    join_error
                );
            }
        }
    }
}

/// A set of running PubHubs servers.
struct SetInner {
    /// The servers' tasks
    joinset: tokio::task::JoinSet<Result<()>>,

    /// Via `shutdown_sender` [`Set`] broadcasts the instruction to shutdown to all servers
    /// running in the `joinset`.  It does so not by `send`ing a message, but by dropping
    /// the `shutdown_sender`.
    shutdown_sender: Option<tokio::sync::broadcast::Sender<Infallible>>,

    /// Via `shutdown_receiver`, the [Set] received the instruction to close.
    shutdown_receiver: tokio::sync::oneshot::Receiver<Infallible>,
}

impl Drop for SetInner {
    fn drop(&mut self) {
        if self.shutdown_sender.is_some() {
            log::error!("the completion of all pubhubs servers was not awaited - please consume SetInner using wait() or shutdown()")
        }
    }
}

impl SetInner {
    /// Creates a new set of PubHubs servers from the given config.
    ///
    /// Returns not only the [`SetInner`] instance, but also a [`tokio::sync::oneshot::Sender<Infallible>`]
    /// that can be dropped to signal the [`SetInner`] should shutdown.
    pub fn new(
        config: &crate::servers::Config,
    ) -> Result<(Self, tokio::sync::oneshot::Sender<Infallible>)> {
        let rt_handle: tokio::runtime::Handle = tokio::runtime::Handle::current();
        let mut joinset = tokio::task::JoinSet::<Result<()>>::new();

        let (shutdown_sender, _) = tokio::sync::broadcast::channel(1); // NB capacity of 0 is not allowed

        // count the number of servers
        let server_count: usize = {
            let mut counter: usize = 0;

            macro_rules! count_server {
                ($server:ident) => {
                    if config.$server.is_some() {
                        counter += 1;
                    }
                };
            }

            for_all_servers!(count_server);

            counter
        };

        // don't use one thread per code for each server - this speeds up testing
        let worker_count: Option<NonZero<usize>> =
            std::thread::available_parallelism()
                .ok()
                .map(|parallelism: NonZero<usize>| {
                    if server_count == 0 {
                        return NonZero::<usize>::new(1).unwrap();
                    }

                    NonZero::<usize>::try_from(parallelism.get() / server_count)
                        .unwrap_or(NonZero::<usize>::new(1).unwrap()) // more servers than cores
                });

        macro_rules! run_server {
            ($server:ident) => {
                if config.$server.is_some() {
                    let config = config.clone();
                    let rt_handle = rt_handle.clone();
                    let shutdown_receiver = shutdown_sender.subscribe();

                    // We use spawn_blocking instead of spawn, because we want a separate thread
                    // for each server to run on
                    joinset.spawn_blocking(move || -> Result<()> {
                        Self::run_server::<crate::servers::$server::Server>(
                            config,
                            rt_handle,
                            shutdown_receiver,
                            worker_count,
                        )
                    });
                }
            };
        }

        for_all_servers!(run_server);

        let (external_shutdown_sender, external_shutdown_receiver) =
            tokio::sync::oneshot::channel();

        Ok((
            Self {
                joinset,
                shutdown_sender: Some(shutdown_sender),
                shutdown_receiver: external_shutdown_receiver,
            },
            external_shutdown_sender,
        ))
    }

    // Creates a server from the given `config` and run it ont the given tokio runtime.
    //
    // Abort when the `shutdown_receiver` channel is closed.
    fn run_server<S: Server>(
        config: crate::servers::Config,
        rt_handle: tokio::runtime::Handle,
        shutdown_receiver: tokio::sync::broadcast::Receiver<Infallible>,
        worker_count: Option<NonZero<usize>>,
    ) -> Result<()> {
        assert!(config.preparation_state == crate::servers::config::PreparationState::Preliminary);

        let localset = tokio::task::LocalSet::new();

        let fut = localset.run_until(async {
            let config = config.prepare_for(S::NAME).await?;

            crate::servers::run::Runner::<S>::new(&config, shutdown_receiver, worker_count)?
                .run()
                .await
        });

        let result = rt_handle.block_on(fut);

        rt_handle.block_on(localset);

        log::debug!("{} stopped with {:?}", S::NAME, result);

        result
    }

    /// Waits for one of the servers to return, panic, or be cancelled.
    /// If that happens, the other servers are directed to shutdown as well.
    ///
    /// If this function is not called, servers can fail silently.
    ///
    /// Returns the number of servers that did *not* shutdown cleanly
    pub async fn wait(mut self) -> usize {
        log::trace!("waiting for one of the servers to exit...");
        let err_count: usize = tokio::select! {
            // either one of the servers exits
            result_maybe = self
                .joinset
                .join_next() => {
                    let result = result_maybe.expect("no servers to wait on");
                    let is_err : bool =  matches!(result, Err(_) | Ok(Err(_)));

                    log::log!( if is_err { log::Level::Error } else { log::Level::Debug },
                        "one of the servers exited with {:?};  stopping all servers..",
                        result
                    );

                    if is_err {
                        1
                    } else {
                        0
                    }
                },

            // or we get the command to shut down from higher up
            result = &mut self.shutdown_receiver => {
                result.expect_err("received Infallible");
                log::debug!("shutdown requested"); 0
            }
        };

        self.shutdown().await + err_count
    }

    /// Requests shutdown of all servers, and wait for it to complete.
    /// Returns the number of servers that did *not* shutdown cleanly.
    pub async fn shutdown(mut self) -> usize {
        assert!(
            self.shutdown_sender.is_some(),
            "only signal_shutdown should take shutdown_sender"
        );

        // This causes the shutdown_receivers at the different servers to be closed,
        // which in turn should cause those servers' threads to join.
        drop(self.shutdown_sender.take());

        let mut err_count = 0usize;

        while let Some(result) = self.joinset.join_next().await {
            err_count += if matches!(result, Err(_) | Ok(Err(_))) {
                1
            } else {
                0
            };
        }

        // join_next returned None, which means the JoinSet is empty

        err_count
    }
}

/// Runs a [`Server`]
struct Runner<ServerT: Server> {
    pubhubs_server: Rc<ServerT>,
    shutdown_receiver: tokio::sync::broadcast::Receiver<Infallible>,
    worker_count: Option<NonZero<usize>>,
}

/// The handles to control an [actix_web::dev::Server] running a pubhubs [Server].
struct Handles<S: Server> {
    /// Handle to the actual actix TCP server.  The [actix_web::dev::Server] is owned
    /// by the task driving it.
    actix_server_handle: actix_web::dev::ServerHandle,

    /// Handle to the task driving the actix TCP server
    actix_join_handle: tokio::task::JoinHandle<Result<(), std::io::Error>>,

    /// Handle to the task running (discovery for) the PubHubs server.
    ph_join_handle: tokio::task::JoinHandle<Result<Option<crate::servers::server::BoxModifier<S>>>>,

    /// Dropped to order `ph_join_handle` to shutdown.  [None] when used.
    ph_shutdown_sender: Option<tokio::sync::oneshot::Sender<Infallible>>,

    /// Receives commands from the [App]s
    command_receiver: mpsc::Receiver<CommandRequest<S>>,

    /// To check whether [Handles::shutdown] was completed before being dropped
    drop_bomb: crate::misc::drop_ext::Bomb,
}

impl<S: Server> Handles<S> {
    /// Drives the actix server until a [Command] is received - which is returned
    async fn run_until_command(&mut self, runner: &mut Runner<S>) -> anyhow::Result<Command<S>> {
        tokio::select! {

            // received command from running pubhubs/actix server
            command_request_maybe = self.command_receiver.recv() => {
                if let Some(command_request) = command_request_maybe {

                    #[allow(clippy::needless_return)]
                    // Clippy wants "Ok(command)", but that's not easy to read here
                    // (Maybe clippy is not aware of the tokio::select! macro?)
                    return Ok(command_request.accept());
                }

                log::error!("{}'s command receiver is unexpectedly closed", S::NAME);
                bail!("{}'s command receiver is unexpectedly closed", S::NAME);
            },

            // pubhubs server exited, returning a modification request
            res = &mut self.ph_join_handle => {
                let modifier : crate::servers::server::BoxModifier<S> =
                res.with_context(|| format!("{}'s pubhubs task joined unexpectedly", S::NAME))?
                    .with_context(|| format!("{}'s pubhubs task crashed", S::NAME))?
                    .with_context(|| format!("{}'s pubhubs task stopped without being asked to", S::NAME))?;


                #[allow(clippy::needless_return)] // "return" makes the code more readable here
                return Ok(Command::Modify(modifier));
            },

            // the thread running this server wants us to quit
            Err(err) = runner.shutdown_receiver.recv() => {
                match err {
                    tokio::sync::broadcast::error::RecvError::Lagged(_) => {
                        panic!("got impossible `Lagged` error from shutdown sender");
                    },
                    tokio::sync::broadcast::error::RecvError::Closed => {
                        #[allow(clippy::needless_return)] // "return" is more readable here
                        return Ok(Command::Exit);
                    },
                }
            },

            // the actix serer exited unexpectedly
            res = &mut self.actix_join_handle => {
                res.inspect_err(|err| log::error!("{}'s actix task joined unexpectedly: {}", S::NAME, err) )
                    .with_context(|| format!("{}'s actix task joined unexpectedly", S::NAME))?
                    .inspect_err(|err| log::error!("{}'s http server crashed: {}", S::NAME, err) )
                    .with_context(|| format!("{}'s http server crashed", S::NAME))?;

                log::error!("{}'s actix server stopped unexpectedly", S::NAME);
                bail!("{}'s actix server stopped unexpectedly", S::NAME);
            },
        };
    }

    /// Consumes this [Handles] shutting down the actix server and pubhubs tasks.
    async fn shutdown(mut self, graceful_actix_shutdown: bool) -> anyhow::Result<()> {
        log::debug!("Shut down of {} started", S::NAME);

        anyhow::ensure!(
            self.ph_shutdown_sender.is_some(),
            "shutdown of ph task already ordered"
        );

        drop(self.ph_shutdown_sender.take());

        // NOTE: this is a noop if the actix server is already stopped
        self.actix_server_handle.stop(graceful_actix_shutdown).await;

        let maybe_modifier = self
            .ph_join_handle
            .await
            .with_context(|| {
                format!(
                    "{}'s pubhubs task did not join gracefully after being asked to stop",
                    S::NAME
                )
            })?
            .with_context(|| {
                format!(
                    "{}'s pubhubs task crashed after being asked to stop",
                    S::NAME
                )
            })?;

        if let Some(ph_modifier) = maybe_modifier {
            log::error!("Woops! {}'s pubhubs task's modifier {} was ignored, because another modifier was first",
                            S::NAME, ph_modifier);
        }

        self.drop_bomb.diffuse();

        log::debug!("Shut down of {} completed", S::NAME);

        Ok(())
    }
}

/// Encapsulates the handling of running just one discovery process per server
struct DiscoveryLimiter {
    /// Lock that makes sure only one discovery task is running at the same time.
    ///
    /// The protected value is true when restart due to a changed constellation is imminent.
    restart_imminent_lock: Arc<tokio::sync::RwLock<bool>>,

    /// Set when contents of `restart_imminent_lock` lock was observed to be true,
    /// reducing the load on this lock.
    restart_imminent_cached: std::cell::OnceCell<()>,
}

impl Clone for DiscoveryLimiter {
    fn clone(&self) -> Self {
        Self {
            restart_imminent_lock: self.restart_imminent_lock.clone(),
            // The DiscoveryLimiter is never cloned as part of an `AppBase`.
            restart_imminent_cached: std::cell::OnceCell::<()>::new(),
        }
    }
}

impl DiscoveryLimiter {
    fn new() -> Self {
        DiscoveryLimiter {
            restart_imminent_lock: Arc::new(tokio::sync::RwLock::new(false)),
            restart_imminent_cached: std::cell::OnceCell::<()>::new(),
        }
    }

    /// This functions contains the discovery logic that's shared between servers.
    ///
    /// Discovery can be invoked for two reasons:  
    ///
    ///  1. This server has just been restarted and is not aware of the current constellation.
    ///     Perhaps part of our configuration has changed that makes the current constellation
    ///     obsolete.
    ///
    ///  2. The `.ph/discovery/run` endpoint was triggered.  This should happen when another
    ///     server detects that our constellation is out-of-date, but since the `.ph/discovery/run`
    ///     endpoint is unprotected, anyone can invoke it at any time.
    ///
    ///     The non-PHC servers check during their discovery whether the constellation PHC advertises
    ///     is up-to-date with respect to their own configuration.  If it isn't, the non-PHC server
    ///     triggers PHC to run discovery.
    ///     
    ///     PHC checks during its discovery (after it obtained recent details from each of the
    ///     other servers) whether the constellations of the other servers are up-to-date,
    ///     and will trigger their discovery routine when these aren't.
    ///
    ///
    /// Thus the procedure for discovery is as follows.
    ///
    ///
    /// Non-PHC:
    ///   
    ///  1. Obtain constellation from PHC.  Return if it coincides with the constellation that we already
    ///     got - if we already got one.
    ///  2. Check the constellation against our own configuration.  If it's up-to-date, restart
    ///     this server but with the new constellation.
    ///  3. Invoke discovery on PHC, and return a retryable error - effectively go back to step 1.
    ///
    ///
    /// PHC:
    ///
    ///  1. Obtain discovery info from ourselves - i.e. check whether `phc_url` is configured
    ///     correctly.
    ///  2. Retrieve discovery info from the other servers and construct a constellation from it.
    ///  3. If the constellation has changed, restart to update it.
    ///  4. Invoke discovery on those servers that have no or outdated constellations,
    ///     and return a retryable error - effectively go back to step 1.
    ///
    ///
    async fn request_discovery<S: Server>(
        &self,
        app: Rc<S::AppT>,
    ) -> api::Result<api::DiscoveryRunResp> {
        log::debug!(
            "{server_name}: discovery is requested",
            server_name = S::NAME
        );

        let mut restart_imminent_guard = match self.obtain_lock().await {
            Some(guard) => guard,
            None => {
                log::debug!(
                    "{server_name}: discovery aborted because the server is already restarting",
                    server_name = S::NAME
                );
                return Ok(api::DiscoveryRunResp::Restarting);
            }
        };

        // Obtain discovery info from PHC (even when we are PHC ourselves, for perhaps
        // the phc_url is misconfigured) and perform some basis checks.
        // Should not return an error when our constellation is out of sync.
        let phc_discovery_info = AppBase::<S>::discover_phc(app.clone()).await?;

        if phc_discovery_info.constellation.is_none() && S::NAME != Name::PubhubsCentral {
            // PubHubs Central is not yet ready - make the caller retry
            log::info!(
                "Discovery of {} is run but {} has no constellation yet",
                S::NAME,
                Name::PubhubsCentral,
            );
            return Err(api::ErrorCode::NotYetReady);
        }

        let new_constellation_maybe = app.discover(phc_discovery_info).await?;
        if new_constellation_maybe.is_none() {
            return Ok(api::DiscoveryRunResp::UpToDate);
        }

        let new_constellation = new_constellation_maybe.unwrap();

        // modify server, and restart (to modify all Apps)

        let result = app
            .handle
            .modify(
                "updated constellation after discovery",
                |server: &mut S| -> bool {
                    let extra = match server.create_running_state(&new_constellation) {
                        Ok(extra) => extra,
                        Err(err) => {
                            log::error!(
                                "Error while restarting {} after discovery: {}",
                                S::NAME,
                                err
                            );
                            return false; // do not restart
                        }
                    };

                    server.running_state = Some(RunningState::new(new_constellation, extra));

                    true // yes, restart
                },
            )
            .await;

        if let Err(()) = result {
            log::warn!("failed to initiate restart of {} for discovery, probably because the server is already shutting down", S::NAME,);
            return Err(api::ErrorCode::NotYetReady);
        }

        log::trace!(
            "{server_name}: registering imminent restart",
            server_name = S::NAME
        );
        *restart_imminent_guard = true;
        let _ = self.restart_imminent_cached.set(());

        Ok(api::DiscoveryRunResp::Restarting)
    }

    /// Obtains write lock to `self.restart_imminent_lock` when restart is not imminent.
    async fn obtain_lock(&self) -> Option<tokio::sync::RwLockWriteGuard<'_, bool>> {
        if self.restart_imminent_cached.get().is_some() {
            log::trace!("restart imminent: cached");
            return None;
        }

        if *self.restart_imminent_lock.read().await {
            log::trace!("restart imminent: discovered after obtaining read lock");
            let _ = self.restart_imminent_cached.set(());
            return None;
        }

        let restart_imminent_guard = self.restart_imminent_lock.write().await;

        if *restart_imminent_guard {
            // while we re-obtained the lock, discovery has completed
            log::trace!("restart imminent: discovered after obtaining write lock");
            let _ = self.restart_imminent_cached.set(());
            return None;
        }

        Some(restart_imminent_guard)
    }
}

/// Handle to a [Server] passed to [App]s.
///
/// Used to issue commands to the server.  Since discovery is requested a often a separate struct
/// is used to deal with discovery requests.
pub struct Handle<S: Server> {
    /// To send commands to the server
    sender: mpsc::Sender<CommandRequest<S>>,

    /// To coordinate the handling of discovery requests
    discovery_limiter: DiscoveryLimiter,
}

struct CommandRequest<S: Server> {
    /// The actual command
    command: Command<S>,
    /// A way for the [`Server`] to inform the [`App`] that the command is about to be executed.
    feedback_sender: tokio::sync::oneshot::Sender<()>,
}

impl<S: Server> CommandRequest<S> {
    /// Let's the issuer of the command know that the command is to be fulfilled
    fn accept(self) -> Command<S> {
        if let Err(_) = self.feedback_sender.send(()) {
            log::warn!(
                "The app issuing command '{}' that is about to execute has already dropped.",
                &self.command
            );
        }
        self.command
    }
}

// We cannot use "derive(Clone)", because Server is not Clone.
impl<S: Server> Clone for Handle<S> {
    fn clone(&self) -> Self {
        Handle {
            sender: self.sender.clone(),
            discovery_limiter: self.discovery_limiter.clone(),
        }
    }
}

impl<S: Server> Handle<S> {
    /// Issues command to [Runner].  Waits for the command to be next in line,
    /// but does not wait for the command to be completed.
    ///
    /// May return `Err(())` when another command shutdown the server before this
    /// command could be executed.
    ///
    /// When `Ok(())` is returned, this means the command is guaranteed to be executed momentarily.
    pub async fn issue_command(&self, command: Command<S>) -> Result<(), ()> {
        let (feedback_sender, feedback_receiver) = tokio::sync::oneshot::channel();

        let result = self
            .sender
            .send(CommandRequest {
                command,
                feedback_sender,
            })
            .await;

        if let Err(send_error) = result {
            log::warn!(
                "{server_name}: since the command receiver is closed (probably because the server is shutting down/restarting) we could not issue the command {cmd:?}",
                server_name=S::NAME,
                cmd=send_error.0.command.to_string(),
            );
            return Err(());
        };

        // Wait for the command to be the next in line.
        //
        // If feedback receiver returns an error, the command might not have executed.
        feedback_receiver.await.map_err(|_| ())
    }

    pub async fn modify(
        &self,
        display: impl std::fmt::Display + Send + 'static,
        modifier: impl FnOnce(&mut S) -> bool + Send + 'static,
    ) -> Result<(), ()> {
        self.issue_command(Command::Modify(Box::new((modifier, display))))
            .await
    }

    /// Executes `inspector` on the server instance, returning its result.
    ///
    /// Returns Err(()) when the command or its result could not be sent, probably because the
    /// server was shutting down.
    pub async fn inspect<T: Send + 'static>(
        &self,
        display: impl std::fmt::Display + Send + 'static,
        inspector: impl FnOnce(&S) -> T + Send + 'static,
    ) -> Result<T, ()> {
        let (sender, receiver) = tokio::sync::oneshot::channel::<T>();

        self.issue_command(Command::Inspect(Box::new((
            |server: &S| {
                if sender.send(inspector(server)).is_err() {
                    log::warn!(
                        "{}: could not return result of inspection because receiver was already closed",
                        S::NAME
                    );
                    // Might happen when the server is restarted ungracefully - so don't panic here.
                }
            },
            display,
        ))))
        .await?;

        receiver.await.map_err(|_| {
            log::warn!(
                "{server_name}: could receive result of inspector",
                server_name = S::NAME,
            );
        })
    }

    pub async fn request_discovery(&self, app: Rc<S::AppT>) -> api::Result<api::DiscoveryRunResp> {
        self.discovery_limiter.request_discovery::<S>(app).await
    }
}

impl<S: Server> Runner<S> {
    pub fn new(
        global_config: &crate::servers::Config,
        shutdown_receiver: tokio::sync::broadcast::Receiver<Infallible>,
        worker_count: Option<NonZero<usize>>,
    ) -> Result<Self> {
        log::trace!("{}: creating runner...", S::NAME);

        let pubhubs_server = Rc::new(S::new(global_config)?);

        log::trace!("{}: created runner", S::NAME);

        Ok(Runner {
            pubhubs_server,
            shutdown_receiver,
            worker_count,
        })
    }

    pub fn bind_to(&self) -> SocketAddr {
        self.pubhubs_server.server_config().bind_to
    }

    pub fn graceful_shutdown(&self) -> bool {
        self.pubhubs_server.server_config().graceful_shutdown
    }

    fn create_actix_server(&self, bind_to: &SocketAddr) -> Result<Handles<S>> {
        let app_creator: S::AppCreatorT = self.pubhubs_server.deref().clone();

        let (command_sender, command_receiver) = mpsc::channel(1);

        let handle = Handle::<S> {
            sender: command_sender,
            discovery_limiter: DiscoveryLimiter::new(),
        };

        log::info!(
            "{}:  binding actix server to {}, running on {:?}",
            S::NAME,
            bind_to,
            std::thread::current().id()
        );

        let app_creator2 = app_creator.clone();
        let handle2 = handle.clone();

        let actual_actix_server: actix_web::dev::Server = {
            // Build actix server
            let mut builder: actix_web::HttpServer<_, _, _, _> =
                actix_web::HttpServer::new(move || {
                    let app: Rc<S::AppT> = Rc::new(app_creator2.clone().into_app(&handle2));

                    actix_web::App::new().configure(|sc: &mut web::ServiceConfig| {
                        // first configure endpoints common to all servers
                        AppBase::<S>::configure_actix_app(&app, sc);

                        // and then server-specific endpoints
                        app.configure_actix_app(sc);
                    })
                })
                .disable_signals() // we handle signals ourselves
                .bind(bind_to)?;

            if let Some(worker_count) = self.worker_count {
                builder = builder.workers(worker_count.get());
            }

            builder.run()
        };

        // start actix server
        let actix_server_handle = actual_actix_server.handle().clone();
        let actix_join_handle = tokio::task::spawn(actual_actix_server);

        // start PH server task (doing discovery)
        let (ph_shutdown_sender, ph_shutdown_receiver) = tokio::sync::oneshot::channel();
        let ph_join_handle = tokio::task::spawn_local(
            self.pubhubs_server
                .clone()
                .run_until_modifier(ph_shutdown_receiver, Rc::new(app_creator.into_app(&handle))),
        );

        Ok(Handles {
            actix_server_handle,
            actix_join_handle,
            command_receiver,
            ph_join_handle,
            ph_shutdown_sender: Some(ph_shutdown_sender),
            drop_bomb: crate::misc::drop_ext::Bomb::new(|| {
                format!("Part of {} was not shut down properly", S::NAME)
            }),
        })
    }

    pub async fn run(mut self) -> Result<()> {
        loop {
            let modifier = self.run_until_modifier().await?;

            let pubhubs_server_mutref: &mut S =
                Rc::get_mut(&mut self.pubhubs_server).expect("pubhubs_server is still borrowed");

            let modifier_fmt = format!("{}", modifier); // so modifier can be consumed

            log::info!("{}: applying modification {:?}", S::NAME, modifier_fmt);

            if !modifier.modify(pubhubs_server_mutref) {
                log::info!(
                    "{}: not restarting upon request of {:?}",
                    S::NAME,
                    modifier_fmt
                );
                return Ok(());
            }

            log::info!("{}: restarting...", S::NAME);
        }
    }

    pub async fn run_until_modifier(
        &mut self,
    ) -> Result<crate::servers::server::BoxModifier<S>, anyhow::Error> {
        let mut handles = self.create_actix_server(&self.bind_to())?;

        let result = Self::run_until_modifier_inner(&mut handles, self).await;

        handles.shutdown(self.graceful_shutdown()).await?;

        result
    }

    async fn run_until_modifier_inner(
        handles: &mut Handles<S>,
        runner: &mut Runner<S>,
    ) -> Result<crate::servers::server::BoxModifier<S>, anyhow::Error> {
        loop {
            match handles.run_until_command(runner).await? {
                Command::Modify(modifier) => {
                    log::debug!(
                        "Stopping {} for modification {:?}...",
                        S::NAME,
                        modifier.to_string()
                    );

                    return Ok::<_, anyhow::Error>(modifier);
                }
                Command::Inspect(inspector) => {
                    log::debug!(
                        "{}: applying inspection {:?}",
                        S::NAME,
                        inspector.to_string()
                    );
                    inspector.inspect(&*runner.pubhubs_server);
                }
                Command::Exit => {
                    log::debug!("Stopping {}, as requested", S::NAME);

                    return Ok::<_, anyhow::Error>(Box::new(crate::servers::server::Exiter));
                }
            }
        }
    }
}
