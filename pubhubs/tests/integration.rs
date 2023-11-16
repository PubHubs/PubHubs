// integration test, testing all aspects of the rust code

use pubhubs::servers;

#[tokio::test]
async fn main_integration_test() {
    env_logger::init();

    let config = servers::Config::load_from_path(std::path::Path::new("pubhubs.default.yaml"))
        .unwrap()
        .unwrap();

    let _set = servers::Set::new(&config);

    tokio::task::LocalSet::new()
        .run_until(servers::drive_discovery(&config.phc_url))
        .await
        .unwrap();

    // TODO: simulate hub
}
