use std::collections::HashMap;
use std::rc::Rc;

use actix_web::web;

use futures_util::future::LocalBoxFuture;

use crate::servers::{
    self,
    api::{self, EndpointDetails as _},
    discovery, AppBase, AppCreatorBase, AppMethod, Constellation,
};

use crate::hub;

/// PubHubs Central server
pub type Server = servers::ServerImpl<Details>;

pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::PubhubsCentral;
    type AppT = Rc<App>;
    type AppCreatorT = AppCreator;
}

pub struct App {
    base: AppBase<Server>,
    transcryptor_url: url::Url,
    auths_url: url::Url,
    hubs: HashMap<hub::Id, hub::BasicInfo>,
}

impl crate::servers::App<Server> for Rc<App> {
    fn configure_actix_app(&self, sc: &mut web::ServiceConfig) {
        sc.route(
            api::phc::hub::Ticket::PATH,
            web::method(api::phc::hub::Ticket::METHOD)
                .to(AppMethod::new(self, App::handle_hub_ticket)),
        );
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
                phc_url: self.base.phc_url.clone(),
                phc_jwt_key: self.base.jwt_key.verifying_key().into(),
                transcryptor_url: self.transcryptor_url.clone(),
                transcryptor_jwt_key: tdi.jwt_key,
                auths_url: self.auths_url.clone(),
                auths_jwt_key: asdi.jwt_key,
            })
        })
    }

    fn base(&self) -> &AppBase<Server> {
        &self.base
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

        discovery::DiscoveryInfoCheck {
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
        let req = signed_req.into_inner().open_without_checking_signature();

        // MARK
        // Check the hub exists

        api::err(api::ErrorCode::NotImplemented)
    }
}

#[derive(Clone)]
pub struct AppCreator {
    base: AppCreatorBase,
    transcryptor_url: url::Url,
    auths_url: url::Url,
    hubs: HashMap<hub::Id, hub::BasicInfo>,
}

impl crate::servers::AppCreator<Server> for AppCreator {
    fn into_app(self, shutdown_sender: &crate::servers::ShutdownSender<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(&self.base, shutdown_sender),
            transcryptor_url: self.transcryptor_url,
            auths_url: self.auths_url,
            hubs: self.hubs,
        })
    }

    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        let mut hubs: HashMap<hub::Id, hub::BasicInfo> = Default::default();

        for basic_hub_info in config.phc.as_ref().unwrap().extra.hubs.iter() {
            anyhow::ensure!(
                hubs.insert(basic_hub_info.id, basic_hub_info.clone())
                    .is_none(),
                "detected two hubs with the same id, {}",
                basic_hub_info.id
            );
        }

        let xconf = &config.phc.as_ref().unwrap().extra;

        Ok(Self {
            base: AppCreatorBase::new::<Server>(&config),
            transcryptor_url: xconf.transcryptor_url.clone(),
            auths_url: xconf.auths_url.clone(),
            hubs,
        })
    }

    fn base(&self) -> &AppCreatorBase {
        &self.base
    }

    fn base_mut(&mut self) -> &mut AppCreatorBase {
        &mut self.base
    }
}
