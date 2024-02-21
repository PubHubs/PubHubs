use std::rc::Rc;

use actix_web::web;

use crate::servers::{self, AppBase, AppCreatorBase, Constellation, ShutdownSender};

/// Authentication server
pub type Server = servers::ServerImpl<Details>;

pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::AuthenticationServer;

    type AppT = Rc<App>;
    type AppCreatorT = AppCreator;
    type RunningState = ();

    fn create_running_state(
        _server: &Server,
        _constellation: &Constellation,
    ) -> anyhow::Result<Self::RunningState> {
        Ok(())
    }
}

pub struct App {
    base: AppBase<Server>,
}

impl crate::servers::App<Server> for Rc<App> {
    fn configure_actix_app(&self, _sc: &mut web::ServiceConfig) {}

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
            base: AppCreatorBase::<Server>::new(config),
        })
    }

    fn into_app(self, shutdown_sender: &ShutdownSender<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(self.base, shutdown_sender),
        })
    }

    fn base(&self) -> &AppCreatorBase<Server> {
        &self.base
    }

    fn base_mut(&mut self) -> &mut AppCreatorBase<Server> {
        &mut self.base
    }
}
