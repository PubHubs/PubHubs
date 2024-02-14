use std::rc::Rc;

use actix_web::web;

use crate::elgamal;
use crate::servers::{
    self, AppBase, AppCreator as _, AppCreatorBase, Constellation, Server as _, ShutdownSender,
};

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
    fn configure_actix_app(&self, _sc: &mut web::ServiceConfig) {}

    fn base(&self) -> &AppBase<Server> {
        &self.base
    }

    fn master_enc_key_part(&self) -> Option<&elgamal::PrivateKey> {
        Some(&self.master_enc_key_part)
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
            .unwrap_or_else(|| elgamal::PrivateKey::random());

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
