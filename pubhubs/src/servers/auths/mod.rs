//! Server: Authentication Server
mod auth;
mod keys;
mod server;
pub(crate) mod yivi;

pub use server::{Details, Server};
