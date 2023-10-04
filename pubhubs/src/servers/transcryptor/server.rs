use std::rc::Rc;

use actix_web::web;
use anyhow::Result;
use futures_util::future::LocalBoxFuture;

use crate::servers::{
    self, api, discovery, AppBase, AppCreatorBase, Constellation, ServerBase, ShutdownSender,
};

/// Transcryptor
pub struct Server {
    base: ServerBase,
}

impl crate::servers::Server for Server {
    const NAME: crate::servers::Name = crate::servers::Name::Transcryptor;
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
                        app.base.restart_server(|_: &mut Server| Ok(()));

                        async { "Stopping..." }
                    }
                }),
            );
    }

    fn discover(
        &self,
        phc_inf: api::DiscoveryInfoResp,
    ) -> LocalBoxFuture<'_, api::Result<Constellation>> {
        Box::pin(async move {
            if phc_inf.state != api::ServerState::UpAndRunning {
                return api::err(api::ErrorCode::NotYetReady);
            }

            // NOTE: phc_inf has already been (partially) checked
            let c = phc_inf
                .constellation
                .as_ref()
                .expect("that constellation is not none should already have been checked");

            let tdi = {
                let result = api::query::<api::DiscoveryInfo>(&c.transcryptor_url, &()).await;

                if result.is_err() {
                    return api::Result::Err(result.unwrap_err().into_server_error());
                }

                result.unwrap()
            };

            let t_inf = match (discovery::DiscoveryInfoCheck {
                name: servers::Name::Transcryptor,
                phc_url: &self.base.phc_url,
                self_check_code: Some(&self.base.self_check_code),
                constellation: Some(c),
            }
            .check(tdi, &c.transcryptor_url))
            {
                api::Result::Ok(tdi) => tdi,
                api::Result::Err(ec) => return api::err(ec),
            };

            api::ok(phc_inf.constellation.unwrap())
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
    fn create(&self, shutdown_sender: &ShutdownSender<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(&self.base, shutdown_sender),
        })
    }
}
