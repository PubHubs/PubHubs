use std::collections::HashMap;

use anyhow::{Context as _, Result};
use futures::stream::StreamExt as _;

use crate::api;
use crate::attr;
use crate::client;
use crate::handle::Handle;
use crate::misc::jwt;
use crate::servers::Constellation;
use crate::servers::yivi;

use api::phc::user::AuthToken;

#[derive(clap::Args, Debug)]
pub struct EnterArgs {
    /// Enter this pubhubs environment
    #[arg(short, long, value_name = "ENVIRONMENT", default_value = "stable")]
    environment: Environment,

    /// Contact PHC at this url, overriding --environment
    #[arg(short, long, value_name = "PHC_URL")]
    url: Option<url::Url>,

    /// Whether to wait for a pubhubs yivi card
    #[arg(short, long)]
    wait_for_card: bool,

    /// Handle identifying the hub
    #[arg(value_name = "HUB")]
    hub_handle: Option<Handle>,

    /// Use this pubhubs authentication token
    #[arg(short, long, value_name = "AUTH_TOKEN")]
    auth_token: Option<AuthToken>,

    /// Identifying attribute type to use
    #[arg(
        long,
        default_value = "email",
        value_name = "ATTR_TYPE",
        conflicts_with = "auth_token"
    )]
    id_attr_type: Handle,

    /// Add these attributes when entering pubhubs
    #[arg(
        long,
        default_value = "phone",
        value_name = "ATTR_TYPE",
        conflicts_with = "auth_token"
    )]
    add_attr_type: Vec<Handle>,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy)]
enum Environment {
    Stable,
    Main,
    Local,
}

impl EnterArgs {
    pub fn run(self, _spec: &mut clap::Command) -> Result<()> {
        env_logger::init();

        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()?
            .block_on(tokio::task::LocalSet::new().run_until(self.run_async()))
    }

    fn url(&self) -> std::borrow::Cow<'_, url::Url> {
        if let Some(url) = &self.url {
            return std::borrow::Cow::Borrowed(url);
        }

