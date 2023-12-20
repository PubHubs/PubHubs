//! Configuration (files)
use core::fmt::Debug;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};

use anyhow::{Context as _, Result};
use rand::Rng as _;
use url::Url;

use crate::hub;
use crate::servers::{api, for_all_servers};

/// Configuration for one, or several, of the PubHubs servers
#[derive(serde::Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct Config {
    /// URL of the PubHubs Central server.
    ///
    /// Any information on the other servers that can be stored at PHC is stored at PHC.
    pub phc_url: Url,

    /// Path with respect to which relative paths are interpretted.
    #[serde(default)]
    pub wd: PathBuf,

    /// Configuration to run PubHubs Central
    pub phc: Option<ServerConfig<phc::ExtraConfig>>,

    /// Configuration to run the Transcryptor
    pub transcryptor: Option<ServerConfig<transcryptor::ExtraConfig>>,

    /// Configuration to run the Authentication Server
    pub auths: Option<ServerConfig<auths::ExtraConfig>>,
}

/// Configuration for one server
#[derive(serde::Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct ServerConfig<ServerSpecific> {
    pub bind_to: SocketAddr,

    /// Random string used by this server to identify itself.  Randomly generated if not set.
    /// May be set manually when multiple instances of the same server are used.
    pub self_check_code: Option<String>,

    /// Key used to sign JSON web tokens generated by this server.
    /// If `None`, one is generated automatically (which is not suitable for production.)
    pub jwt_key: Option<api::SigningKey>,

    /// Scalar used for creating shared secrets between servers using Diffie--Hellman key exchange.
    pub ssp: Option<api::Scalar>,

    /// When stopping this server (for example, during discovery) have actix shutdown gracefully.
    /// Makes discovery much slower; only recommended for production.
    #[serde(default = "default_graceful_shutdown")]
    pub graceful_shutdown: bool,

    #[serde(flatten)]
    pub extra: ServerSpecific,
}

fn default_graceful_shutdown() -> bool {
    true
}

impl<Extra> ServerConfig<Extra> {
    /// Returns [ServerConfig::self_check_code], if set, or generates one.
    pub fn self_check_code(&self) -> String {
        rand::rngs::OsRng
            .sample_iter(&rand::distributions::Alphanumeric)
            .take(20)
            .map(char::from)
            .collect()
    }
}

impl Config {
    /// Loads [Config] from `path`.  
    ///
    /// Returns [None] if there's no file there.
    pub fn load_from_path(path: &Path) -> Result<Option<Self>> {
        let file = match std::fs::File::open(path) {
            Ok(file) => file,
            Err(e) => match e.kind() {
                std::io::ErrorKind::NotFound => return Ok(None),
                _ => {
                    return Err(e)
                        .with_context(|| format!("could not open config file {}", path.display()))
                }
            },
        };

        let mut res: Self = serde_yaml::from_reader(file)
            .with_context(|| format!("could not parse config file {}", path.display()))?;

        if res.wd.as_os_str().is_empty() {
            res.wd = path
                .canonicalize()
                .with_context(|| format!("failed to canonicalize path {}", path.display()))?
                .parent()
                .expect("did not expect a configuration file without a parent directory")
                .into();
        }

        if !res.wd.is_absolute() {
            anyhow::bail!(
                "if you specify a working directory (`wd` in {}) it must be absolute",
                path.display()
            );
        }

        log::info!(
            "loaded config file from {};  interpretting relative paths in {}",
            path.display(),
            res.wd.display()
        );

        Ok(Some(res))
    }
}

pub mod phc {
    use super::*;

    #[derive(serde::Deserialize, Debug, Clone)]
    #[serde(deny_unknown_fields)]
    pub struct ExtraConfig {
        /// Where can we reach the transcryptor?
        pub transcryptor_url: Url,

        /// Where can we reach the authentication server?
        pub auths_url: Url,

        pub master_private_key_part: Option<api::Scalar>,

        /// The hubs that are known to us
        pub hubs: Vec<hub::BasicInfo>,
    }
}

pub mod transcryptor {
    use super::*;

    #[derive(serde::Deserialize, Debug, Clone)]
    #[serde(deny_unknown_fields)]
    pub struct ExtraConfig {}
}

pub mod auths {
    use super::*;

    #[derive(serde::Deserialize, Debug, Clone)]
    #[serde(deny_unknown_fields)]
    pub struct ExtraConfig {}
}

pub trait GetServerConfig {
    type Extra;

    fn server_config(config: &Config) -> &ServerConfig<Self::Extra>;
}

macro_rules! implement_get_server_config {
    ($server:ident) => {
        impl GetServerConfig for crate::servers::$server::Details {
            type Extra = crate::servers::config::$server::ExtraConfig;

            fn server_config(config: &Config) -> &ServerConfig<Self::Extra> {
                &config.$server.as_ref().unwrap()
            }
        }
    };
}

for_all_servers!(implement_get_server_config);
