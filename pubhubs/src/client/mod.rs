//! Helper functions to interact with the PubHubs backend servers

pub mod discovery;
pub use discovery::get_constellation;
pub use discovery::try_get_stable_constellation;

pub mod for_hubs;