        std::borrow::Cow::Owned(
            match self.environment {
                Environment::Local => "http://localhost:5050",
                Environment::Stable => "https://phc.pubhubs.net",
                Environment::Main => "https://phc-main.pubhubs.net",
            }
            .parse()
            .unwrap(),
        )
    }

    async fn run_async(self) -> Result<()> {
        let client = client::Client::builder().agent(client::Agent::Cli).finish();

        let url = self.url();
        log::info!("contacting pubhubs central at {}", url);

        let Ok(api::phc::user::WelcomeResp {
            constellation,
            hubs,
        }) = client
            .query_with_retry::<api::phc::user::WelcomeEP, _, _>(url.as_ref(), api::NoPayload)
            .await
        else {
            anyhow::bail!("cannot reach pubhubs central at {}", url);
        };

        if let Some(hub_handle) = &self.hub_handle
            && !hubs.contains_key(hub_handle)
        {
            anyhow::bail!(
                "no such hub {}; choose from: {}",
                hub_handle,
                hubs.keys()
                    .map(Handle::as_str)
                    .collect::<Vec<&str>>()
                    .join(", ")
            )
        }

        let api::auths::WelcomeResp { attr_types } = client
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

        let auth_token = match self.auth_token {
            Some(auth_token) => auth_token,
            None => {
                let auth_token = self
                    .get_auth_token(&client, &constellation, &attr_types)
                    .await?;
                println!("global auth token: {auth_token}");
                auth_token
            }
        };

        let Some(hub_handle) = self.hub_handle else {
            return Ok(());
        };

        let Some(hub_info) = hubs.get(&hub_handle) else {
            panic!("did we not already check we have details on this hub?!");
        };

        let api::hub::EnterStartResp {
            state: hub_state,
            nonce: hub_nonce,
        } = client
            .query_with_retry::<api::hub::EnterStartEP, _, _>(&hub_info.url, api::NoPayload)
            .await
            .with_context(|| format!("cannot reach hub at {}", hub_info.url))?;

        let ppp_resp = client
            .query::<api::phc::user::PppEP>(&constellation.phc_url, api::NoPayload)
            .auth_header(auth_token.clone())
            .with_retry()
            .await
            .context("failed to obtain ppp from phc")?;

        let api::phc::user::PppResp::Success(ppp) = ppp_resp else {
            anyhow::bail!("failed to obtain ppp from phc: {ppp_resp:?}");
        };

        let ehpp_resp = client
            .query::<api::tr::EhppEP>(
                &constellation.transcryptor_url,
                api::tr::EhppReq {
                    hub_nonce,
                    hub: hub_info.id,
                    ppp,
                },
            )
            .with_retry()
            .await
            .context("failed to obtain ehpp from transcryptor")?;

        let api::tr::EhppResp::Success(ehpp) = ehpp_resp else {
            anyhow::bail!("failed to obtain ehpp from transcryptor: {ehpp_resp:?}");
        };

        let hhpp_resp = client
            .query::<api::phc::user::HhppEP>(
                &constellation.phc_url,
                api::phc::user::HhppReq { ehpp },
            )
            .auth_header(auth_token.clone())
            .with_retry()
            .await
            .context("failed to obtain hhpp from phc")?;

        let api::phc::user::HhppResp::Success(hhpp) = hhpp_resp else {
            anyhow::bail!("failed to obtain hhpp from phc: {hhpp_resp:?}");
        };

        let enter_complete_resp = client
            .query::<api::hub::EnterCompleteEP>(
                &hub_info.url,
                api::hub::EnterCompleteReq {
                    state: hub_state,
                    hhpp,
                },
            )
            .with_retry()
            .await
            .context("failed to complete entering hub")?;

        let api::hub::EnterCompleteResp::Entered {
            access_token: hub_access_token,
            device_id,
            new_user,
            mxid,
        } = enter_complete_resp
        else {
            anyhow::bail!("failed to complete entering hub: {enter_complete_resp:?}");
        };

        println!("access token: {hub_access_token}");
        println!("mxid:         {mxid}");
        println!("device id:    {device_id}");
        println!("first time?:  {new_user}");

        Ok(())
    }

    /// Enter pubhubs using a QR code on the command line; returns an auth token.
    async fn get_auth_token(
        &self,
        client: &client::Client,
        constellation: &Constellation,
        attr_types: &HashMap<Handle, attr::Type>,
    ) -> Result<AuthToken> {
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

        let mut add_attrs_info =
            HashMap::<Handle, attr::Type>::with_capacity(self.add_attr_type.len());

        for attr_type in self.add_attr_type.iter() {
            let Some(attr_info) = attr_types.get(attr_type) else {
                anyhow::bail!(
                    "no such attribute type {attr_type}; choose from: {}",
                    attr_types
                        .keys()
                        .map(Handle::as_str)
                        .collect::<Vec<&str>>()
                        .join(", ")
                )
            };

            anyhow::ensure!(
                add_attrs_info
                    .insert(attr_type.clone(), attr_info.clone())
                    .is_none(),
                "duplicate attribute type {attr_type}"
            );
        }

        let auth_start_resp = client
            .query_with_retry::<api::auths::AuthStartEP, _, _>(
                &constellation.auths_url,
                api::auths::AuthStartReq {
                    source: attr::Source::Yivi,
                    yivi_chained_session: self.wait_for_card,
                    attr_types: self
                        .add_attr_type
                        .iter()
                        .chain(std::iter::once(&self.id_attr_type))
                        .map(Clone::clone)
                        .collect(),
                },
            )
            .await
            .context("failed to start authentication")?;

        let api::auths::AuthStartResp::Success {
            task: auth_task,
            state: auth_state,
        } = auth_start_resp
        else {
            anyhow::bail!("failed to start authentication: AS returned {auth_start_resp:?}");
        };

        let api::auths::AuthTask::Yivi {
            disclosure_request,
            yivi_requestor_url,
        } = auth_task;

        let disclosure = yivi_cli_session(&yivi_requestor_url, disclosure_request)
            .await
            .with_context(|| format!("Yivi disclosure to {yivi_requestor_url} failed"))?;

        let auth_complete_resp = client
            .query_with_retry::<api::auths::AuthCompleteEP, _, _>(
                &constellation.auths_url,
                api::auths::AuthCompleteReq {
                    proof: api::auths::AuthProof::Yivi { disclosure },
                    state: auth_state,
                },
            )
            .await
            .context("failed to complete authentication")?;

        let api::auths::AuthCompleteResp::Success { mut attrs } = auth_complete_resp else {
            anyhow::bail!("failed to complete authentication: AS returned {auth_complete_resp:?}");
        };

        let Some(identifying_attr) = attrs.remove(&self.id_attr_type) else {
            anyhow::bail!("did not receive identifying attribute from authentication server");
        };

        let enter_resp = client
            .query_with_retry::<api::phc::user::EnterEP, _, _>(
                &constellation.phc_url,
                api::phc::user::EnterReq {
                    identifying_attr,
                    mode: api::phc::user::EnterMode::LoginOrRegister,
                    add_attrs: attrs.values().map(Clone::clone).collect(),
                },
            )
            .await
            .context("failed to enter pubhubs")?;

        let api::phc::user::EnterResp::Entered {
            auth_token_package: Ok(api::phc::user::AuthTokenPackage { auth_token, .. }),
            new_account: _new_account,
            attr_status,
        } = enter_resp
        else {
            anyhow::bail!("failed to enter pubhubs: phc returned {enter_resp:?}");
        };

        for (attr, attr_status) in attr_status.iter() {
            if *attr_status == api::phc::user::AttrAddStatus::PleaseTryAgain {
                log::warn!("adding attribute {} failed", attr.value);
            }
        }

        Ok(auth_token)
    }
}

