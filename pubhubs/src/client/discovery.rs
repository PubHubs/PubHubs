use crate::api::{self, ApiResultExt as _, NoPayload};
use crate::servers::{self, Constellation, server::Server as _};

impl crate::client::Client {
    /// Retrieves [`Constellation`] from specified url, waiting for it to be set.
    pub async fn get_constellation(&self, url: &url::Url) -> anyhow::Result<Constellation> {
        crate::misc::task::retry(|| async {
            // Retry calling DiscoveryInfo endpoint while it returns a retryable error or some
            // DiscoveryInfoResp with None constellation until constellation is Some.
            (match self.query::<api::DiscoveryInfo>(url, NoPayload)
                .await
                .retryable()/* <- turns retryable error Err(err) into Ok(None) */?
            {
                Some(inf) => Ok(inf.constellation),
                None => Ok(None),
            }) as anyhow::Result<Option<Constellation>>
        })
        .await?
        .ok_or_else(|| {
            anyhow::anyhow!(
                "timeout waiting for {url} to publish constellation",
                url = url
            )
        })
    }

    /// Retrieves [Constellation] from all servers, and checks they coincide; returns `None` when
    /// there's a disagreement.
    pub async fn try_get_stable_constellation(
        &self,
        phc_url: &url::Url,
    ) -> api::Result<Option<Constellation>> {
        log::debug!("trying to get stable constellation");
        let phc_inf = self.query::<api::DiscoveryInfo>(phc_url, NoPayload).await?;
        if phc_inf.constellation.is_none() {
            log::debug!(
                "{phc}'s constellation not yet set",
                phc = servers::Name::PubhubsCentral
            );
            return Ok(None);
        }
        let constellation = phc_inf.constellation.unwrap();

        let mut js = tokio::task::JoinSet::new();

        macro_rules! get_constellation_from_server {
            ($server:ident) => {
                let server_name = crate::servers::$server::Server::NAME;
                if server_name != servers::Name::PubhubsCentral {
                    let url = constellation.url(server_name);
                    js.spawn_local(
                        self.query::<api::DiscoveryInfo>(url, NoPayload)
                            .into_future(),
                    );
                }
            };
        }

        crate::for_all_servers!(get_constellation_from_server);

        'lp: loop {
            match js.join_next().await {
                None => break 'lp,
                Some(Ok(inf_res)) => {
                    let inf = inf_res?;

                    if inf.constellation.is_none()
                        || inf.constellation.unwrap().id != constellation.id
                    {
                        log::debug!("constellations not yet in sync");
                        return Ok(None);
                    }
                }
                Some(Err(join_err)) => {
                    log::warn!(
                        "unexpected join error getting constellation from server: {join_err}"
                    );
                    return Err(api::ErrorCode::InternalError);
                }
            }
        }

        log::info!("obtained stable constellation");
        Ok(Some(constellation))
    }
}

/// Specifies what to check about  a [api::DiscoveryInfoResp]
pub struct DiscoveryInfoCheck<'a> {
    pub phc_url: &'a url::Url,
    pub name: crate::servers::Name,
    pub self_check_code: Option<&'a str>,
    pub constellation: Option<&'a Constellation>,
}

impl DiscoveryInfoCheck<'_> {
    /// Checks the given [`api::DiscoveryInfoResp`] according to the [`DiscoveryInfoCheck`],
    /// and returns it if all checks out.
    pub fn check(
        self,
        inf: api::DiscoveryInfoResp,
        source: &url::Url,
    ) -> api::Result<api::DiscoveryInfoResp> {
        if inf.name != self.name {
            log::error!(
                "supposed {} at {} returned name {}",
                self.name,
                source,
                inf.name
            );
            return Err(api::ErrorCode::InternalError);
        }

        if &inf.phc_url != self.phc_url {
            log::error!(
                "{} at {} thinks PubHubs Central is at {}",
                self.name,
                source,
                inf.phc_url,
            );
            return Err(api::ErrorCode::InternalError);
        }

        if let Some(scc) = self.self_check_code {
            if inf.self_check_code != scc {
                log::error!(
                    "{} at {} is not me! (Different self_check_code.)",
                    self.name,
                    source,
                );
                return Err(api::ErrorCode::InternalError);
            }
        }

        if inf.master_enc_key_part.is_some()
            != matches!(
                inf.name,
                servers::Name::PubhubsCentral | servers::Name::Transcryptor
            )
        {
            log::error!(
                "master_enc_key_part must be set by the transcryptor and pubhub central, but no other servers - url: {source}"
            );
            return Err(api::ErrorCode::InternalError);
        }

        if inf.constellation.is_some() {
            let c = inf.constellation.as_ref().unwrap();

            if self.constellation.is_some() && c.id != self.constellation.unwrap().id {
                log::error!(
                    "{} at {} has a different view of the constellation of PubHubs servers",
                    inf.name,
                    source,
                );
                return Err(api::ErrorCode::InternalError);
            }
        }

        api::Result::Ok(inf)
    }
}
