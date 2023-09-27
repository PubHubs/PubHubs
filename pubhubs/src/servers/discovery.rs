use crate::api;
use anyhow::ensure;

/// Drives the discovery process of the pubhubs servers until all servers are up and running
/// or an error is encountered.
pub async fn drive_discovery(phc_url: &url::Url) -> anyhow::Result<()> {
    let phi = {
        let res = api::query::<api::DiscoveryInfo>(phc_url, &()).await;
        ensure!(
            res.is_ok(),
            "could not get info from PHC: {}",
            crate::fmt_ext::Json(res)
        );
        res.unwrap()
    };

    if phi.state == api::ServerState::Discovery {
        // TODO: discovery of PHC

        let res = api::query_with_retry::<api::DiscoveryRun>(phc_url, &()).await;
    }

    ensure!(
        phi.constellation.is_some(),
        "PHC returned empty constellation"
    );

    Ok(())
}