/// Starts a yivi session with `yivi_requestor_url`, printing the QR code to the command line.
async fn yivi_cli_session(yivi_requestor_url: &url::Url, request: jwt::JWT) -> Result<jwt::JWT> {
    let client = awc::Client::default();

    let mut resp = client
        .post(yivi_requestor_url.join("/session")?.as_str())
        .insert_header(("Content-Type", "text/plain"))
        .send_body(request.as_str().to_string())
        .await
        .map_err(|err| anyhow::anyhow!("failed to start Yivi session: {err}"))?;

    let YiviSessionPackage {
        session_ptr: session_ptr_json,
        token: requestor_token,
        frontend_request: FrontendSessionRequest { authorization, .. },
    } = resp.json().await?;

    let SessionPtr {
        url: mut frontend_url,
        ..
    } = serde_json::from_value(session_ptr_json.clone())
        .with_context(|| "failed to parse session pointer returned by yivi server")?;

    // make sure frontend_url ends with a '/' so Url::join works as expected
    if !frontend_url.path().ends_with("/") {
        frontend_url.set_path(format!("{}/", frontend_url.path()).as_str());
    }

    log::debug!("requestor token: {requestor_token}; frontend_url: {frontend_url}");

    println!();
    println!("Please scan the following QR code using your Yivi app.");

    let qr = qrcode::QrCode::new(session_ptr_json.to_string().as_bytes())?;

    let qr_render = qr
        .render()
        .light_color(qrcode::render::unicode::Dense1x2::Light)
        .dark_color(qrcode::render::unicode::Dense1x2::Dark)
        .build();
    print!("{qr_render}\n\n");

    let statusevents_url = frontend_url.join("frontend/statusevents")?;
    //yivi_requestor_url
    //    .join(&format!("/session/{requestor_token}/statusevents"))?
    //    .as_str(),

    log::debug!("{}", statusevents_url);

    let mut statusevents = client
        .get(statusevents_url.as_str())
        .insert_header(("Authorization", authorization))
        .send()
        .await
        .map_err(|err| anyhow::anyhow!("failed to listen to statusevents: {err}"))?;

    loop {
        let data: bytes::Bytes = statusevents
            .next()
            .await
            .ok_or_else(|| anyhow::anyhow!("status events aborted early"))??;

        log::debug!(
            "received status event: {}",
            crate::misc::fmt_ext::Bytes(&data)
        );

        let Some(data) = data.strip_prefix(b"data:") else {
            continue;
        };

        let FrontendSessionStatus { status, .. } = serde_json::from_slice(data)?;

        match status {
            yivi::Status::Done => break,
            yivi::Status::Pairing | yivi::Status::Connected | yivi::Status::Initialized => continue,
            yivi::Status::Cancelled => anyhow::bail!("yivi session was cancelled"),
            yivi::Status::Timeout => anyhow::bail!("yivi session timed out"),
        }
    }

    let mut resp = client
        .get(
            yivi_requestor_url
                .join(&format!("/session/{requestor_token}/result-jwt"))?
                .as_str(),
        )
        .send()
        .await
        .map_err(|err| anyhow::anyhow!("failed to retrieve session result: {err}"))?;

    Ok(std::str::from_utf8(&resp.body().await?)?.to_string().into())
}

/// Represents a [yivi session package](https://github.com/privacybydesign/irmago/blob/f9718c334af76a3ad2fa23019d17957878cd2032/server/api.go#L30).
#[derive(serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct YiviSessionPackage {
    session_ptr: serde_json::Value,

    /// Requestor token
    token: String,

    frontend_request: FrontendSessionRequest,
}

#[derive(serde::Deserialize, Debug, Clone)]
struct SessionPtr {
    #[serde(rename = "u")]
    url: url::Url,

    #[serde(rename = "irmaqr")]
    #[expect(dead_code)]
    session_type: yivi::SessionType,
}

// https://github.com/privacybydesign/irmago/blob/773a229329a063043831a4c21e72b139b9600f4b/requests.go#L235
#[derive(serde::Deserialize, Debug, Clone)]
struct FrontendSessionRequest {
    authorization: String,
    // some fields omitted
}

/// <https://github.com/privacybydesign/irmago/blob/773a229329a063043831a4c21e72b139b9600f4b/messages.go#L571>
#[derive(serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct FrontendSessionStatus {
    status: yivi::Status,
    #[expect(dead_code)]
    next_session: Option<serde_json::Value>,
}
