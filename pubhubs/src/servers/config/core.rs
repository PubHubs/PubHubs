//! Configuration (files)
use core::fmt::Debug;
use std::net::SocketAddr;
use std::ops::{Deref, DerefMut};
use std::path::{Path, PathBuf};

use anyhow::{Context as _, Result};
use url::Url;

use crate::servers::{for_all_servers, server::Server as _};
use crate::{
    api::{self},
    attr, elgamal, hub,
    misc::{jwt, time_ext},
    servers::yivi,
};

use super::host_aliases::{HostAliases, UrlPwa};

/// Configuration for one, or several, of the PubHubs servers
///
/// Also used for the `pubhubs admin` cli command.  In that case only `phc_url` needs to be set.
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct Config {
    /// URL of the PubHubs Central server.
    ///
    /// Any information on the other servers that can be stored at PHC is stored at PHC.
    pub phc_url: UrlPwa,

    #[serde(skip)]
    pub(crate) preparation_state: PreparationState,

    /// Specify abbreviations for an IP address that are only valid in this configuration file.
    ///
    /// Any [UrlPwa] that contains one of the aliases as host name exactly (so no subdomain)
    /// will be modified to have as host name the associated IP address.
    #[serde(default)]
    pub host_aliases: HostAliases,

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

/// Represents the level of preparation of a [Config] instance.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(crate) enum PreparationState {
    /// State after loading config file from disk.
    #[default]
    Unprepared,

    /// [`Config::preliminary_prep`] has been called.
    Preliminary,

    /// [`Config`] is completely prepared after [`PrepareConfig::prepare`] has been called on it.
    Complete,
}

/// Configuration for one server.  Derefs to `ServerSpecific`..
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct ServerConfig<ServerSpecific> {
    pub bind_to: SocketAddr,

    /// Random string used by this server to identify itself.  Randomly generated if not set.
    /// May be set manually when multiple instances of the same server are used.
    pub self_check_code: Option<String>,

    /// Key used to sign JSON web tokens generated by this server.
    /// If `None`, one is generated automatically (which is not suitable for production.)
    ///
    /// Generate using `cargo run tools generate signing-key`.
    pub jwt_key: Option<api::SigningKey>,

    /// Each server advertises an [`elgamal::PublicKey`] so that shared secrets may be established
    /// with this server, and also encrypted messages may be sent to it.
    ///
    /// This key is also used to derive non-permanent secrets, like the the transcryptor's
    /// encryption factor f_H for a hub H.
    ///
    /// Generate using `cargo run tools generate scalar`.
    pub enc_key: Option<elgamal::PrivateKey>,

    /// Key used by admin to sign requests for the admin endpoints.
    /// If `None`, one is generated automatically and the private key is  printed to the log.
    pub admin_key: Option<api::VerifyingKey>,

    /// If the server needs an object store, use this one.
    pub object_store: Option<ObjectStoreConfig>,

    #[serde(flatten)]
    /// Can be accessed via [`Deref`].
    extra: ServerSpecific,
}

impl<X> Deref for ServerConfig<X> {
    type Target = X;

    fn deref(&self) -> &X {
        &self.extra
    }
}

impl<X> DerefMut for ServerConfig<X> {
    fn deref_mut(&mut self) -> &mut X {
        &mut self.extra
    }
}

impl Config {
    /// Loads [Config] from `path` and generates random values.
    ///
    /// Returns [None] if there's no file there.
    pub fn load_from_path(path: &Path) -> Result<Option<Self>> {
        // NOTE: the toml crate does not have a `from_reader` like `serde_json` does
        let mut res: Self = toml::from_str(&match std::fs::read_to_string(path) {
            Ok(contents) => contents,
            Err(e) => match e.kind() {
                std::io::ErrorKind::NotFound => return Ok(None),
                _ => {
                    return Err(e)
                        .with_context(|| format!("could not open config file {}", path.display()))
                }
            },
        })
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

        res.preliminary_prep()?;

        Ok(Some(res))
    }

    pub fn preliminary_prep(&mut self) -> Result<()> {
        anyhow::ensure!(
            self.preparation_state == PreparationState::Unprepared,
            "configuration already (partially) prepared: {:?}",
            self.preparation_state
        );

        self.host_aliases.resolve_all()?;
        self.host_aliases.dealias(&mut self.phc_url);

        self.preparation_state = PreparationState::Preliminary;

        Ok(())
    }

    /// Clones this configuration and strips out everything that's not needed to run
    /// the specified server.  Also generated any random values not yet set.
    pub async fn prepare_for(&self, server: crate::servers::Name) -> Result<Self> {
        anyhow::ensure!(
            self.preparation_state == PreparationState::Preliminary,
            "configuration not in the correct preparation state"
        );

        // destruct to make sure we consider every field of Config
        let Self {
            host_aliases,
            phc_url,
            wd,
            preparation_state,
            phc: _,
            transcryptor: _,
            auths: _,
        } = self;

        let mut config: Config = Config {
            host_aliases: host_aliases.clone(),
            phc_url: phc_url.clone(),
            wd: wd.clone(),
            preparation_state: *preparation_state,
            phc: None,
            transcryptor: None,
            auths: None,
        };

        macro_rules! clone_only_server {
            ($server:ident) => {
                if crate::servers::$server::Server::NAME == server {
                    assert!(self.$server.is_some());
                    config.$server.clone_from(&self.$server);
                }
            };
        }

        for_all_servers!(clone_only_server);

        config.prepare().await?;

        Ok(config)
    }

