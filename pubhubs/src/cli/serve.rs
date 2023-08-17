use crate::servers::Config;
use anyhow::Result;

#[derive(clap::Args, Debug)]
pub struct ServeArgs {
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

impl ServeArgs {
    pub fn run(self) -> Result<()> {
        env_logger::init();

        let config: Config = 'find_config: {
            for pb in &self.config_search_paths {
                if let Some(config) = Config::load_from_path(pb)? {
                    break 'find_config config;
                }

                log::info!("no config file at {}", pb.display());
            }

            anyhow::bail!(
                "no config file found at any of these paths: {}",
                self.config_search_paths
                    .iter()
                    .map(|pb| pb.to_string_lossy().into_owned())
                    .collect::<Vec<String>>()
                    .join(", ")
            );
        };

        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()?
            .block_on(crate::servers::run(config))
    }
}
