use actix_web::web;
use anyhow::Result;
use std::rc::Rc;

/// Transcryptor
pub struct Server {
    config: crate::servers::Config,
}

impl crate::servers::Server for Server {
    const NAME: &'static str = "Transcryptor";
    type AppT = Rc<App>;
    type Modifier = Modifier;
    type AppCreatorT = AppCreator;

    fn new(config: &crate::servers::Config) -> Self {
        Server {
            config: config.clone(),
        }
    }

    fn app_creator(&self) -> AppCreator {
        AppCreator {}
    }
}

type Modifier = Box<dyn (FnOnce(&mut Server) -> Result<()>) + Send + 'static>;

pub struct App {
    shutdown_sender: crate::servers::ShutdownSender<Server>,
}

impl crate::servers::App for Rc<App> {
    fn configure_actix_app(&self, sc: &mut web::ServiceConfig) {
        let app = self.clone();

        sc.route("/test", web::get().to(|| async { "Hi!" }))
            .route(
                "/stop",
                web::get().to({
                    let app = app.clone();
                    move || {
                        app.shutdown_sender
                            .try_send(crate::servers::ShutdownCommand::Exit)
                            .unwrap();

                        async { "Stopping..." }
                    }
                }),
            )
            .route(
                "/restart",
                web::get().to({
                    let app = app.clone();
                    move || {
                        let bx: Modifier = Box::new(|_: &mut Server| -> Result<()> { Ok(()) });
                        app.shutdown_sender
                            .try_send(crate::servers::ShutdownCommand::ModifyAndRestart(bx))
                            .unwrap();

                        async { "Stopping..." }
                    }
                }),
            );
    }
}

#[derive(Clone)]
pub struct AppCreator {}

impl crate::servers::AppCreator<Server> for AppCreator {
    fn create(&self, shutdown_sender: &crate::servers::ShutdownSender<Server>) -> Rc<App> {
        Rc::new(App {
            shutdown_sender: shutdown_sender.clone(),
        })
    }
}