    /// Prepares [`Config`] to be run; used by [`Config::prepare_for`].
    pub async fn prepare(&mut self) -> anyhow::Result<()> {
        let pcc = Pcc::new(actix_web::dev::Extensions::new());

        PrepareConfig::prepare(self, pcc).await
    }

    /// Creates a new [Config] from the current one by updating a specific part
    pub fn json_updated(&self, pointer: &str, new_value: serde_json::Value) -> Result<Self> {
        let mut json_config: serde_json::Value =
            serde_json::to_value(self).context("failed to serialize config")?;

        let to_be_modified: &mut serde_json::Value =
            json_config.pointer_mut(pointer).with_context(|| {
                format!(
                    "wanted to modify {} of the configuration file, but that points nowhere",
                    pointer
                )
            })?;

        to_be_modified.clone_from(&new_value);

        let new_config: Config = serde_json::from_value(json_config).with_context(|| {
            format!(
                "wanted to change {} of the configuration file to {}, but the new configuration did not deserialize",
                pointer,
                new_value,
            )
        })?;

        Ok(new_config)
    }
}

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
pub struct ObjectStoreConfig {
    /// E.g. "memory:///", or file:///some/path
    ///
    /// For a complete list, see:
    ///
    ///   <https://docs.rs/object_store/latest/object_store/enum.ObjectStoreScheme.html>
    pub url: UrlPwa,

    /// Additional options passed to the builder of the object store.
    #[serde(default)]
    pub options: std::collections::HashMap<String, String>,
}

impl Default for ObjectStoreConfig {
    fn default() -> Self {
        Self {
            url: From::<Url>::from("memory:///".try_into().unwrap()),
            options: Default::default(),
        }
    }
}

pub mod phc {
    use super::*;

    #[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
    #[serde(deny_unknown_fields)]
    pub struct ExtraConfig {
        /// Where can we reach the transcryptor?
        pub transcryptor_url: UrlPwa,

        /// Where can we reach the authentication server?
        pub auths_url: UrlPwa,

        /// The hubs that are known to us
        pub hubs: Vec<hub::BasicInfo>,

        /// `x_PHC` from the whitepaper; randomly generated if not set
        ///
        /// Generate using `cargo run tools generate scalar`.
        pub master_enc_key_part: Option<elgamal::PrivateKey>,
    }
}

pub mod transcryptor {
    use super::*;

    #[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
    #[serde(deny_unknown_fields)]
    pub struct ExtraConfig {
        /// `x_T` from the whitepaper; randomly generated if not set
        ///
        /// Generate using `cargo run tools generate scalar`.
        pub master_enc_key_part: Option<elgamal::PrivateKey>,
    }
}

pub mod auths {
    use super::*;

    #[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
    #[serde(deny_unknown_fields)]
    pub struct ExtraConfig {
        #[serde(default)]
        pub attribute_types: Vec<attr::Type>,

        /// Yivi configuration.  If `None`, yivi is not supported.
        pub yivi: Option<YiviConfig>,

        /// Authentication must be completed within this timeframe
        /// formatted as string understood by [`humantime::parse_duration`] such as `1 week`.
        #[serde(with = "time_ext::human_duration")]
        #[serde(default = "default_auth_window")]
        pub auth_window: core::time::Duration,
    }

    fn default_auth_window() -> core::time::Duration {
        core::time::Duration::from_secs(60 * 60) // one hour
    }

    impl ExtraConfig {
        /// Removes the [`attr::SourceDetails`]s of unsupported sources from
        /// [`attribute_types`].
        ///
        /// [`attribute_types`]: Self::attribute_types
        pub(super) fn filter_attribute_types(&mut self) {
            let mut supported_sources: std::collections::HashSet<attr::Source> = Default::default();

            if self.yivi.is_some() {
                assert!(supported_sources.insert(attr::Source::Yivi));
            }

            for attr_type in self.attribute_types.iter_mut() {
                attr_type.filter_sources(|s| supported_sources.contains(&s))
            }
        }
    }

    #[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
    #[serde(deny_unknown_fields)]
    pub struct YiviConfig {
        /// Where can the Yivi server trusted by the authentication server be reached
        /// by the hub client for starting disclosure requests?
        pub requestor_url: UrlPwa,

        pub requestor_creds: yivi::Credentials<yivi::SigningKey>,

        /// What server name to expect in signed session results
        pub server_name: String,

        /// Verify signed session results using this key.  If not set the key is retrieved
        /// from the yivi server.
        pub server_key: Option<yivi::VerifyingKey>,
    }

