use anyhow::{Context as _, Result};

use crate::api;
use crate::client;
use crate::handle::Handle;

#[derive(clap::Args, Debug)]
pub struct EnterArgs {
    /// URL to pubhubs central
    #[arg(
        short,
        long,
        value_name = "PHC_URL",
        default_value = "https://phc-main.pubhubs.net" // TODO: change to phc.pubhubs.net
    )]
    url: url::Url,

    /// Handle identifying the hub
    #[arg(value_name = "HUB")]
    hub_handle: Handle,

    /// Handle of identifying attribute type to use
    #[arg(short, long, default_value = "email", value_name = "ATTR_TYPE")]
    id_attr_type: Handle,

    /// Handles of attribute types to add when entering pubhubs
    #[arg(short, long, default_value = "phone", value_name = "ATTR_TYPE")]
    add_attr_type: Vec<Handle>,
}

impl EnterArgs {
    pub fn run(self, _spec: &mut clap::Command) -> Result<()> {
        env_logger::init();

        let context = EnterContext {
            client: client::Client::builder().agent(client::Agent::Cli).finish(),
        };

        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()?
            .block_on(tokio::task::LocalSet::new().run_until(self.run_async(context)))
    }

    async fn run_async(self, context: EnterContext) -> Result<()> {
        let Ok(api::phc::user::WelcomeResp {
            constellation,
            hubs,
        }) = context
            .client
            .query_with_retry::<api::phc::user::WelcomeEP, _, _>(&self.url, api::NoPayload)
            .await
        else {
            anyhow::bail!("cannot reach pubhubs central at {}", self.url);
        };

        let Some(hub_info) = hubs.get(&self.hub_handle) else {
            anyhow::bail!(
                "no such hub {}; choose from: {}",
                self.hub_handle,
                hubs.keys()
                    .map(Handle::as_str)
                    .collect::<Vec<&str>>()
                    .join(", ")
            )
        };

        let api::hub::EnterStartResp {
            state: _hub_state,
            nonce: _hub_nonce,
        } = context
            .client
            .query_with_retry::<api::hub::EnterStartEP, _, _>(&hub_info.url, api::NoPayload)
            .await
            .with_context(|| format!("cannot reach hub at {}", hub_info.url))?;

        let api::auths::WelcomeResp { attr_types } = context
            .client
            .query_with_retry::<api::auths::WelcomeEP, _, _>(
                &constellation.auths_url,
                api::NoPayload,
            )
            .await
            .with_context(|| {
                format!(
                    "cannot reach authentication server at {}",
                    constellation.auths_url
                )
            })?;

        let Some(_id_attr_info) = attr_types.get(&self.id_attr_type) else {
            anyhow::bail!(
                "no such attribute type {}; choose from: {}",
                self.id_attr_type,
                attr_types
                    .keys()
                    .map(Handle::as_str)
                    .collect::<Vec<&str>>()
                    .join(", ")
            )
        };

        Ok(())
    }
}

struct EnterContext {
    client: client::Client,
}
