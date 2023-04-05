use std::collections::HashSet;
use std::path::PathBuf;
use std::str::FromStr;

use anyhow::{anyhow, bail, ensure, Context, Result};
use log::{info, warn};
use serde::{Deserialize, Serialize};

use crate::serde_ext::B64;

#[derive(Serialize, Deserialize)]
pub struct File {
    /// path is the location of the configuration file,
    /// and is used to interpret paths relative to it
    #[serde(skip)]
    pub path: PathBuf,

    /// public url to reach PubHubs, for the yivi app;
    /// if None and not in production, it
    /// will be set to the IP address returned by ifconfig.me,
    /// (which might, or might not, be publically reachable)
    /// with as port the one from `bind_to` below.
    #[serde(default)]
    pub url: Option<String>,

    /// Bind to this address.  Defaults to ("0.0.0.0", "8080").
    #[serde(default = "default_bind_to")]
    pub bind_to: (String, u16),

    /// When pubhubs checks it can connect to itself, this value is expected.
    /// When None, it is randomly generated.  Set it to some none-None value
    /// when pubhubs is behind a load balancer.
    #[serde(default)]
    pub connection_check_nonce: Option<String>,

    /// location of the database file, or None when an in-memory database
    /// is to be used
    #[serde(default)]
    pub database_location: Option<String>,

    #[serde(default = "default_policy_directory")]
    pub policy_directory: String,

    #[serde(default = "default_translations_directory")]
    pub translations_directory: String,

    #[serde(default = "default_assets_directory")]
    pub assets_directory: String,

    #[serde(default = "default_templates_file")]
    pub templates_file: String,

    pub admins: HashSet<String>,
    pub allowed_embedding_contexts: Vec<String>,

    pub cookie_secret: Option<String>,
    pub admin_api_key: Option<String>,
    pub metrics_key: Option<String>,

    pub oidc_secret: Option<B64>,

    pub yivi: Yivi,
    pub pep: Pep,
}

fn default_bind_to() -> (String, u16) {
    ("0.0.0.0".to_string(), 8080)
}
fn default_policy_directory() -> String {
    "default_policies".to_string()
}
fn default_translations_directory() -> String {
    "static/translations".to_string()
}
fn default_assets_directory() -> String {
    "static/assets".to_string()
}
fn default_templates_file() -> String {
    "static/templates_hair/hair.html".to_string()
}

static ENV: &str = "PUBHUBS_CONFIG";

/// When `PUBHUBS_CONFIG` (see [ENV]) is not set, pubhubs will look for a configuration
/// file at these paths, in the order they are listed here.
static DEFAULT_PATHS: [&str; 2] = ["config.yaml", "default.yaml"];

impl File {
    /// Loads configuration from given path; returns [None] if the path does not exist.
    pub fn from_path(path_str: &str) -> Result<Option<Self>> {
        let path = PathBuf::from_str(path_str)?;

        let file = match std::fs::File::open(&path) {
            Ok(file) => file,
            Err(e) => match e.kind() {
                std::io::ErrorKind::NotFound => return Ok(None),
                _ => return Err(e).with_context(|| format!("loading {:?}", path)),
            },
        };

        let mut res: Self = serde_yaml::from_reader(file)?;
        res.path = path;
        Ok(Some(res))
    }

    /// Loads configuration from the path specified by the environmental variable
    /// `PUBHUBS_CONFIG`, or, if it has not been set, from one of the `DEFAULT_PATHS`.
    pub fn from_env() -> Result<Self> {
        match std::env::var(ENV) {
            Ok(p) => {
                return Self::from_path(&p)?.ok_or_else(|| {
                    anyhow::anyhow!(
                        "configuration file {:?} set in {:?} could not be found",
                        p,
                        ENV
                    )
                })
            }
            Err(std::env::VarError::NotPresent) => { /* break */ }
            Err(e) => {
                return Err(e)
                    .with_context(|| format!("could not read environmental variable {:?}", ENV))
            }
        }

        info!(
            "Environmental variable {:?} not set, searching for configuration at one of the default locations: {:?} ...", ENV, DEFAULT_PATHS,
        );

        for p in DEFAULT_PATHS {
            if let Some(conf) = Self::from_path(p).with_context(|| format!("loading {:?}", p))? {
                info!("loaded configuration from {}", p);
                return Ok(conf);
            }
        }

        Err(anyhow!("no configuration file found"))
    }

