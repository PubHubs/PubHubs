use std::borrow::Cow;
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

    /// Url of PubHubs Central.
    ///
    /// If None and not in production, it will be localhost with as port the one from `bind_to` below.
    #[serde(default)]
    pub url: Option<String>,

    /// Url of PubHubs Central reachable by the Yivi app, so 'localhost' might not work here.
    /// By default, `url` is used.  For more details, see [UrlForYiviApp].
    #[serde(default)]
    pub url_for_yivi_app: UrlForYiviApp,

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
    /// The Yivi server serves two APIs:
    ///  1.)  One, under /irma,  for 'clients' (i.e. Yivi apps)  to disclose, sign, and receive credentials, and
    ///  2.)  one, under /session,  for 'requestors' to start and inspect Yivi sessions.
    ///
    /// By default, Yivi serves both on the same (IP address and) port, but it can be configured to
    /// serve the client endpoints via a different (IP address and) port, via `client_port` (and
    /// `client_listen_addr`, see:
    ///
    ///  https://irma.app/docs/irma-server/#http-server-endpoints
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
#[serde(rename_all = "lowercase")]
pub enum UrlForYiviApp {
    /// Don't use a special URL for PubHubs Central for the Yivi app.
    /// This is the value expected in production.
    Same,

    /// Use this URL.
    Manual(String),

    /// Autodetect public IP address of the local host using ifconfig.me,
    /// and use that one with the port from `bind_to` as URL for the Yivi app.
    Autodetect,
}

impl Default for UrlForYiviApp {
    fn default() -> Self {
        UrlForYiviApp::Same
    }
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

    #[serde(default = "default_libpep_location")]
    pub libpep_location: String,
}

fn default_libpep_location() -> String {
    "libpepcli".to_string()
}

impl File {
    pub fn determine_url(&self) -> Result<Cow<str>> {
        match self.url {
            Some(ref url) => {
                ensure!(
                    url.ends_with('/'),
                    "pubhubs manual url for yivi app  must end with a slash ('/')"
                );
                return Ok(Cow::Borrowed(url));
            }
            None => {
                return Ok(Cow::Owned(format!("http://localhost:{}/", self.bind_to.1)));
            }
        }
    }

    pub async fn determine_url_for_yivi_app(&self) -> Result<String> {
        if self.url_for_yivi_app == UrlForYiviApp::Same {
            let url = self.determine_url()?.into_owned();

            if self.url.is_none() {
                log::error!("'url_for_yifi_app' is set to be the same as 'url', which is not set and thus {} by default;  the Yivi app will probably not be able to reach PubHubs Central there", url);
            }

            return Ok(url);
        }

        if cfg!(not(debug_assertions)) {
            bail!("autodection or manual configuration of the PubHubs URL communicated to the  Yivi App is only allowed in debug mode; please set 'url_for_yivi' app to 'same'.");
        }

        if let UrlForYiviApp::Manual(ref url) = self.url_for_yivi_app {
            ensure!(
                url.ends_with('/'),
                "pubhubs manual url for yivi app  must end with a slash ('/')"
            );
            return Ok(url.clone());
        }

        ensure!(
            self.url_for_yivi_app == UrlForYiviApp::Autodetect,
            "unknown variant, {:?}",
            self.url_for_yivi_app
        );

        if cfg!(test) {
            warn!("won't autodetect your public IP address during testing");
            return Ok("http://example.com/?autodetection_of_pubhubs_public_ip_address_is_disabled_during_tests__please_set_it_manually_if_really_needed".to_string());
        }

        info!("autodetecting your public ip address (for the yifi app)...");

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
