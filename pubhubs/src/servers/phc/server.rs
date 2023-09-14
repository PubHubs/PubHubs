use std::rc::Rc;

use actix_web::web;
use anyhow::Result;
use futures_util::future::LocalBoxFuture;

use crate::servers::api;
use crate::servers::{AppBase, AppCreatorBase, ServerBase};

/// PubHubs Central server
pub struct Server {
    base: ServerBase,
}

impl crate::servers::Server for Server {
    const NAME: crate::servers::Name = crate::servers::Name::PubHubsCentral;
    type AppT = Rc<App>;
    type AppCreatorT = AppCreator;

    fn new(config: &crate::servers::Config) -> Self {
        Server {
            base: ServerBase::new::<Server>(config),
        }
    }

    fn app_creator(&self) -> AppCreator {
        AppCreator {
            base: AppCreatorBase::new(&self.base),
        }
    }
}

pub struct App {
    base: AppBase<Server>,
}

impl crate::servers::App<Server> for Rc<App> {
    fn configure_actix_app(&self, sc: &mut web::ServiceConfig) {
        let app = self.clone();

        sc.route("/test", web::get().to(|| async { "Hi!" }))
            .route(
                "/stop",
                web::get().to({
                    let app = app.clone();
                    move || {
                        app.base.stop_server();

                        async { "Stopping..." }
                    }
                }),
            )
            .route(
                "/restart",
                web::get().to({
                    let app = app.clone();
                    move || {
                        app.base
                            .restart_server(|_: &mut Server| -> Result<()> { Ok(()) });

                        async { "Stopping..." }
                    }
                }),
            );
    }

    fn discover(
        &self,
        _phc_di: api::DiscoveryInfoResp,
    ) -> LocalBoxFuture<'_, Result<(), api::ErrorCode>> {
        Box::pin(async {
            tokio::time::sleep(tokio::time::Duration::from_millis(3000)).await;

            Ok(())
        })
    }

    fn base(&self) -> &AppBase<Server> {
        &self.base
    }
}

#[derive(Clone)]
pub struct AppCreator {
    base: AppCreatorBase,
}

impl crate::servers::AppCreator<Server> for AppCreator {
    fn create(&self, shutdown_sender: &crate::servers::ShutdownSender<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(&self.base, shutdown_sender),
        })
    }
}
