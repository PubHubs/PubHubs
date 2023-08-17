use anyhow::Result;

/// Runs the PubHubs server(s) from the given configuration.
///
/// Returns if one of the servers crashes.
pub async fn run(config: crate::servers::Config) -> Result<()> {
    let mut joinset = tokio::task::JoinSet::<Result<()>>::new();

    if config.phc.is_some() {
        joinset.spawn(crate::servers::Runner::<crate::servers::phc::Server>::new(
            &config,
        )?);
    }

    // Wait for one of the servers to return, panic or be cancelled.
    // By returning, joinset is dropped and all server tasks are aborted.
    joinset.join_next().await.expect("no servers to wait on")?
}
