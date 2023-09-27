//! New, multi-server setup

mod api;
mod config;
mod constellation;
mod discovery;
pub(crate) mod macros;
mod run;
pub(super) mod server;

pub(crate) mod phc;
pub(crate) mod transcryptor;

pub use config::Config;
pub(super) use constellation::Constellation;
pub use discovery::drive_discovery;
pub(super) use macros::for_all_servers;
pub use run::run;
pub(super) use server::{
    App, AppBase, AppCreator, AppCreatorBase, Name, Server, ServerBase, ShutdownCommand,
    ShutdownSender,
};
