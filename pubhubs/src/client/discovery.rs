use crate::api;
use crate::misc::fmt_ext;
use crate::servers::{self, Constellation};

use anyhow::ensure;

/// Drives the discovery process of the pubhubs servers until all servers are up and running
/// or an error is encountered.  Returns the resulting [Constellation].
///
/// Must be run from within a [tokio::task::LocalSet].
pub async fn drive_discovery(phc_url: &url::Url) -> anyhow::Result<Constellation> {
    let now = std::time::Instant::now();

    let phc_inf = drive_discovery_of(phc_url).await?;

    ensure!(
        phc_inf.constellation.is_some(),
        "PHC returned empty constellation"
    );

    let c = phc_inf.constellation.as_ref().unwrap();

    let other_servers = [
        servers::Name::Transcryptor,
        servers::Name::AuthenticationServer,
    ];

    let infs = futures_util::future::try_join_all(
        other_servers
            .iter()
            .map(|name: &servers::Name| drive_discovery_of(c.url(*name))),
    )
    .await?;

    for i in 0..other_servers.len() {
        let name = other_servers[i];
        let inf = &infs[i];

        ensure!(
            inf.constellation == phc_inf.constellation,
            "{name} has a different view of the PubHubs servers constellation"
        );
    }

    log::info!(
        "discovery of all servers completed in {:.1} seconds",
        now.elapsed().as_secs_f32()
    );

    Ok(phc_inf.constellation.unwrap())
}

/// Drive discovery of the server at the given url, returns the
/// [api::DiscoveryInfoResp] returned by the server when discovery has been completed.
async fn drive_discovery_of(url: &url::Url) -> anyhow::Result<api::DiscoveryInfoResp> {
    let inf = {
        let res = api::query::<api::DiscoveryInfo>(url, &()).await;
        ensure!(
            res.is_ok(),
            "could not get discovery info from {}: {}",
            url,
            fmt_ext::Json(res)
        );
        res.unwrap()
    };

    if inf.constellation.is_some() {
        return Ok(inf);
    }

    let res = api::query_with_retry::<api::DiscoveryRun>(url, &()).await;
    ensure!(
        res.is_ok(),
        "running discovery of {} at {} failed: {}",
        inf.name,
        url,
        fmt_ext::Json(res.unwrap_err())
    );

    crate::misc::task::retry(|| async {
        let res = api::query::<api::DiscoveryInfo>(url, &()).await.retryable();

        // retry if query returned a retryable error,
        // or if PHC's state is still Discovery
        match res.as_ref() {
            Ok(Some(inf)) => {
                if inf.constellation.is_none() {
                    Ok(None)
                } else {
                    res
                }
            }
            _ => res,
        }
    })
    .await?
    .ok_or_else(|| anyhow::anyhow!("timeout waiting for {} to leave discovery state", inf.name))
}

/// Retrieves [Constellation] from PHC, waiting for it to be set.
pub async fn get_constellation(url: &url::Url) -> anyhow::Result<Constellation> {
    crate::misc::task::retry(|| async {
        // Retry calling DiscoveryInfo endpoint while it returns a retryable error or some
        // DiscoveryInfoResp with None constellation until constellation is Some.
        (match api::query::<api::DiscoveryInfo>(url, &())
            .await
            .retryable()/* <- turns retryable error Err(err) into Ok(None) */?
        {
            Some(inf) => Ok(inf.constellation),
            None => Ok(None),
        }) as anyhow::Result<Option<Constellation>>
    })
    .await?
    .ok_or_else(|| anyhow::anyhow!("timeout waiting for PHC to publish constellation"))
}

/// Specifies what to check about  a [api::DiscoveryInfoResp]
pub struct DiscoveryInfoCheck<'a> {
    pub phc_url: &'a url::Url,
    pub name: crate::servers::Name,
    pub self_check_code: Option<&'a str>,
    pub constellation: Option<&'a Constellation>,
}

impl<'a> DiscoveryInfoCheck<'a> {
    /// Checks the given [api::DiscoveryInfoResp] according to the [DiscoveryInfoCheck],
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
            return api::err(api::ErrorCode::Malconfigured);
        }

        if &inf.phc_url != self.phc_url {
            log::error!(
                "{} at {} thinks PubHubs Central is at {}",
                self.name,
                source,
                inf.phc_url,
            );
            return api::err(api::ErrorCode::Malconfigured);
        }

        if let Some(scc) = self.self_check_code {
            if inf.self_check_code != scc {
                log::error!(
                    "{} at {} is not me! (Different self_check_code.)",
                    self.name,
                    source,
                );
                return api::err(api::ErrorCode::Malconfigured);
            }
        }

        if inf.master_enc_key_part.is_some()
            != matches!(
                inf.name,
                servers::Name::PubhubsCentral | servers::Name::Transcryptor
            )
        {
            log::error!("master_enc_key_part must be set by the transcryptor and pubhub central, but no other servers - url: {}", source);
            return api::err(api::ErrorCode::InternalError);
        }

        if inf.constellation.is_some() {
            let c = inf.constellation.as_ref().unwrap();

            if self.constellation.is_some() && c != self.constellation.unwrap() {
                log::error!(
                    "{} at {} has a different view of the constellation of PubHubs servers",
                    inf.name,
                    source,
                );
                return api::err(api::ErrorCode::Malconfigured);
            }
        }

        api::Result::Ok(inf)
    }
}
