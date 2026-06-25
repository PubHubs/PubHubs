use crate::servers::Config;

/// A PubHubs deployment a client command (`enter`, `stress`, ...) can contact.
#[derive(clap::ValueEnum, Debug, Clone, Copy)]
pub(crate) enum Environment {
    Stable,
    Main,
    Local,
}

/// The PHC url to contact: the explicit `--url` override if given, otherwise `environment`'s default.
pub(crate) fn phc_url(
    environment: Environment,
    url_override: &Option<url::Url>,
) -> std::borrow::Cow<'_, url::Url> {
    if let Some(url) = url_override {
        return std::borrow::Cow::Borrowed(url);
    }

    std::borrow::Cow::Owned(
        match environment {
            Environment::Local => "http://localhost:5050",
            Environment::Stable => "https://phc.pubhubs.net",
            Environment::Main => "https://phc-main.pubhubs.net",
        }
        .parse()
        .expect("hard-coded environment url should parse"),
    )
}

/// Arguments shared between `admin` and `serve` commands.
#[derive(clap::Args, Debug)]
pub(crate) struct CommonArgs {
    /// Look for a configuration file at these locations.  If no configuration file is found at the
    /// first location, the second one is consulted, and so on.  
    #[arg(
        name = "config",
        short,
        long,
        value_name = "PATHS",
        default_values = ["pubhubs.toml", "pubhubs.default.toml"]
    )]
    config_search_paths: Vec<std::path::PathBuf>,
}

impl CommonArgs {
    pub fn load_config(&self) -> anyhow::Result<Config> {
        let config = self.load_config_inner()?;

        match config.log.as_ref() {
            Some(c) => std::borrow::Cow::Borrowed(c),
            None => std::borrow::Cow::Owned(Default::default()),
        }
        .try_init_env_logger();

        Ok(config)
    }

    fn load_config_inner(&self) -> anyhow::Result<Config> {
        for pb in &self.config_search_paths {
            if let Some(config) = Config::load_from_path(pb)? {
                return Ok(config);
            }

            log::info!("no configuration file at {}", pb.display());
        }

        anyhow::bail!(
            "no config file found at any of these paths: {}",
            self.config_search_paths
                .iter()
                .map(|pb| pb.to_string_lossy().into_owned())
                .collect::<Vec<String>>()
                .join(", ")
        );
    }
}
