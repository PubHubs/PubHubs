//! New, multi-server setup

mod api;
mod config;
mod macros;
mod phc;
mod run;
mod server;
mod transcryptor;

pub use config::Config;
pub(super) use macros::for_all_servers;
pub use run::run;
pub(super) use server::{
    App, AppBase, AppCreator, AppCreatorBase, Name, Server, ServerBase, ShutdownCommand,
    ShutdownSender,
};
