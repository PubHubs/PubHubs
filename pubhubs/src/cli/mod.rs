//! [Clap](clap) structs for command line argument parsing

#[cfg(feature = "oldbin")]
pub mod old;

mod serve;
pub use serve::ServeArgs;
