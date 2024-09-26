//! Running PubHubs [Server]s
use std::net::SocketAddr;
use std::rc::Rc;

use actix_web::web;
use anyhow::{bail, Context as _, Result};
use core::convert::Infallible;
use tokio::sync::mpsc;

use crate::servers::{for_all_servers, App, AppBase, AppCreator, Command, Server};

/// A set of running PubHubs servers.
pub struct Set {
    joinset: tokio::task::JoinSet<Result<()>>,

    /// Via `shutdown_sender` [Set] broadcasts the instruction to shutdown to all servers
    /// running in the `jointset`.  It does so not by `send`ing a message, but by dropping
    /// the `shutdown_sender`.
    shutdown_sender: Option<tokio::sync::broadcast::Sender<Infallible>>,

    /// Via `shutdown_receiver`, the [Set] received the instruction to close.
    shutdown_receiver: tokio::sync::oneshot::Receiver<Infallible>,
}

impl Drop for Set {
    fn drop(&mut self) {
        if self.shutdown_sender.is_some() {
            log::error!("the completion of all pubhubs servers was not awaited - please consume Set using wait() or shutdown()")
        }
    }
}

impl Set {
    /// Creates a new set of PubHubs servers from the given config.
    ///
    /// Returns not only the [Set] instance, but also a [tokio::sync::oneshot::Sender<Infallible>]
    /// that can be dropped to signal the [Set] should shutdown.
    pub fn new(
        config: &crate::servers::Config,
    ) -> Result<(Self, tokio::sync::oneshot::Sender<Infallible>)> {
        let rt_handle: tokio::runtime::Handle = tokio::runtime::Handle::current();
        let mut joinset = tokio::task::JoinSet::<Result<()>>::new();

        let (shutdown_sender, _) = tokio::sync::broadcast::channel(1); // NB capacity of 0 is not allowed

        macro_rules! run_server {
            ($server:ident) => {
                if config.$server.is_some() {
                    let config = config.clone();
                    let rt_handle = rt_handle.clone();
                    let shutdown_receiver = shutdown_sender.subscribe();

                    // We use spawn_blocking instead of spawn, because we want a separate thread
                    // for each server to run on
                    joinset.spawn_blocking(|| -> Result<()> {
                        Self::run_server::<crate::servers::$server::Server>(
                            config,
                            rt_handle,
                            shutdown_receiver,
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
    ) -> Result<()> {
        let localset = tokio::task::LocalSet::new();
        let fut = localset
            .run_until(crate::servers::run::Runner::<S>::new(&config, shutdown_receiver)?.run());

        let result = rt_handle.block_on(fut);

        rt_handle.block_on(localset);

        log::debug!("{} stopped with {:?}", S::NAME, result);

        result
    }

    /// Waits for one of the servers to return, panic, or be cancelled.
    /// If that happens, the other servers are directed to shutdown as well.
    /// Returns the number of servers that did *not* shutdown cleanly
    pub async fn wait(mut self) -> usize {
        let err_count: usize = tokio::select! {
            // either one of the servers exists
            result_maybe = self
                .joinset
                .join_next() => {
                    let result = result_maybe.expect("no servers to wait on");
                    log::debug!(
                        "one of the servers exited with {:?};  stopping all servers..",
                        result
                    );
                    if matches!(result, Err(_) | Ok(Err(_))) {
                        1
                    } else {
                        0
                    }
                },

            // or we get the command to shut down from higher up
            result = &mut self.shutdown_receiver => {
                result.expect_err("received Infallible");
                log::debug!("shutdown requested");0
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

/// Runs a [Server].
pub struct Runner<ServerT: Server> {
    pubhubs_server: Rc<ServerT>,
    shutdown_receiver: tokio::sync::broadcast::Receiver<Infallible>,
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
    command_receiver: mpsc::Receiver<Command<S>>,

    /// To check whether [Handles::shutdown] was completed before being dropped
    drop_bomb: crate::misc::drop_ext::Bomb,
}

impl<S: Server> Handles<S> {
    /// Drives the actix server until a [Command] is received - which is returned
    async fn run_until_command(&mut self, runner: &mut Runner<S>) -> anyhow::Result<Command<S>> {
        tokio::select! {

            // received command from running pubhubs/actix server
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
    pub fn new(
        global_config: &crate::servers::Config,
        shutdown_receiver: tokio::sync::broadcast::Receiver<Infallible>,
    ) -> Result<Self> {
        let pubhubs_server = Rc::new(S::new(global_config)?);

        Ok(Runner {
            pubhubs_server,
            shutdown_receiver,
        })
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

        let app_creator2 = app_creator.clone();
        let handle2 = handle.clone();

        let actual_actix_server: actix_web::dev::Server = actix_web::HttpServer::new(move || {
            let app: S::AppT = app_creator2.clone().into_app(&handle2);

            actix_web::App::new().configure(|sc: &mut web::ServiceConfig| {
                // first configure endpoints common to all servers
                AppBase::<S>::configure_actix_app(&app, sc);

                // and then server-specific endpoints
                app.configure_actix_app(sc);
            })
        })
        .disable_signals() // we handle signals ourselves
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
                .run_until_modifier(ph_shutdown_receiver, app_creator.into_app(&handle)),
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

            log::info!("{}: applying modification {}", S::NAME, modifier_fmt);

            if !modifier.modify(pubhubs_server_mutref) {
                log::info!(
                    "{}: not restarting upon request of {}",
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
                    log::debug!("Stopping {} for modification {}...", S::NAME, modifier);

                    return Ok::<_, anyhow::Error>(modifier);
                }
                Command::Inspect(inspector) => {
                    log::debug!("{}: applying inspection {}", S::NAME, inspector);
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
