use anyhow::{Context as _, Result};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use url::Url;

/// One, or several, of the PubHubs servers
#[derive(serde::Deserialize, Debug)]
pub struct Config {
    /// URL of the PubHubs Central server.
    ///
    /// Any information on the other servers that can be stored at PHC is stored at PHC.
    phc_url: Url,

    /// Path with respect to which relative paths are interpretted.
    #[serde(default)]
    wd: PathBuf,

    phc: Option<phc::Config>,
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
            "loaded config file from {};  interpretting relative paths relative to {}",
            path.display(),
            res.wd.display()
        );

        Ok(Some(res))
    }
}

pub mod phc {
    use super::*;

    #[derive(serde::Deserialize, Debug)]
    pub struct Config {
        bind_to: SocketAddr,
    }
}