    /// Loads configuration for testing, from 'test.yaml'.
    pub fn for_testing() -> Self {
        Self::from_path("test.yaml")
            .expect("test.yaml to load")
            .expect("test.yaml to exist")
    }

    /// interprets a path relative to the directory that holds
    /// this configuration file
    pub fn interpret_path(&self, path: &str) -> PathBuf {
        self.path.parent().unwrap().join(path)
    }

    /// Returns the interpret_path method as object, without
    /// borrowing self
    pub fn path_interpreter(&self) -> impl Fn(&str) -> PathBuf {
        let parent_copy: PathBuf = self.path.parent().unwrap().to_path_buf();
        move |path: &str| parent_copy.join(path)
    }
}

#[derive(Serialize, Deserialize)]
pub struct Yivi {
    pub server_url: String,

    /// Base url for Yivi app endpoints;
    /// if none, will be the same as server_url
    #[serde(default)]
    pub client_url: Option<String>,

    #[serde(default = "default_yivi_requestor")]
    pub requestor: String,

    pub requestor_hmac_key: Option<String>, // must be base64

    #[serde(default = "default_yivi_server_issuer")]
    pub server_issuer: String,

    pub server_key_file: Option<String>,
}

fn default_yivi_requestor() -> String {
    "pubhubs".to_string()
}
fn default_yivi_server_issuer() -> String {
    "yiviserver".to_string()
}

#[derive(Serialize, Deserialize)]
pub struct Pep {
    pub global_public_key: Option<String>,
    pub global_secret_key: Option<String>,
    pub factor_secret: Option<String>,

    #[serde(default = "default_libpep_location")]
    pub libpep_location: String,
}

fn default_libpep_location() -> String {
    "libpepcli".to_string()
}

impl File {
    pub async fn determine_url(&self) -> Result<String> {
        if let Some(url) = self.url.clone() {
            ensure!(
                url.ends_with('/'),
                "pubhubs url must end with a slash ('/')"
            );
            return Ok(url);
        }

        if cfg!(not(debug_assertions)) {
            bail!("autodection of your (and thus PubHubs') public IP address (so the Yivi app can reach PubHubs) is only supported in debug mode - please specify the 'url' configuration field manually");
        }

        if cfg!(test) {
            warn!("won't autodetect your public IP address during testing");
            return Ok("http://example.com/?autodetection_of_pubhubs_public_ip_address_is_disabled_during_tests__please_set_it_manually_if_really_needed".to_string());
        }

        info!("autodetecting your public ip address...");

        // the awc crate has no multi-thread support, see
        //   https://github.com/actix/actix-web/issues/2679#issuecomment-1059141565
        // so we execute awc on a single thread..
        tokio::task::LocalSet::new()
            .run_until(async move {
                // get ip address..
                let client = awc::Client::default();
                let mut resp = client
                    .get("http://ifconfig.me")
                    .send()
                    .await
                    .map_err(|e| anyhow!(e.to_string() /* e is not Send */))?;

                let status = resp.status();
                ensure!(
                    status.is_success(),
                    "ifconfig.me returned status {}",
                    status
                );

                let bytes = resp.body().await?;
                let result = String::from_utf8(bytes.to_vec())?;

                info!("your ip address is {}", result);

                Ok(format!("http://{}:{}/", result, self.bind_to.1))
            })
            .await
    }
}

pub fn having_debug_default<T>(
    what: Option<T>,
    default: impl Into<T>,
    name: &'static str,
) -> Result<T> {
    what.or_else(|| {
        if cfg!(debug_assertions) {
            warn!("using default {}", name);
            Some(default.into())
        } else {
            None
        }
    })
    .ok_or_else(|| anyhow!("{} must be manually set in production", name))
}
