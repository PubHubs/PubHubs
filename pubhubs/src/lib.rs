#[cfg(feature = "old")]
mod old {
    pub mod bar;
    pub mod config;
    pub mod context;
    pub mod cookie;
    pub mod crypto;
    pub mod data;
    pub mod error;
    pub mod hairy_ext;
    pub mod jwt;
    pub mod middleware;
    pub mod oidc;
    pub mod oidc_handler;
    pub mod policy;
    pub mod pseudonyms;
    pub mod serde_ext;
    pub mod translate;
    pub mod yivi;
    pub mod yivi_proxy;
}

#[cfg(feature = "old")]
pub use old::*;

#[cfg(feature = "bin")]
pub mod cli;

#[cfg(feature = "common")]
mod common {
    pub mod elgamal;
}

#[cfg(feature = "common")]
pub use common::*;

// only symbols in the root are exported
#[cfg(feature = "abi")]
pub use elgamal::abi::*;
