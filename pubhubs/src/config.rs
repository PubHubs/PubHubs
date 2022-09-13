use anyhow::{anyhow, bail, ensure, Context, Result};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;
use std::str::FromStr;

#[derive(Serialize, Deserialize)]
pub struct File {
    /// path is the location of the configuration file,
    /// and is used to interpret paths relative to it
    #[serde(skip)]
    pub path: PathBuf,

    /// public url to reach PubHubs, for the Irma app;
    /// if None and not in production, it
    /// will be set to the IP address returned by ifconfig.me,
    /// (which might, or might not, be publically reachable.)
    #[serde(default)]
    pub url: Option<String>,

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

    pub cookie_secret: Option<String>,
    pub admin_api_key: Option<String>,

    pub irma: Irma,
    pub pep: Pep,
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
static DEFAULT_PATH: &str = "default.yaml";

impl File {
    pub fn from_path(path_str: &str) -> Result<Self> {
        let path = PathBuf::from_str(path_str)?;

        let mut res: Self = serde_yaml::from_reader(std::fs::File::open(&path)?)?;
        res.path = path;
        Ok(res)
    }

    pub fn from_env() -> Result<Self> {
        let path =
            &std::env::var(ENV /* = "PUBHUBS_CONFIG" */).or_else(|err: std::env::VarError| {
                if let std::env::VarError::NotPresent = err {
                    warn!(
                        "Environment variable '{}' not set. Using default values from '{}'",
                        ENV, DEFAULT_PATH
                    );
                    return Ok(DEFAULT_PATH.to_string());
                }
                bail!(
                    "unexpected error while retrieving the environmental variable {}",
                    ENV
                );
            })?;
        Self::from_path(path).with_context(|| format!("loading {}", path))
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
pub struct Irma {
    pub server_url: String,

    /// Base url for IRMA app endpoints;  
    /// if none, will be the same as server_url
    #[serde(default)]
    pub client_url: Option<String>,

    #[serde(default = "default_irma_requestor")]
    pub requestor: String,

    pub requestor_hmac_key: Option<String>, // must be base64

    #[serde(default = "default_irma_server_issuer")]
    pub server_issuer: String,

    pub server_key_file: Option<String>,
}

fn default_irma_requestor() -> String {
    "pubhubs".to_string()
}
fn default_irma_server_issuer() -> String {
    "irmaserver".to_string()
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
            bail!("autodection of your (and thus PubHubs') public IP address (so the IRMA app can reach PubHubs) is only supported in debug mode - please specify the 'url' configuration field manually");
        }

        if cfg!(test) {
            warn!("won't autodetect your public IP address during testing");
            return Ok("http://example.com/?autodetection_of_pubhubs_public_ip_address_is_disabled_during_tests__please_set_it_manually_if_really_needed".to_string());
        }

        info!("autodetecting your public ip address...");

        let resp = hyper::Client::new()
            .get("http://ifconfig.me".parse().unwrap())
            .await?;

        let status = resp.status();
        ensure!(
            status.is_success(),
            "ifconfig.me returned status {}",
            status
        );

        let bytes = hyper::body::to_bytes(resp.into_body()).await?;
        let result = String::from_utf8(bytes.to_vec())?;

        info!("your ip address is {}", result);

        Ok(format!("http://{}:8080/", result))
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
