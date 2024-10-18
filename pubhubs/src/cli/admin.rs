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
    /// Retrieves the current configuration,
    /// or change it, using the `update` subcommand.
    Config(ConfigArgs),
}

#[derive(clap::Args, Debug)]
pub struct ConfigArgs {
    #[command(subcommand)]
    command: Option<ConfigCommands>,
}

impl ConfigArgs {
    fn run(self, ctx: AdminContext) -> Result<()> {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()?
            .block_on(tokio::task::LocalSet::new().run_until(self.run_async(ctx)))
    }

    async fn run_async(self, ctx: AdminContext) -> Result<()> {
        let url = self.get_url(&ctx).await?;

        self.command.unwrap_or_default().run(url, ctx).await
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

#[derive(clap::Subcommand, Debug)]
enum ConfigCommands {
    /// Retrieves the current config used by the server. [default]
    Get(ConfigGetArgs),

    /// Temporarily updates part of the server configuration.
    ///
    /// The changes are made in-memory, not on disk, and thus only persist across 'soft' server
    /// restarts (where the `pubhubs serve` process does not actually restart) such as the ones
    /// caused by discovery.
    Update(ConfigUpdateArgs),
}

impl ConfigCommands {
    async fn run(self, url: url::Url, ctx: AdminContext) -> Result<()> {
        match self {
            ConfigCommands::Get(args) => args.run(url, ctx).await,
            ConfigCommands::Update(args) => args.run(url, ctx).await,
        }
    }
}

impl Default for ConfigCommands {
    fn default() -> Self {
        ConfigCommands::Get(ConfigGetArgs::default())
    }
}

#[derive(clap::Args, Debug)]
pub struct ConfigUpdateArgs {
    /// Points to the part of the configuratio to change, e.g. '/phc/enc_key'.
    #[arg(value_name = "POINTER")]
    pub pointer: String,

    /// The new JSON value to insert at `pointer`. FIXME: always parsed as JSON string
    #[arg(value_name = "NEW_VALUE")]
    pub new_value: serde_json::Value,
}

impl ConfigUpdateArgs {
    async fn run(self, url: url::Url, ctx: AdminContext) -> Result<()> {
        api::query_with_retry::<api::admin::UpdateConfig>(
            &url,
            &api::Signed::<api::admin::UpdateConfigReq>::new(
                &*ctx.admin_key,
                &api::admin::UpdateConfigReq {
                    pointer: self.pointer,
                    new_value: self.new_value,
                },
                std::time::Duration::from_secs(10),
            )
            .into_std()?,
        )
        .await
        .into_std()?;

        Ok(())
    }
}

#[derive(clap::Args, Debug, Default)]
pub struct ConfigGetArgs {}

impl ConfigGetArgs {
    async fn run(self, url: url::Url, ctx: AdminContext) -> Result<()> {
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

        let stdout = std::io::stdout().lock();

        serde_json::to_writer_pretty(stdout, &resp.config)?;

        Ok(())
    }
}
