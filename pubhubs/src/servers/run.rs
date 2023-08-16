use anyhow::Result;

/// Runs the PubHubs server(s) from the given configuration.
///
/// Returns if one of the servers crashes.
pub async fn run(config: crate::servers::Config) -> Result<()> {
    let mut joinset = tokio::task::JoinSet::<Result<()>>::new();

    joinset.spawn(async {
        tokio::time::sleep(core::time::Duration::from_millis(12310)).await;
        anyhow::bail!("some err");
    });

    joinset.spawn(async {
        tokio::time::sleep(core::time::Duration::from_millis(1231)).await;
        anyhow::bail!("some other err");
    });

    // Wait for one of the servers to return, panic or be cancelled.
    // By returning, joinset is dropped and all server tasks are aborted.
    joinset.join_next().await.expect("no servers to wait on")?
}
