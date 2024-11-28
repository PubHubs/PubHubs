use std::rc::Rc;

use actix_web::web;

use crate::servers::{self, AppBase, AppCreatorBase, Constellation, Handle};

/// Authentication server
pub type Server = servers::ServerImpl<Details>;

pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::AuthenticationServer;

    type AppT = Rc<App>;
    type AppCreatorT = AppCreator;
    type ExtraRunningState = ();
    type ObjectStoreT = servers::object_store::UseNone;

    fn create_running_state(
        _server: &Server,
        _constellation: &Constellation,
    ) -> anyhow::Result<Self::ExtraRunningState> {
        Ok(())
    }
}

pub struct App {
    base: AppBase<Server>,
}

impl crate::servers::App<Server> for Rc<App> {
    fn configure_actix_app(&self, _sc: &mut web::ServiceConfig) {}

    fn check_constellation(&self, constellation: &Constellation) -> bool {
        // Dear maintainer: this destructuring is intentional, making sure that this `check_constellation` function
        // is updated when new fields are added to the constellation
        let Constellation {
            // These fields we must check:
            auths_enc_key: enc_key,
            auths_jwt_key: jwt_key,

            // These fields we don't care about:
            auths_url: _,
            transcryptor_jwt_key: _,
            transcryptor_enc_key: _,
            transcryptor_url: _,
            transcryptor_master_enc_key_part: _,
            phc_jwt_key: _,
            phc_enc_key: _,
            phc_url: _,
            master_enc_key: _,
        } = constellation;

        enc_key == self.base.enc_key.public_key() && **jwt_key == self.base.jwt_key.verifying_key()
    }

    fn base(&self) -> &AppBase<Server> {
        &self.base
    }
}

#[derive(Clone)]
pub struct AppCreator {
    base: AppCreatorBase<Server>,
}

impl crate::servers::AppCreator<Server> for AppCreator {
    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        Ok(Self {
            base: AppCreatorBase::<Server>::new(config)?,
        })
    }

    fn into_app(self, handle: &Handle<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(self.base, handle),
        })
    }

    fn base(&self) -> &AppCreatorBase<Server> {
        &self.base
    }

    fn base_mut(&mut self) -> &mut AppCreatorBase<Server> {
        &mut self.base
    }
}
