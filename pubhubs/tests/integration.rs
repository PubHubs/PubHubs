// integration test, testing all aspects of the rust code

use pubhubs::{hub, servers};
use std::sync::{Arc, Weak};

const CONFIG_FILE_PATH: &'static str = "pubhubs.default.yaml";

#[tokio::test]
async fn main_integration_test() {
    env_logger::init();

    // Load configuration
    let config = servers::Config::load_from_path(std::path::Path::new(CONFIG_FILE_PATH))
        .unwrap()
        .unwrap();

    let _set = servers::Set::new(&config);

    // Run discovery
    tokio::task::LocalSet::new()
        .run_until(servers::drive_discovery(&config.phc_url))
        .await
        .unwrap();

    // Run mock test hub
    let testhub = config
        .phc
        .as_ref()
        .unwrap()
        .extra
        .hubs
        .iter()
        .find(|h: &&hub::BasicInfo| &*h.names[0] == "testhub")
        .expect("could not find 'testhub' hub");

    let mock_hub = MockHub::new(testhub);
}

/// Simulates a hub
struct MockHub {
    pub actix_server: actix_web::dev::Server,
    pub info: hub::BasicInfo,
    pub weak: Weak<Self>,
}

impl MockHub {
    fn new(info: hub::BasicInfo) -> Arc<Self> {
        Arc::new_cyclic(|weak: &Weak<Self>| Self {
            weak,
            info,
            actix_server: actix_web::HttpServer::new(|| {
                let hub = weak.upgrade().unwrap();
                //actix_web::App::new(hub.info.info_url.path(), ).route()
            })
            .bind((
                testhub.info_url.host_str().unwrap(),
                testhub
                    .info_url
                    .port()
                    .expect("testhub info url has no port"),
            ))
            .unwrap()
            .run(),
        })
    }
}
