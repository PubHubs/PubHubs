use std::collections::HashSet;
use std::path::PathBuf;
use std::str::FromStr;

use anyhow::{anyhow, bail, ensure, Context, Result};
use log::{info, warn};
use serde::{Deserialize, Serialize};

use crate::misc::serde_ext::B64;

#[derive(Serialize, Deserialize)]
pub struct File {
    /// path is the location of the configuration file,
    /// and is used to interpret paths relative to it
    #[serde(skip)]
    pub path: PathBuf,

    /// Url of PubHubs Central.  If None, 'urls' below are used.
    #[serde(default)]
    pub url: Option<url::Url>,

    /// Offers more fine grained control over who gets what URL for PubHubs Central.
    /// The user's browser might reach PubHubs Central
    /// via http://localhost:8080, while hubs in a docker container
    /// might need to use <http://host.docker.internal:8080>, or, e.g., http://1.2.3.4:8080
    #[serde(default)]
    pub urls: Option<Urls>,

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

    #[serde(default)]
    pub static_files: StaticFiles,

    #[serde(default)]
    pub hotfixes: Hotfixes,
}

// for a hotfix to #459
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StaticFiles {
    pub dont_use_etag: bool,
    pub use_last_modified: bool,
    pub dont_prefer_utf8: bool,
    pub disable_content_disposition: bool,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Hotfixes {
    /// remove these headers from all responses
    pub remove_headers: Vec<String>,
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
    /// The Yivi server serves two APIs:
    ///  1.)  One, under /irma,  for 'clients' (i.e. Yivi apps)  to disclose, sign, and receive credentials, and
    ///  2.)  one, under /session,  for 'requestors' to start and inspect Yivi sessions.
    ///
    /// By default, Yivi serves both on the same (IP address and) port, but it can be configured to
    /// serve the client endpoints via a different (IP address and) port, via `client_port` (and
    /// `client_listen_addr`, see:
    ///
    ///  <https://irma.app/docs/irma-server/#http-server-endpoints>
    ///
    /// Seperate ports make it possible to shield the requestor endpoint from the wider internet.

    /// Base url (so without the /session) to the Yivi server's requestor API for use by
    /// PubHubs Central.
    #[serde(alias = "server_url")]
    pub requestor_api_url: String,

    /// Base url (so without the /irma) to the Yivi server's client API for use by the PubHubs
    /// Central Yivi proxy.  Note that this is not the url used by the Yivi app.
    ///
    /// If None, `requestor_api_url` will be used.
    #[serde(default)]
    #[serde(alias = "client_url")]
    pub client_api_url: Option<String>,

    #[serde(default = "default_yivi_requestor")]
    pub requestor: String,

    pub requestor_hmac_key: Option<String>, // must be base64

    #[serde(default = "default_yivi_server_issuer")]
    pub server_issuer: String,

    pub server_key_file: Option<String>,
}

#[derive(Serialize, Deserialize, PartialEq, Eq, Debug)]
pub struct Urls {
    for_browser: url::Url,
    for_hub: AltUrl,
    for_yivi_app: AltUrl,
}

#[derive(Serialize, Deserialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum AltUrl {
    /// Don't use a special URL, but the same as for the browser.
    /// This is the expected value in production.
    SameAsForBrowser,

    /// Use this URL
    Manual(url::Url),

    /// Autodetect public IP address of the local host using ifconfig.me,
    /// and use that one with the port from `bind_to`.
    ///
    /// Warning:  you might be behind a NAT or firewall
    Autodetect,
}

fn default_yivi_requestor() -> String {
    "pubhubs".to_string()
}
fn default_yivi_server_issuer() -> String {
    "irmaserver".to_string()
}

#[derive(Serialize, Deserialize)]
pub struct Pep {
    pub global_public_key: Option<String>,
    pub global_secret_key: Option<String>,
    pub factor_secret: Option<String>,
}

impl File {
    pub async fn determine_urls(&self) -> Result<crate::context::Urls> {
        if cfg!(not(debug_assertions)) && self.url.is_none() {
            bail!("in production 'url' must be set (and 'urls' can't be used)");
        }

        ensure!(
            self.url.is_none() != self.urls.is_none(),
            "either 'url' or 'urls' must be specified, but in {} they are neither or both",
            self.path.display()
        );

        if let Some(ref url) = self.url {
            ensure!(
                url.as_str().ends_with('/'),
                "'url' must end with a slash ('/')"
            );

            return Ok(crate::context::Urls {
                for_browser: url.clone(),
                for_hub: url.clone(),
                for_yivi_app: url.clone(),
            });
        }

        let urls = self.urls.as_ref().unwrap();

        let autodetected = urls.autodetect(self).await?;

        Ok(crate::context::Urls {
            for_browser: urls.for_browser.clone(),
            for_hub: urls
                .for_hub
                .evaluate("urls.for_hub", &urls.for_browser, &autodetected)?,
            for_yivi_app: urls.for_yivi_app.evaluate(
                "urls.for_yivi_app",
                &urls.for_browser,
                &autodetected,
            )?,
        })
    }
}

impl Urls {
    /// If for_hub or for_yivi_app is autodetect, autodetect URL;  else returns None.
    async fn autodetect(&self, file: &File) -> Result<Option<url::Url>> {
        if self.for_hub != AltUrl::Autodetect && self.for_yivi_app != AltUrl::Autodetect {
            return Ok(None);
        }

        ensure!(
            !cfg!(test),
            "autodetection of public IP address not permitted during tests!"
        );

        info!("autodetecting your public ip address...");

        // the awc crate has no multi-thread support, see
        //   https://github.com/actix/actix-web/issues/2679#issuecomment-1059141565
        // so we execute awc on a single thread..
        Ok(Some(url::Url::parse(
            &tokio::task::LocalSet::new()
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

                    Ok(format!("http://{}:{}/", result, file.bind_to.1))
                })
                .await?,
        )?))
    }
}

impl AltUrl {
    fn evaluate(
        &self,
        name: &'static str,
        for_browser: &url::Url,
        autodetected: &Option<url::Url>,
    ) -> Result<url::Url> {
        Ok(match self {
            AltUrl::SameAsForBrowser => for_browser.clone(),
            AltUrl::Manual(ref url) => {
                ensure!(
                    url.as_str().ends_with('/'),
                    format!("'{}' must end with a slash ('/')", name),
                );
                url.clone()
            }
            AltUrl::Autodetect => autodetected
                .as_ref()
                .expect("autodetected to have been set")
                .clone(),
        })
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
