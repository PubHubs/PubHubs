//! [Clap](clap) structs for command line argument parsing

#[cfg(feature = "old")]
pub mod old;

mod serve;
pub use serve::ServeArgs;
mod tools;
pub use tools::ToolsArgs;
