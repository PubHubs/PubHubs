use crate::servers::for_all_servers;
use anyhow::Result;

/// Runs the PubHubs server(s) from the given configuration.
///
/// Returns if one of the servers crashes.
pub async fn run(config: crate::servers::Config) -> Result<()> {
    let mut joinset = tokio::task::JoinSet::<Result<()>>::new();

    macro_rules! run_server {
        ($server:ident) => {
            if let Some(server_config) = config.$server.as_ref() {
                joinset.spawn(
                    crate::servers::Runner::<crate::servers::$server::Server>::new(
                        &config,
                        server_config,
                    )?,
                );
            }
        };
    }

    for_all_servers!(run_server);

    // Wait for one of the servers to return, panic or be cancelled.
    // By returning, joinset is dropped and all server tasks are aborted.
    joinset.join_next().await.expect("no servers to wait on")?
}
