//! New, multi-server setup

mod api;
mod config;
mod constellation;
mod discovery;
pub(crate) mod macros;
mod run;
pub(super) mod server;

pub(crate) mod auths;
pub(crate) mod phc;
pub(crate) mod transcryptor;

pub use config::Config;
pub use constellation::Constellation;
pub use discovery::drive_discovery;
pub(super) use macros::for_all_servers;
pub use run::Set;
pub(super) use server::{
    App, AppBase, AppCreator, AppCreatorBase, Details, Name, Server, ServerImpl, ShutdownCommand,
    ShutdownSender,
};
