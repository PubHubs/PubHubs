use std::collections::HashMap;
use std::rc::Rc;

use actix_web::web;

use futures_util::future::LocalBoxFuture;

use crate::{
    api::{self, EndpointDetails as _},
    client, phcrypto,
    servers::{self, AppBase, AppCreator as _, AppCreatorBase, Constellation, Server as _},
};

use crate::{elgamal, hub};

/// PubHubs Central server
pub type Server = servers::ServerImpl<Details>;

pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::PubhubsCentral;
    type AppT = Rc<App>;
    type AppCreatorT = AppCreator;
    type ExtraRunningState = RunningState;

    fn create_running_state(
        server: &Server,
        constellation: &Constellation,
    ) -> anyhow::Result<Self::ExtraRunningState> {
        let base = server.app_creator().base();

        Ok(RunningState {
            t_ss: base
                .enc_key
                .shared_secret(&constellation.transcryptor_enc_key),
        })
    }
}

pub struct App {
    base: AppBase<Server>,
    transcryptor_url: url::Url,
    auths_url: url::Url,
    hubs: HashMap<hub::Id, hub::BasicInfo>,
    hub_by_name: HashMap<hub::Name, hub::Id>,
    master_enc_key_part: elgamal::PrivateKey,
}

#[derive(Clone, Debug)]
pub struct RunningState {
    t_ss: elgamal::SharedSecret,
}

impl crate::servers::App<Server> for Rc<App> {
    fn configure_actix_app(&self, sc: &mut web::ServiceConfig) {
        api::phc::hub::TicketEP::add_to(self, sc, App::handle_hub_ticket);
        api::phct::hub::Key::add_to(self, sc, App::handle_hub_key);
    }

    fn discover(
        &self,
        _phc_di: api::DiscoveryInfoResp,
    ) -> LocalBoxFuture<'_, api::Result<Constellation>> {
        Box::pin(async {
            let (tdi_res, asdi_res) = tokio::join!(
                self.discovery_info_of(servers::Name::Transcryptor, &self.transcryptor_url),
                self.discovery_info_of(servers::Name::AuthenticationServer, &self.auths_url)
            );

            let tdi = api::return_if_ec!(tdi_res);
            let asdi = api::return_if_ec!(asdi_res);

            api::ok(crate::servers::Constellation {
                // The public master encryption key is `x_PHC * ( x_T * B )`
                master_enc_key: phcrypto::combine_master_enc_key_parts(
                    &tdi.master_enc_key_part
                        .expect("should already have been checked to be some by discovery_info_of"),
                    &self.master_enc_key_part,
                ),
                phc_url: self.base.phc_url.clone(),
                phc_jwt_key: self.base.jwt_key.verifying_key().into(),
                phc_enc_key: self.base.enc_key.public_key().clone(),
                transcryptor_url: self.transcryptor_url.clone(),
                transcryptor_jwt_key: tdi.jwt_key,
                transcryptor_enc_key: tdi.enc_key,
                auths_url: self.auths_url.clone(),
                auths_jwt_key: asdi.jwt_key,
                auths_enc_key: asdi.enc_key,
            })
        })
    }

    fn base(&self) -> &AppBase<Server> {
        &self.base
    }

    fn master_enc_key_part(&self) -> Option<&elgamal::PrivateKey> {
        Some(&self.master_enc_key_part)
    }
}

impl App {
    /// Obtains and checks [api::DiscoveryInfoResp] from the given server
    async fn discovery_info_of(
        &self,
        name: servers::Name,
        url: &url::Url,
    ) -> api::Result<api::DiscoveryInfoResp> {
        let tdi = api::return_if_ec!(api::query::<api::DiscoveryInfo>(url, &())
            .await
            .into_server_result());

        client::discovery::DiscoveryInfoCheck {
            phc_url: &self.base.phc_url,
            name,
            self_check_code: None,
            constellation: None,
        }
        .check(tdi, url)
    }

