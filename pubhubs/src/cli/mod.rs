//! [`Clap`](clap) structs for command line argument parsing

mod common;
use common::*;

mod serve;
pub use serve::ServeArgs;
mod tools;
pub use tools::ToolsArgs;
mod admin;
pub use admin::AdminArgs;
mod enter;
pub use enter::EnterArgs;
mod stress;
pub use stress::StressArgs;
mod doc;
pub use doc::DocArgs;
