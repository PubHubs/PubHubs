// integration test, testing all aspects of the rust code

use actix_web::web;
use pubhubs::{api, client, elgamal, hub, servers};
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
    let admin_pk = Some(admin_sk.verifying_key().into());

    macro_rules! set_admin_key {
        ($server:ident) => {
            config
                .$server
                .as_mut()
                .unwrap()
                .admin_key
                .clone_from(&admin_pk);
        };
    }

    servers::for_all_servers!(set_admin_key);

    let (set, _) = servers::Set::new(&config).unwrap();

    tokio::task::LocalSet::new()
        .run_until(main_integration_test_local(config, admin_sk))
        .await;

    assert_eq!(set.shutdown().await, 0, "not all servers exited cleanly");
}

/// The part of [main_integration_test] that's run on one thread.
async fn main_integration_test_local(config: servers::Config, admin_sk: api::SigningKey) {
    let constellation: servers::Constellation =
        client::get_constellation(&config.phc_url).await.unwrap();

    // To test discovery, change transcryptor's and phc's encryption key
    let t_enc_key_sk = elgamal::PrivateKey::random();
    let phc_enc_key_sk = elgamal::PrivateKey::random();

    api::query_with_retry::<api::admin::UpdateConfig>(
        &constellation.transcryptor_url,
        &api::Signed::<api::admin::UpdateConfigReq>::new(
            &*admin_sk,
            &api::admin::UpdateConfigReq {
                pointer: "/transcryptor/enc_key".to_owned(),
                new_value: serde_json::to_value(&t_enc_key_sk).unwrap(),
            },
            Duration::from_secs(10),
        )
        .unwrap(),
    )
    .await
    .unwrap();

    // wait for transcryptor's enc_key to be updated
    pubhubs::misc::task::retry(|| async {
        client::try_get_stable_constellation(&constellation.phc_url)
            .await
            .retryable()
            .map(Option::flatten) // Now Result<Option<Constellation>>
            .map(|constellation_maybe| {
                if let Some(ref constellation) = constellation_maybe {
                    if &constellation.transcryptor_enc_key != t_enc_key_sk.public_key() {
                        log::debug!(
                            "stable constellation has old transcryptor encryption key still"
                        );
                        return None;
                    }
                }

                constellation_maybe
            })
    })
    .await
    .unwrap()
    .unwrap();

    // update PHC's key
    api::query_with_retry::<api::admin::UpdateConfig>(
        &constellation.phc_url,
        &api::Signed::<api::admin::UpdateConfigReq>::new(
            &*admin_sk,
            &api::admin::UpdateConfigReq {
                pointer: "/phc/enc_key".to_owned(),
                new_value: serde_json::to_value(&phc_enc_key_sk).unwrap(),
            },
            Duration::from_secs(10),
        )
        .unwrap(),
    )
    .await
    .unwrap();

    // wait for phc's enc_key to be updated
    pubhubs::misc::task::retry(|| async {
        client::try_get_stable_constellation(&constellation.phc_url)
            .await
            .retryable()
            .map(Option::flatten) // Now Result<Option<Constellation>>
            .map(|constellation_maybe| {
                if let Some(ref constellation) = constellation_maybe {
                    if &constellation.phc_enc_key != phc_enc_key_sk.public_key() {
                        log::debug!("stable constellation has old phc encryption key still");
                        return None;
                    }
                }

                constellation_maybe
            })
    })
    .await
    .unwrap()
    .unwrap();

    let constellation: servers::Constellation =
        client::get_constellation(&config.phc_url).await.unwrap();

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
    let ticket = api::query_with_retry::<api::phc::hub::TicketEP>(
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
    .unwrap();

    // check that the ticket is valid
    ticket.clone().open(&*constellation.phc_jwt_key).unwrap();

    // request hub encryption key
    let _ek = client::for_hubs::get_hub_enc_key(client::for_hubs::HubContext {
        ticket: &ticket,
        signing_key: &mock_hub.context.sk,
        constellation: &constellation,
        timeout: Duration::from_secs(10),
    })
    .await
    .unwrap();
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
    return web::Json(api::Result::Ok(api::hub::InfoResp {
        verifying_key: vk,
        hub_version: "n/a".to_owned(),
    }));
}
