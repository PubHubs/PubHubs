//! The pubhubs backend servers

pub mod config;
pub mod constellation;
pub mod macros;
mod object_store;
mod run;
pub(super) mod server;
pub mod yivi;

pub(crate) mod auths;
pub(crate) mod phc;
pub(crate) mod transcryptor;

pub use config::Config;
pub use constellation::Constellation;
pub use macros::for_all_servers;
pub(super) use run::Handle;
pub use run::Set;
pub(super) use server::{
    App, AppBase, AppCreator, AppCreatorBase, Command, Details, DiscoverVerdict, Name, Server,
    ServerImpl,
};

pub(crate) mod version;
pub use version::version;