    impl YiviConfig {
        pub fn server_creds(&self) -> yivi::Credentials<yivi::VerifyingKey> {
            yivi::Credentials {
                name: self.server_name.clone(),
                key: self
                    .server_key
                    .clone()
                    .expect("bug: YiviConfig was not properly prepared"),
            }
        }
    }
}

/// Trait to prepare [`Config`] for use by initializing random values,
/// and replacing aliases in [`UrlPwa`]s.
trait PrepareConfig<C> {
    async fn prepare(&mut self, context: C) -> anyhow::Result<()>;
}

type Pcc = std::rc::Rc<actix_web::dev::Extensions>;

impl PrepareConfig<Pcc> for Config {
    async fn prepare(&mut self, mut c: Pcc) -> anyhow::Result<()> {
        anyhow::ensure!(
            self.preparation_state == PreparationState::Preliminary,
            "configuration not properly prepared"
        );

        // temporarily move `host_aliases` into Pcc
        Pcc::get_mut(&mut c)
            .unwrap()
            .insert(std::mem::take(&mut self.host_aliases));

        macro_rules! prep {
            ($server:ident) => {
                if let Some(ref mut server) = self.$server {
                    server.prepare(c.clone()).await?;
                }
            };
        }

        for_all_servers!(prep);

        // move `host_aliases` back to self, drop the substitute
        drop(std::mem::replace(
            &mut self.host_aliases,
            Pcc::get_mut(&mut c)
                .unwrap()
                .remove::<HostAliases>()
                .unwrap(),
        ));

        self.preparation_state = PreparationState::Complete;

        Ok(())
    }
}

impl<Extra: PrepareConfig<Pcc> + GetServerType> PrepareConfig<Pcc> for ServerConfig<Extra> {
    async fn prepare(&mut self, c: Pcc) -> anyhow::Result<()> {
        self.self_check_code
            .get_or_insert_with(crate::misc::crypto::random_alphanumeric);

        self.jwt_key.get_or_insert_with(api::SigningKey::generate);
        self.enc_key.get_or_insert_with(elgamal::PrivateKey::random);

        self.admin_key.get_or_insert_with(|| {
            let sk = api::SigningKey::generate();

            log::info!(
                "{} admin key: {}",
                Extra::ServerT::NAME,
                serde_json::to_string(&sk)
                    .expect("unexpected error during serialization of admin key")
            );

            sk.verifying_key().into()
        });

        if let &mut Some(&mut ref mut osc) = &mut self.object_store.as_mut() {
            c.get::<HostAliases>()
                .expect("host aliases were not passed along")
                .dealias(&mut osc.url);
        }

        self.extra.prepare(c).await?;

        Ok(())
    }
}

impl PrepareConfig<Pcc> for transcryptor::ExtraConfig {
    async fn prepare(&mut self, _c: Pcc) -> anyhow::Result<()> {
        self.master_enc_key_part
            .get_or_insert_with(elgamal::PrivateKey::random);

        Ok(())
    }
}

impl PrepareConfig<Pcc> for phc::ExtraConfig {
    async fn prepare(&mut self, c: Pcc) -> anyhow::Result<()> {
        self.master_enc_key_part
            .get_or_insert_with(elgamal::PrivateKey::random);

        let ha: &HostAliases = c.get::<HostAliases>().unwrap();

        ha.dealias(&mut self.transcryptor_url);
        ha.dealias(&mut self.auths_url);

        Ok(())
    }
}

impl PrepareConfig<Pcc> for auths::ExtraConfig {
    async fn prepare(&mut self, c: Pcc) -> anyhow::Result<()> {
        if let Some(ref mut yivi_cfg) = self.yivi {
            yivi_cfg.prepare(c).await?;
        }

        self.filter_attribute_types();

        Ok(())
    }
}

impl PrepareConfig<Pcc> for auths::YiviConfig {
    async fn prepare(&mut self, c: Pcc) -> anyhow::Result<()> {
        let ha: &HostAliases = c.get::<HostAliases>().unwrap();

        ha.dealias(&mut self.requestor_url);

        if self.server_key.is_none() {
            let pk_url = self.requestor_url.as_ref().join("publickey")?.to_string();
            log::debug!("yivi server key not set; retrieving from {pk_url}");
            let mut res = awc::Client::default()
                .get(&pk_url)
                .send()
                .await
                .map_err(|err| anyhow::anyhow!("getting public key from {pk_url} failed: {err}"))?;

            let payload: bytes::Bytes = res.body().await?;

            self.server_key = Some(yivi::VerifyingKey::RS256(
                jwt::RS256Vk::from_public_key_pem(std::str::from_utf8(&payload)?)
                    .context("decoding public key at {pk_url}")?,
            ));
        }

        Ok(())
    }
}

/// Used to implement the `server_config` method on `crate::servers::<SERVER>::Details`.
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

/// Used to implement the `ServerT` associated type of `<SERVER>::ExtraConfig`.
trait GetServerType {
    type ServerT: crate::servers::Server;
}

macro_rules! implement_server_type {
    ($server:ident) => {
        impl GetServerType for $server::ExtraConfig {
            type ServerT = crate::servers::$server::Server;
        }
    };
}

for_all_servers!(implement_server_type);
