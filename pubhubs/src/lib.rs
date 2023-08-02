#[cfg(feature = "rlib")]
mod rlib {
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

#[cfg(feature = "rlib")]
pub use rlib::*;

#[cfg(feature = "common")]
pub mod elgamal;

// only symbols in the root are exported
#[cfg(feature = "cdylib")]
pub use elgamal::abi::*;
