use std::path::PathBuf;
use std::str::FromStr;

use anyhow::{Context as _, Result, anyhow, bail, ensure};
use log::{info, warn};
use serde::{Deserialize, Serialize};

use crate::misc::net_ext;

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

    /// Bind to thses addresses.  Defaults to (("::", "0.0.0.0"), "8080").
    #[serde(default = "default_bind_to")]
    pub bind_to: (Vec<String>, u16),

    /// When pubhubs checks it can connect to itself, this value is expected.
    /// When None, it is randomly generated.  Set it to some none-None value
    /// when pubhubs is behind a load balancer.
    #[serde(default)]
    pub connection_check_nonce: Option<String>,

    #[serde(default = "default_assets_directory")]
    pub assets_directory: String,

    #[serde(default)]
    pub static_files: StaticFiles,
}

// for a hotfix to #459
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct StaticFiles {
    pub dont_use_etag: bool,
    pub use_last_modified: bool,
    pub dont_prefer_utf8: bool,
    pub disable_content_disposition: bool,
}

fn default_bind_to() -> (Vec<String>, u16) {
    (vec!["::".to_string(), "0.0.0.0".to_string()], 8080)
}
fn default_assets_directory() -> String {
    "static/assets".to_string()
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
                _ => return Err(e).with_context(|| format!("loading {path:?}")),
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
                });
            }
            Err(std::env::VarError::NotPresent) => { /* break */ }
            Err(e) => {
                return Err(e)
                    .with_context(|| format!("could not read environmental variable {ENV:?}"));
            }
        }

        info!(
            "Environmental variable {ENV:?} not set, searching for configuration at one of the default locations: {DEFAULT_PATHS:?} ...",
        );

        for p in DEFAULT_PATHS {
            if let Some(conf) = Self::from_path(p).with_context(|| format!("loading {p:?}"))? {
                info!("loaded configuration from {p}");
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
    pub fn path_interpreter(&self) -> impl Fn(&str) -> PathBuf + use<> {
        let parent_copy: PathBuf = self.path.parent().unwrap().to_path_buf();
        move |path: &str| parent_copy.join(path)
    }
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

    /// Autodetect local network ip address
    /// and use that one with the port from `bind_to`.
    ///
    /// Warning:  you might be behind a NAT or firewall
    Autodetect,
}

impl File {
    pub fn determine_urls(&self) -> Result<crate::context::Urls> {
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

        let autodetected = urls.autodetect(self)?;

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
    fn autodetect(&self, file: &File) -> Result<Option<url::Url>> {
        if self.for_hub != AltUrl::Autodetect && self.for_yivi_app != AltUrl::Autodetect {
            return Ok(None);
        }

        ensure!(
            !cfg!(test),
            "autodetection of ip address not permitted during tests!"
        );

        // the awc crate has no multi-thread support, see
        //   https://github.com/actix/actix-web/issues/2679#issuecomment-1059141565
        // so we execute awc on a single thread..

        let ipa: core::net::IpAddr = net_ext::source_ip()?;

        info!("your ip address is {ipa}");

        let mut url: url::Url = "http://example.com".parse().unwrap();

        url.set_ip_host(ipa)
            .map_err(|_: ()| anyhow!("failed to put ip address in URL"))?;
        url.set_port(Some(file.bind_to.1))
            .map_err(|_: ()| anyhow!("failed to put port in URL"))?;

        Ok(Some(url))
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
            AltUrl::Manual(url) => {
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
            warn!("using default {name}");
            Some(default.into())
        } else {
            None
        }
    })
    .ok_or_else(|| anyhow!("{} must be manually set in production", name))
}
