use crate::servers::Config;
use crate::servers::Server as _;

use anyhow::{Context as _, Result};

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

    /// Do not immediately start driving the discovery process
    #[arg(long)]
    manual_discovery: bool,

    /// Run not all servers specified in the configuration file, but only these
    #[arg(name = "only", value_enum, short, long, value_name = "SERVERS")]
    only: Option<Vec<crate::servers::Name>>,
}

impl ServeArgs {
    pub fn run(self, _spec: &mut clap::Command) -> Result<()> {
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

        let config = self.apply_only(config);

        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()?
            .block_on(async {
                let (set, shutdown_sender) = crate::servers::Set::new(&config)?;

                tokio::spawn(async move {
                    tokio::signal::ctrl_c()
                        .await
                        .expect("failed to await ctrl+c");
                    log::info!("ctrl+c received; shutting down server(s)");
                    drop(shutdown_sender);
                    tokio::signal::ctrl_c()
                        .await
                        .expect("failed to await ctrl+c");
                    log::warn!("second ctrl+c received; aborting process...");
                    std::process::abort();
                });

                self.drive_discovery(&config.phc_url).await?;

                let err_count = set.wait().await;
                if err_count > 0 {
                    anyhow::bail!("{} servers did not shutdown cleanly", err_count);
                }

                Ok(())
            })
    }

    async fn drive_discovery(&self, phc_url: &url::Url) -> Result<()> {
        if self.manual_discovery {
            return Ok(());
        }

        tokio::task::LocalSet::new()
            .run_until(crate::client::drive_discovery(phc_url))
            .await
            .context("discovery failed")?;

        Ok(())
    }

    /// Filters servers from config that were not specified to run
    fn apply_only(&self, mut config: Config) -> Config {
        if self.only.is_none() {
            // if no --only was specified, run all servers
            return config;
        }

        let only: std::collections::HashSet<&crate::servers::Name> =
            self.only.as_ref().unwrap().iter().collect();

        macro_rules! remove_server_if_needed {
            ($server:ident) => {
                if !only.contains(&crate::servers::$server::Server::NAME) {
                    config.$server = None;
                }
            };
        }

        crate::servers::for_all_servers!(remove_server_if_needed);

        config
    }
}