    async fn handle_hub_ticket(
        app: Rc<Self>,
        signed_req: web::Json<api::Signed<api::phc::hub::TicketReq>>,
    ) -> api::Result<api::Signed<api::phc::hub::TicketContent>> {
        let signed_req = signed_req.into_inner();

        let req = api::return_if_ec!(signed_req.clone().open_without_checking_signature());

        let hub = if let Some(hub) = app.hub_by_name(&req.name) {
            hub
        } else {
            return api::err(api::ErrorCode::UnknownHub);
        };

        let result = api::query::<api::hub::Info>(&hub.info_url, &()).await;

        if result.is_err() {
            return api::Result::Err(result.unwrap_err().into_server_error());
        }

        let resp = result.unwrap();

        // check that the request indeed came from the hub
        api::return_if_ec!(signed_req.open(&*resp.verifying_key).inspect_err(|ec| {
            log::warn!(
                "could not verify authenticity of hub ticket request for hub {}: {ec}",
                req.name,
            )
        }));

        // if so, hand out ticket
        api::Result::Ok(api::return_if_ec!(api::Signed::new(
            &*app.base.jwt_key,
            &api::phc::hub::TicketContent {
                name: req.name,
                verifying_key: resp.verifying_key,
            },
            std::time::Duration::from_secs(3600 * 24) /* = one day */
        )))
    }

    fn hub_by_name(&self, name: &hub::Name) -> Option<&hub::BasicInfo> {
        self.hubs.get(self.hub_by_name.get(name)?)
    }

    async fn handle_hub_key(
        app: Rc<Self>,
        signed_req: web::Json<api::phc::hub::TicketSigned<api::phct::hub::KeyReq>>,
    ) -> api::Result<api::phct::hub::KeyResp> {
        let running_state = &api::return_if_ec!(app.base.running_state()).extra;

        let ts_req = signed_req.into_inner();

        let ticket_digest = phcrypto::TicketDigest::new(&ts_req.ticket);

        let (_, _): (api::phct::hub::KeyReq, hub::Name) =
            api::return_if_ec!(ts_req.open(&app.base.jwt_key.verifying_key()));

        // At this point we can be confident that the ticket is authentic, so we can give the hub
        // its decryption key based on the provided ticket

        let key_part: curve25519_dalek::Scalar = phcrypto::phc_hub_key_part(
            ticket_digest,
            &running_state.t_ss, // shared secret with transcryptor
            &app.master_enc_key_part,
        );

        api::ok(api::phct::hub::KeyResp { key_part })
    }
}

#[derive(Clone)]
pub struct AppCreator {
    base: AppCreatorBase<Server>,
    transcryptor_url: url::Url,
    auths_url: url::Url,
    hubs: HashMap<hub::Id, hub::BasicInfo>,
    hub_by_name: HashMap<hub::Name, hub::Id>,
    master_enc_key_part: elgamal::PrivateKey,
}

impl crate::servers::AppCreator<Server> for AppCreator {
    fn into_app(self, shutdown_sender: &crate::servers::ShutdownSender<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(self.base, shutdown_sender),
            transcryptor_url: self.transcryptor_url,
            auths_url: self.auths_url,
            hubs: self.hubs,
            hub_by_name: self.hub_by_name,
            master_enc_key_part: self.master_enc_key_part,
        })
    }

    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        let mut hubs: HashMap<hub::Id, hub::BasicInfo> = Default::default();
        let mut hub_by_name: HashMap<hub::Name, hub::Id> = Default::default();

        let xconf = &config.phc.as_ref().unwrap().extra;

        for basic_hub_info in xconf.hubs.iter() {
            anyhow::ensure!(
                hubs.insert(basic_hub_info.id, basic_hub_info.clone())
                    .is_none(),
                "detected two hubs with the same id, {}",
                basic_hub_info.id
            );

            for name in basic_hub_info.names.iter() {
                anyhow::ensure!(
                    hub_by_name
                        .insert(name.clone(), basic_hub_info.id)
                        .is_none(),
                    "detected two hubs with the same name, {}",
                    name
                );
            }
        }

        let master_enc_key_part: elgamal::PrivateKey = xconf
            .master_enc_key_part
            .clone()
            .unwrap_or_else(elgamal::PrivateKey::random);

        Ok(Self {
            base: AppCreatorBase::<Server>::new(config),
            transcryptor_url: xconf.transcryptor_url.clone(),
            auths_url: xconf.auths_url.clone(),
            hubs,
            hub_by_name,
            master_enc_key_part,
        })
    }

    fn base(&self) -> &AppCreatorBase<Server> {
        &self.base
    }

    fn base_mut(&mut self) -> &mut AppCreatorBase<Server> {
        &mut self.base
    }
}
