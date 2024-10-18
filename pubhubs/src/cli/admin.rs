use anyhow::Result;

use crate::api;
use crate::cli;
use crate::client;
use crate::servers::{self, Config};

#[derive(clap::Args, Debug)]
pub struct AdminArgs {
    #[command(flatten)]
    common: cli::CommonArgs,

    #[arg(value_name = "SERVER")]
    server: servers::Name,

    /// Admin secret key, hex encoded.
    #[arg(value_name = "ADMIN_KEY")]
    admin_key: api::SigningKey,

    #[command(subcommand)]
    command: Commands,
}

impl AdminArgs {
    pub fn run(self, _spec: &mut clap::Command) -> Result<()> {
        env_logger::init();
        let config = self.common.load_config()?;

        match self.command {
            Commands::Config(args) => args.run(AdminContext {
                config,
                server: self.server,
                admin_key: self.admin_key,
            }),
        }
    }
}

struct AdminContext {
    config: Config,
    server: servers::Name,
    admin_key: api::SigningKey,
}

#[derive(clap::Subcommand, Debug)]
enum Commands {
    /// Get or temporarily change the configuration of one of the servers
    Config(ConfigArgs),
}

#[derive(clap::Args, Debug)]
pub struct ConfigArgs {}

impl ConfigArgs {
    fn run(self, ctx: AdminContext) -> Result<()> {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()?
            .block_on(tokio::task::LocalSet::new().run_until(self.run_async(ctx)))
    }

    async fn run_async(self, ctx: AdminContext) -> Result<()> {
        let url = self.get_url(&ctx).await?;

        let resp = api::query_with_retry::<api::admin::Info>(
            &url,
            &api::Signed::<api::admin::InfoReq>::new(
                &*ctx.admin_key,
                &api::admin::InfoReq {},
                std::time::Duration::from_secs(10),
            )
            .unwrap(),
        )
        .await
        .into_std()?;

        let mut stdout = std::io::stdout().lock();

        serde_json::to_writer_pretty(stdout, &resp.config)?;

        Ok(())
    }

    async fn get_url(&self, ctx: &AdminContext) -> Result<url::Url> {
        if ctx.server == servers::Name::PubhubsCentral {
            return Ok(ctx.config.phc_url.clone());
        }

        log::info!(
            "retrieving constellation from {phc_url} to get url of {server_name}",
            phc_url = ctx.config.phc_url,
            server_name = ctx.server
        );

        let constellation = client::get_constellation(&ctx.config.phc_url).await?;

        Ok(constellation.url(ctx.server).clone())
    }
}
