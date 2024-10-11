//! Helper functions to interact with the PubHubs backend servers

pub mod discovery;
pub use discovery::await_discovery;
pub use discovery::get_constellation;

pub mod for_hubs;
