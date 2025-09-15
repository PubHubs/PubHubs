use anyhow::{Context, Result};
use std::sync::Arc;

use rand::distr::SampleString as _;

use crate::{config, context};

pub struct Main {
    pub url: Urls,
    pub bind_to: (Vec<String>, u16),
    pub connection_check_nonce: String,
    pub static_files_conf: config::StaticFiles,
}

#[derive(Clone)]
pub struct Urls {
    /// Where can the browser reach PubHubs Central?
    ///   e.g. http://localhost:8080/
    pub for_browser: url::Url,
    /// Where can a hub (possibly from within a docker container) reach PubHubs Central?
    ///   e.g. <http://host.docker.internal:8080/>
    pub for_hub: url::Url,
    /// Where can the Yivi App (possibly from another network) reach PubHubs Central?
    ///   e.g. http://1.2.3.4:8080/
    pub for_yivi_app: url::Url,
}

impl Main {
    pub async fn create(config: crate::config::File) -> Result<Arc<Self>> {
        let _path_interpreter = config.path_interpreter();

        let url: Urls = config
            .determine_urls()
            .context("determining URL for PubHubs Central failed")?;

        let connection_check_nonce = config
            .connection_check_nonce
            .unwrap_or_else(|| rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 16));

        Ok(Arc::new_cyclic(|_wp: &std::sync::Weak<context::Main>| {
            Self {
                url,
                bind_to: config.bind_to,
                connection_check_nonce,
                static_files_conf: config.static_files,
            }
        }))
    }

    pub fn global_client_uri(&self) -> &str {
        "/client"
    }
}
