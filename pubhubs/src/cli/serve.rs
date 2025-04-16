use crate::cli;
use crate::servers::Config;
use crate::servers::Server as _;

use anyhow::Result;

#[derive(clap::Args, Debug)]
pub struct ServeArgs {
    #[command(flatten)]
    common: cli::CommonArgs,

    /// Run not all servers specified in the configuration file, but only these
    #[arg(value_enum, short, long, value_name = "SERVERS")]
    only: Option<Vec<crate::servers::Name>>,
}

impl ServeArgs {
    pub fn run(self, _spec: &mut clap::Command) -> Result<()> {
        env_logger::init();

        let config = self.adjust_config(self.common.load_config()?)?;

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

                let err_count = set.wait().await;
                if err_count > 0 {
                    anyhow::bail!("{} servers did not shutdown cleanly", err_count);
                }

                Ok(())
            })
    }

    /// Adjust config based on the arguments (`--only`, ...) in `self`.
    fn adjust_config(&self, config: Config) -> Result<Config> {
        Ok(self.apply_only(config))
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
