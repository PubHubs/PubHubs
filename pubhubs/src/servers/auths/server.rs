use std::rc::Rc;

use actix_web::web;

use crate::servers::{AppBase, AppCreatorBase, ServerBase, ShutdownSender};

/// Authentication server
pub struct Server {
    base: ServerBase,
}

impl crate::servers::Server for Server {
    const NAME: crate::servers::Name = crate::servers::Name::AuthenticationServer;
    type AppT = Rc<App>;
    type AppCreatorT = AppCreator;

    fn new(config: &crate::servers::Config) -> Self {
        Self {
            base: ServerBase::new::<Server>(config),
        }
    }

    fn app_creator(&self) -> AppCreator {
        AppCreator {
            base: AppCreatorBase::new(&self.base),
        }
    }

    fn base_mut(&mut self) -> &mut ServerBase {
        &mut self.base
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
    base: AppCreatorBase,
}

impl crate::servers::AppCreator<Server> for AppCreator {
    fn create(&self, shutdown_sender: &ShutdownSender<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(&self.base, shutdown_sender),
        })
    }
}
