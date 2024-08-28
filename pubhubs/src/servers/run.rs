//! Running PubHubs [Server]s
use std::net::SocketAddr;
use std::rc::Rc;

use actix_web::web;
use anyhow::{bail, Context as _, Result};
use tokio::sync::mpsc;

use crate::servers::{for_all_servers, App, AppBase, AppCreator, Command, Server};

/// A set of running PubHubs servers.
pub struct Set {
    joinset: tokio::task::JoinSet<Result<()>>,
}

impl Set {
    /// Creates a new set of PubHubs servers from the given config.
    pub fn new(config: &crate::servers::Config) -> Result<Self> {
        let rt_handle: tokio::runtime::Handle = tokio::runtime::Handle::current();
        let mut joinset = tokio::task::JoinSet::<Result<()>>::new();

        macro_rules! run_server {
            ($server:ident) => {
                if config.$server.is_some() {
                    let config = config.clone();
                    let rt_handle = rt_handle.clone();

                    // We use spawn_blocking instead of spawn, because we want a separate thread
                    // for each server to run on
                    joinset.spawn_blocking(|| -> Result<()> {
                        Self::run_server::<crate::servers::$server::Server>(config, rt_handle)
                    });
                }
            };
        }

        for_all_servers!(run_server);

        Ok(Self { joinset })
    }

    fn run_server<S: Server>(
        config: crate::servers::Config,
        rt_handle: tokio::runtime::Handle,
    ) -> Result<()> {
        let localset = tokio::task::LocalSet::new();
        let fut = localset.run_until(crate::servers::run::Runner::<S>::new(&config)?.run());

        let result = rt_handle.block_on(fut);

        rt_handle.block_on(localset);

        log::debug!("{} stopped with {:?}", S::NAME, result);

        result
    }

    /// Waits for one of the servers to return, panic, or be cancelled.
    ///
    /// By consuming the [Set], all other servers are aborted when [Set::wait_for_err] returns.
    pub async fn wait_for_err(mut self) -> anyhow::Error {
        let result = self
            .joinset
            .join_next()
            .await
            .expect("no servers to wait on");

        log::debug!(
            "one of the servers exited with {:?};  stopping all servers..",
            result
        );

        anyhow::anyhow!("one of the servers exited")
    }
}

/// Runs a [Server].
pub struct Runner<ServerT: Server> {
    pubhubs_server: Rc<ServerT>,
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

    /// To order `ph_join_handle` to shutdown.  [None] when used.
    ph_shutdown_sender: tokio::sync::oneshot::Sender<()>,

    /// Receives commands from the [App]s
    command_receiver: mpsc::Receiver<Command<S>>,

    /// To check whether [Handles::shutdown] was completed before being dropped
    drop_bomb: crate::misc::drop_ext::Bomb,
}

impl<S: Server> Handles<S> {
    /// Drives the actix server until a [Command] is received - which is returned
    async fn run_until_command(&mut self) -> anyhow::Result<Command<S>> {
        tokio::select! {
            res = &mut self.actix_join_handle => {
                res.inspect_err(|err| log::error!("{}'s actix task joined unexpectedly: {}", S::NAME, err) )
                    .with_context(|| format!("{}'s actix task joined unexpectedly", S::NAME))?
                    .inspect_err(|err| log::error!("{}'s http server crashed: {}", S::NAME, err) )
                    .with_context(|| format!("{}'s http server crashed", S::NAME))?;

                log::error!("{}'s actix server stopped unexpectedly", S::NAME);
                bail!("{}'s actix server stopped unexpectedly", S::NAME);
            },
            command_maybe = self.command_receiver.recv() => {
                if let Some(command) = command_maybe {
                    #[allow(clippy::needless_return)]
                    // Clippy wants "Ok(command)", but that's not easy to read here
                    // (Maybe clippy is not aware of the tokio::select! macro?)
                    return Ok(command);
                }

                log::error!("{}'s command receiver is unexpectedly closed", S::NAME);
                bail!("{}'s command receiver is unexpectedly closed", S::NAME);
            },
            res = &mut self.ph_join_handle => {
                let modifier : crate::servers::server::BoxModifier<S> =
                res.with_context(|| format!("{}'s pubhubs task joined unexpectedly", S::NAME))?
                    .with_context(|| format!("{}'s pubhubs task crashed", S::NAME))?
                    .with_context(|| format!("{}'s pubhubs task stopped without being asked to", S::NAME))?;

                return Ok(Command::Modify(modifier));
            }
        };
    }

