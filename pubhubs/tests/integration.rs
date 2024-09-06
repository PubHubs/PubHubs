// integration test, testing all aspects of the rust code

use actix_web::web;
use pubhubs::{api, client, hub, servers};
use std::{sync::Arc, time::Duration};

const CONFIG_FILE_PATH: &'static str = "pubhubs.default.yaml";

#[tokio::test]
async fn main_integration_test() {
    env_logger::init();

    // Load configuration
    let mut config = servers::Config::load_from_path(std::path::Path::new(CONFIG_FILE_PATH))
        .unwrap()
        .unwrap();

    // Change randomly generated admin key to something we know
    let admin_sk = api::SigningKey::generate();
    config.admin_key = Some(admin_sk.verifying_key().into());

    let (set, _) = servers::Set::new(&config).unwrap();

    // Run discovery
    let constellation: servers::Constellation = tokio::task::LocalSet::new()
        .run_until(client::drive_discovery(&config.phc_url))
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

    let mock_hub = MockHub::new(testhub.clone());

    let mut js = tokio::task::JoinSet::new();
    js.spawn(mock_hub.actix_server); // the actix server does not run itself

    // get a ticket for testhub
    let ticket = tokio::task::LocalSet::new()
        .run_until(async {
            api::query::<api::phc::hub::TicketEP>(
                &config.phc_url,
                &api::Signed::<api::phc::hub::TicketReq>::new(
                    &*mock_hub.context.sk,
                    &api::phc::hub::TicketReq {
                        name: "testhub".parse().unwrap(),
                    },
                    Duration::from_secs(10),
                )
                .unwrap(),
            )
            .await
            .unwrap()
        })
        .await;

    // check that the ticket is valid
    ticket.clone().open(&*constellation.phc_jwt_key).unwrap();

    // request hub encryption key
    let _ek = tokio::task::LocalSet::new()
        .run_until(client::for_hubs::get_hub_enc_key(
            client::for_hubs::HubContext {
                ticket: &ticket,
                signing_key: &mock_hub.context.sk,
                constellation: &constellation,
                timeout: Duration::from_secs(10),
            },
        ))
        .await
        .unwrap();

    assert_eq!(set.shutdown().await, 0, "not all servers exited cleanly");
}

/// Simulates a hub.
struct MockHub {
    pub actix_server: actix_web::dev::Server,
    pub context: Arc<MockHubContext>,
}

/// Info needed for the mock hub actix app to run
struct MockHubContext {
    pub info: hub::BasicInfo,
    pub sk: api::SigningKey,
}

impl MockHub {
    fn new(info: hub::BasicInfo) -> Self {
        let context = Arc::new(MockHubContext {
            info,
            sk: api::SigningKey::generate(),
        });

        Self {
            context: context.clone(),
            actix_server: actix_web::HttpServer::new({
                let context = context.clone();
                move || {
                    actix_web::App::new()
                        .app_data(web::Data::new(context.clone()))
                        .route(context.info.info_url.path(), web::get().to(handle_info_url))
                }
            })
            .bind((
                context.info.info_url.host_str().unwrap(),
                context
                    .info
                    .info_url
                    .port()
                    .expect("testhub info url has no port"),
            ))
            .unwrap()
            .run(),
        }
    }
}

async fn handle_info_url(context: web::Data<Arc<MockHubContext>>) -> impl actix_web::Responder {
    let vk: api::VerifyingKey = context.sk.verifying_key().into();
    return web::Json(api::Result::Ok(api::hub::InfoResp { verifying_key: vk }));
}
