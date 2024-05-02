use std::rc::Rc;

use actix_web::web;

use crate::{
    api::{self, EndpointDetails as _},
    servers::{
        self, AppBase, AppCreator as _, AppCreatorBase, Constellation, Server as _, ShutdownSender,
    },
};
use crate::{elgamal, hub, phcrypto};

/// Transcryptor
pub type Server = servers::ServerImpl<Details>;

pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::Transcryptor;
    type AppT = Rc<App>;
    type AppCreatorT = AppCreator;
    type RunningState = RunningState;

    fn create_running_state(
        server: &Server,
        constellation: &Constellation,
    ) -> anyhow::Result<Self::RunningState> {
        let base = server.app_creator().base();

        Ok(RunningState {
            phc_ss: base.enc_key.shared_secret(&constellation.phc_enc_key),
        })
    }
}

#[derive(Clone)]
pub struct RunningState {
    phc_ss: elgamal::SharedSecret,
}

pub struct App {
    base: AppBase<Server>,
    master_enc_key_part: elgamal::PrivateKey,
}

impl crate::servers::App<Server> for Rc<App> {
    fn configure_actix_app(&self, sc: &mut web::ServiceConfig) {
        api::phct::hub::Key::add_to(self, sc, App::handle_hub_key);
    }

    fn base(&self) -> &AppBase<Server> {
        &self.base
    }

    fn master_enc_key_part(&self) -> Option<&elgamal::PrivateKey> {
        Some(&self.master_enc_key_part)
    }
}

impl App {
    async fn handle_hub_key(
        app: Rc<Self>,
        signed_req: web::Json<api::phc::hub::TicketSigned<api::phct::hub::KeyReq>>,
    ) -> api::Result<api::phct::hub::KeyResp> {
        let (running_state, constellation): (&RunningState, &Constellation) =
            api::return_if_ec!(app.base.running_state());

        let ts_req = signed_req.into_inner();

        let ticket_digest = phcrypto::TicketDigest::new(&ts_req.ticket);

        let (_, _): (api::phct::hub::KeyReq, hub::Name) =
            api::return_if_ec!(ts_req.open(&constellation.phc_jwt_key));

        // At this point we can be confident that the ticket is authentic, so we can give the hub
        // its decryption key based on the provided ticket

        let key_part: curve25519_dalek::Scalar = phcrypto::t_hub_key_part(
            ticket_digest,
            &running_state.phc_ss, // shared secret with pubhubs central
            &app.base.enc_key,
            &app.master_enc_key_part,
        );

        api::ok(api::phct::hub::KeyResp { key_part })
    }
}

#[derive(Clone)]
pub struct AppCreator {
    base: AppCreatorBase<Server>,
    master_enc_key_part: elgamal::PrivateKey,
}

impl crate::servers::AppCreator<Server> for AppCreator {
    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        let xconf = &config.transcryptor.as_ref().unwrap().extra;

        let master_enc_key_part: elgamal::PrivateKey = xconf
            .master_enc_key_part
            .clone()
            .unwrap_or_else(elgamal::PrivateKey::random);

        Ok(Self {
            base: AppCreatorBase::<Server>::new(config),
            master_enc_key_part,
        })
    }

    fn into_app(self, shutdown_sender: &ShutdownSender<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(self.base, shutdown_sender),
            master_enc_key_part: self.master_enc_key_part,
        })
    }

    fn base(&self) -> &AppCreatorBase<Server> {
        &self.base
    }

    fn base_mut(&mut self) -> &mut AppCreatorBase<Server> {
        &mut self.base
    }
}
