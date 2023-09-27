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
    const NAME: crate::servers::Name = crate::servers::Name::PubhubsCentral;
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
            transcryptor_url: self
                .base
                .config
                .phc
                .as_ref()
                .unwrap()
                .extra
                .transcryptor_url
                .clone(),
        }
    }
}

pub struct App {
    base: AppBase<Server>,
    transcryptor_url: url::Url,
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

    fn discover(&self, _phc_di: api::DiscoveryInfoResp) -> LocalBoxFuture<'_, api::Result<()>> {
        Box::pin(async {
            let tdi = {
                let result = api::query::<api::DiscoveryInfo>(&self.transcryptor_url, &()).await;

                if result.is_err() {
                    return api::Result::Err(result.unwrap_err().into_server_error());
                }

                result.unwrap()
            };

            if tdi.name != crate::servers::Name::Transcryptor {
                log::error!(
                    "{} claims to be {} instead of {}",
                    self.transcryptor_url,
                    tdi.name,
                    crate::servers::Name::Transcryptor
                );
                return api::err(api::ErrorCode::Malconfigured);
            }

            if tdi.phc_url != self.base.phc_url {
                log::error!(
                    "{} thinks phc_url is {} instead of {}",
                    self.transcryptor_url,
                    tdi.phc_url,
                    self.base.phc_url,
                );
                return api::err(api::ErrorCode::Malconfigured);
            }

            // TODO: check tdi.constellation?

            let constellation = crate::servers::Constellation {
                phc_url: self.base.phc_url.clone(),
                phc_jwt_key: self.base.jwt_key.verifying_key().into(),
                transcryptor_url: self.transcryptor_url.clone(),
                transcryptor_jwt_key: tdi.jwt_key,
            };

            let success: bool = self
                .base
                .restart_server(|server: &mut Server| -> Result<()> {
                    server.base.state =
                        crate::servers::server::State::UpAndRunning { constellation };

                    Ok(())
                });

            if !success {
                log::error!("failed to restart server for discovery");
                return api::err(api::ErrorCode::InternalError);
            }

            api::ok(())
        })
    }

    fn base(&self) -> &AppBase<Server> {
        &self.base
    }
}

#[derive(Clone)]
pub struct AppCreator {
    base: AppCreatorBase,
    transcryptor_url: url::Url,
}

impl crate::servers::AppCreator<Server> for AppCreator {
    fn create(&self, shutdown_sender: &crate::servers::ShutdownSender<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(&self.base, shutdown_sender),
            transcryptor_url: self.transcryptor_url.clone(),
        })
    }
}
