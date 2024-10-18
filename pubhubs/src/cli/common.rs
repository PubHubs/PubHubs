use crate::servers::Config;

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
        default_values = ["pubhubs.yaml", "pubhubs.default.yaml"]
    )]
    config_search_paths: Vec<std::path::PathBuf>,
}

impl CommonArgs {
    pub fn load_config(&self) -> anyhow::Result<Config> {
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
