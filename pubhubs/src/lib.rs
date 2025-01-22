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
    pub mod middleware;
    pub mod oidc;
    pub mod oidc_handler;
    pub mod pseudonyms;
    pub mod translate;
    pub mod yivi;
    pub mod yivi_proxy;
}

#[cfg(feature = "old")]
pub use old::*;

#[cfg(feature = "bin")]
pub mod cli;

#[cfg(feature = "bin")]
pub mod servers;

#[cfg(feature = "bin")]
pub mod client;

#[cfg(feature = "bin")]
pub mod api;

#[cfg(feature = "bin")]
pub mod hub;

#[cfg(feature = "bin")]
pub mod phcrypto;

#[cfg(any(feature = "bin", feature = "old"))]
pub mod misc;

#[cfg(feature = "old")]
pub use misc::jwt;

#[cfg(feature = "common")]
mod common;

#[cfg(feature = "common")]
pub use common::elgamal; // For backwards compatibility with the old pubhubs

// only symbols in the root are exported
#[cfg(feature = "abi")]
pub use elgamal::abi::*;