    /// Consumes this [Handles] shutting down the actix server and pubhubs tasks.
    async fn shutdown(self, graceful_actix_shutdown: bool) -> anyhow::Result<()> {
        log::debug!("Shut down of {} started", S::NAME);

        self.ph_shutdown_sender.send(());

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

/// Handle to a [Server] passed to [App]s.
pub struct Handle<S: Server> {
    sender: mpsc::Sender<Command<S>>,
}

// We cannot use "derive(Clone)", because Server is not Clone.
impl<S: Server> Clone for Handle<S> {
    fn clone(&self) -> Self {
        Handle {
            sender: self.sender.clone(),
        }
    }
}

impl<S: Server> Handle<S> {
    /// Issues command to [Runner].  Waits for the command to be enqueued,
    /// but does not wait for the command to be completed.
    pub async fn issue_command(&self, command: Command<S>) -> Result<()> {
        let result = self.sender.send(command).await;

        if let Err(send_error) = result {
            bail!("{}: failed to send command {}", S::NAME, send_error.0);
        };

        Ok(())
    }

    pub async fn modify(
        &self,
        display: impl std::fmt::Display + Send + 'static,
        modifier: impl FnOnce(&mut S) -> bool + Send + 'static,
    ) -> Result<()> {
        self.issue_command(Command::Modify(Box::new((modifier, display))))
            .await
    }

    pub async fn inspect<T: Send + 'static>(
        &self,
        display: impl std::fmt::Display + Send + 'static,
        inspector: impl FnOnce(&S) -> T + Send + 'static,
    ) -> Result<T> {
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

        Ok(receiver.await?)
    }
}

impl<S: Server> Runner<S> {
    pub fn new(global_config: &crate::servers::Config) -> Result<Self> {
        let pubhubs_server = Rc::new(S::new(global_config)?);

        Ok(Runner { pubhubs_server })
    }

    pub fn bind_to(&self) -> SocketAddr {
        self.pubhubs_server.server_config().bind_to
    }

    pub fn graceful_shutdown(&self) -> bool {
        self.pubhubs_server.server_config().graceful_shutdown
    }

    fn create_actix_server(&self, bind_to: &SocketAddr) -> Result<Handles<S>> {
        let app_creator: S::AppCreatorT = self.pubhubs_server.app_creator().clone();

        let (command_sender, command_receiver) = mpsc::channel(1);

        let handle = Handle::<S> {
            sender: command_sender,
        };

        log::info!(
            "{}:  binding actix server to {}, running on {:?}",
            S::NAME,
            bind_to,
            std::thread::current().id()
        );

        let actual_actix_server: actix_web::dev::Server = actix_web::HttpServer::new(move || {
            let app: S::AppT = app_creator.clone().into_app(&handle);

            actix_web::App::new().configure(|sc: &mut web::ServiceConfig| {
                // first configure endpoints common to all servers
                AppBase::<S>::configure_actix_app(&app, sc);

                // and then server-specific endpoints
                app.configure_actix_app(sc);
            })
        })
        .bind(bind_to)?
        .run();

        // start actix server
        let actix_server_handle = actual_actix_server.handle().clone();
        let actix_join_handle = tokio::task::spawn(actual_actix_server);

        // start PH server task (doing discovery)
        let (ph_shutdown_sender, ph_shutdown_receiver) = tokio::sync::oneshot::channel();
        let ph_join_handle = tokio::task::spawn_local(
            self.pubhubs_server
                .clone()
                .run_until_modifier(ph_shutdown_receiver),
        );

        Ok(Handles {
            actix_server_handle,
            actix_join_handle,
            command_receiver,
            ph_join_handle,
            ph_shutdown_sender,
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

            log::info!("{}: applying modification {}", S::NAME, modifier);

            modifier.modify(pubhubs_server_mutref);

            log::info!("{}: restarting...", S::NAME);
        }
    }

    pub async fn run_until_modifier(
        &mut self,
    ) -> Result<crate::servers::server::BoxModifier<S>, anyhow::Error> {
        let mut handles = self.create_actix_server(&self.bind_to())?;

        let result = Self::run_until_modifier_inner(&mut handles, &self.pubhubs_server).await;

        handles.shutdown(self.graceful_shutdown()).await?;

        result
    }

    async fn run_until_modifier_inner(
        handles: &mut Handles<S>,
        pubhubs_server: &S,
    ) -> Result<crate::servers::server::BoxModifier<S>, anyhow::Error> {
        loop {
            match handles.run_until_command().await? {
                Command::Modify(modifier) => {
                    log::debug!("Stopping {} for modification {}...", S::NAME, modifier);

                    return Ok::<_, anyhow::Error>(modifier);
                }
                Command::Inspect(inspector) => {
                    log::debug!("{}: applying inspection {}", S::NAME, inspector);
                    inspector.inspect(pubhubs_server);
                }
            }
        }
    }
}
