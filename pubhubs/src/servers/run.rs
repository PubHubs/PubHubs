//! Running PubHubs [Server]s
use std::net::SocketAddr;

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
        let mut joinset = tokio::task::JoinSet::<Result<()>>::new();

        macro_rules! run_server {
            ($server:ident) => {
                if let Some(server_config) = config.$server.as_ref() {
                    joinset.spawn(
                        crate::servers::run::Runner::<crate::servers::$server::Server>::new(
                            &config,
                            server_config,
                        )?
                        .run(),
                    );
                }
            };
        }

        for_all_servers!(run_server);

        Ok(Self { joinset })
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
    pubhubs_server: ServerT,
    bind_to: SocketAddr,
    graceful_shutdown: bool,
}

/// The handles to control an [actix_web::dev::Server] running a pubhubs [Server].
struct ActixHandles<S: Server> {
    /// Handle to the actual actix TCP server.  The [actix_web::dev::Server] is owned
    /// by the task driving it.
    server_handle: actix_web::dev::ServerHandle,

    /// Handle to the task driving the actix TCP server
    join_handle: tokio::task::JoinHandle<Result<(), std::io::Error>>,

    /// Receives commands from the [App]s
    receiver: mpsc::Receiver<Command<S>>,
}

impl<S: Server> ActixHandles<S> {
    /// Drives the actix server until a [Command] is received - which is returned
    async fn run_until_command(&mut self) -> anyhow::Result<Command<S>> {
        tokio::select! {
            res = &mut self.join_handle => {
                res.with_context(|| format!("{}'s task joined unexpectedly", S::NAME))?
                    .with_context(|| format!("{}'s http server crashed", S::NAME))?;
                bail!("{} stopped unexpectedly", S::NAME);
            },
            command_maybe = self.receiver.recv() => {
                if let Some(command) = command_maybe {
                    #[allow(clippy::needless_return)]
                    // Clippy wants "Ok(command)", but that's not easy to read here
                    // (Maybe clippy is not aware of the tokio::select! macro?)
                    return Ok(command);
                } else {
                    bail!("{}'s command receiver is unexpectedly closed", S::NAME);
                }
            }
        };
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
    pub fn new<T>(
        global_config: &crate::servers::Config,
        server_config: &crate::servers::config::ServerConfig<T>,
    ) -> Result<Self> {
        let pubhubs_server = S::new(global_config)?;
        let bind_to = server_config.bind_to; // SocketAddr : Copy
        let graceful_shutdown = server_config.graceful_shutdown;

        Ok(Runner {
            pubhubs_server,
            bind_to,
            graceful_shutdown,
        })
    }

    fn create_actix_server(
        &self,
        pubhubs_server: &S,
        bind_to: &SocketAddr,
    ) -> Result<ActixHandles<S>> {
        let app_creator: S::AppCreatorT = pubhubs_server.app_creator().clone();

        let (sender, receiver) = mpsc::channel(1);

        let handle = Handle::<S> { sender };

        log::info!("{}: binding actix server to {}", S::NAME, bind_to);

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

        let server_handle = actual_actix_server.handle().clone();
        let join_handle = tokio::task::spawn(actual_actix_server);

        Ok(ActixHandles {
            server_handle,
            join_handle,
            receiver,
        })
    }

    pub async fn run(mut self) -> Result<()> {
        loop {
            let modifier = self.run_until_modifier().await?;

            log::info!("{}: applying modification {}", S::NAME, modifier);

            if !modifier.modify(&mut self.pubhubs_server) {
                log::info!("{} exited", S::NAME);
                return Ok(());
            } else {
                log::info!("{}: restarting...", S::NAME)
            }
        }
    }

    pub async fn run_until_modifier(
        &mut self,
    ) -> Result<crate::servers::server::BoxModifier<S>, anyhow::Error> {
        let mut handles = self.create_actix_server(&self.pubhubs_server, &self.bind_to)?;

        loop {
            match handles.run_until_command().await? {
                Command::Modify(modifier) => {
                    log::debug!("Stopping {} for modification {}...", S::NAME, modifier);

                    handles.server_handle.stop(self.graceful_shutdown).await;

                    return Ok::<_, anyhow::Error>(modifier);
                }
                Command::Inspect(inspector) => {
                    log::debug!("{}: applying inspection {}", S::NAME, inspector);
                    inspector.inspect(&self.pubhubs_server);
                }
            }
        }
    }
}
