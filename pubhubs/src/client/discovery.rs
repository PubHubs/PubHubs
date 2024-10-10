use crate::api;
use crate::servers::{self, Constellation};

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
