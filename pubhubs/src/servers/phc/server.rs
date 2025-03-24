use std::rc::Rc;

use actix_web::web;

use futures_util::future::LocalBoxFuture;

use crate::{
    api::{self, ApiResultExt as _, EndpointDetails as _},
    client, handle, phcrypto,
    servers::{self, AppBase, AppCreator as _, AppCreatorBase, Constellation, Handle, Server as _},
};

use crate::{elgamal, hub};

/// PubHubs Central server
pub type Server = servers::ServerImpl<Details>;

pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::PubhubsCentral;
    type AppT = Rc<App>;
    type AppCreatorT = AppCreator;
    type ExtraRunningState = RunningState;
    type ObjectStoreT = servers::object_store::DefaultObjectStore;

    fn create_running_state(
        server: &Server,
        constellation: &Constellation,
    ) -> anyhow::Result<Self::ExtraRunningState> {
        let base = server.app_creator().base();

        Ok(RunningState {
            t_ss: base
                .enc_key
                .shared_secret(&constellation.transcryptor_enc_key),
        })
    }
}

pub struct App {
    base: AppBase<Server>,
    transcryptor_url: url::Url,
    auths_url: url::Url,
    hubs: crate::map::Map<hub::BasicInfo>,
    master_enc_key_part: elgamal::PrivateKey,
}

#[derive(Clone, Debug)]
pub struct RunningState {
    t_ss: elgamal::SharedSecret,
}

impl crate::servers::App<Server> for Rc<App> {
    fn configure_actix_app(&self, sc: &mut web::ServiceConfig) {
        api::phc::hub::TicketEP::add_to(self, sc, App::handle_hub_ticket);
        api::phct::hub::Key::add_to(self, sc, App::handle_hub_key);
    }

    fn check_constellation(&self, _constellation: &Constellation) -> bool {
        panic!("PHC creates the constellation; it has no need to check it")
    }

    fn discover(
        &self,
        _phc_di: api::DiscoveryInfoResp,
    ) -> LocalBoxFuture<'_, api::Result<Option<Constellation>>> {
        Box::pin(async {
            let (tdi_res, asdi_res) = tokio::join!(
                self.discovery_info_of(servers::Name::Transcryptor, &self.transcryptor_url),
                self.discovery_info_of(servers::Name::AuthenticationServer, &self.auths_url)
            );

            let tdi = api::return_if_ec!(tdi_res);
            let asdi = api::return_if_ec!(asdi_res);

            let transcryptor_master_enc_key_part = tdi
                .master_enc_key_part
                .expect("should already have been checked to be some by discovery_info_of");
            let new_constellation = crate::servers::Constellation {
                // The public master encryption key is `x_PHC * ( x_T * B )`
                master_enc_key: phcrypto::combine_master_enc_key_parts(
                    &transcryptor_master_enc_key_part,
                    &self.master_enc_key_part,
                ),
                transcryptor_master_enc_key_part,
                phc_url: self.base.phc_url.clone(),
                phc_jwt_key: self.base.jwt_key.verifying_key().into(),
                phc_enc_key: self.base.enc_key.public_key().clone(),
                transcryptor_url: self.transcryptor_url.clone(),
                transcryptor_jwt_key: tdi.jwt_key,
                transcryptor_enc_key: tdi.enc_key,
                auths_url: self.auths_url.clone(),
                auths_jwt_key: asdi.jwt_key,
                auths_enc_key: asdi.enc_key,
            };

            if self.base().running_state.is_none()
                || *self.base().running_state.as_ref().unwrap().constellation != new_constellation
            {
                return api::ok(Some(new_constellation));
            }

            // Check whether the other servers' constellations are up-to-date

            let mut js = tokio::task::JoinSet::new();

            if let Some(c) = tdi.constellation {
                if c != new_constellation {
                    // transcryptor's constellation is out of date; invoke discovery
                    log::info!(
                        "{phc}: {t}'s constellation is out of date - invoking its discovery..",
                        phc = servers::Name::PubhubsCentral,
                        t = servers::Name::Transcryptor
                    );
                    let url = self.transcryptor_url.clone();
                    js.spawn_local(self.base().client.query::<api::DiscoveryRun>(&url, &()));
                }
            }

            if let Some(c) = asdi.constellation {
                if c != new_constellation {
                    // authentication server's constellation is out of date; invoke discovery
                    log::info!(
                        "{phc}: {auths}'s constellation is out of date - invoking its discovery..",
                        phc = servers::Name::PubhubsCentral,
                        auths = servers::Name::AuthenticationServer
                    );
                    let url = self.auths_url.clone();
                    js.spawn_local(self.base().client.query::<api::DiscoveryRun>(&url, &()));
                }
            }

            let result_maybe = js.join_next().await;

            // Whatever the result, we don't want to abort the discovery prematurely
            js.detach_all();

            match result_maybe {
                // joinset was empty;  servers were already up to date
                None => {
                    return api::ok(None);
                }
                // a task ended irregularly (panicked, joined,...)
                Some(Err(join_err)) => {
                    log::error!("discovery run task joined unexpectedly: {}", join_err);
                    return api::err(api::ErrorCode::InternalError);
                }
                // we got a result from one of the tasks..
                Some(Ok(res)) => {
                    if res.retryable().is_ok() {
                        // the discovery task was completed succesfully, or made some progress,
                        // or we got a retryable error.
                        // In all these cases the caller should try again.
                        return api::err(api::ErrorCode::NotYetReady);
                    }
                }
            }

            api::ok(None)
        })
    }

    fn base(&self) -> &AppBase<Server> {
        &self.base
    }

    fn master_enc_key_part(&self) -> Option<&elgamal::PrivateKey> {
        Some(&self.master_enc_key_part)
    }
}

impl App {
    /// Obtains and checks [api::DiscoveryInfoResp] from the given server
    async fn discovery_info_of(
        &self,
        name: servers::Name,
        url: &url::Url,
    ) -> api::Result<api::DiscoveryInfoResp> {
        let tdi = api::return_if_ec!(self
            .base
            .client
            .query::<api::DiscoveryInfo>(url, &())
            .await
            .into_server_result());

        client::discovery::DiscoveryInfoCheck {
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
        let signed_req = signed_req.into_inner();

        let req = api::return_if_ec!(signed_req.clone().open_without_checking_signature());

        let hub = if let Some(hub) = app.hubs.get(&req.handle) {
            hub
        } else {
            return api::err(api::ErrorCode::UnknownHub);
        };

        let result = app
            .base
            .client
            .query::<api::hub::Info>(&hub.info_url, &())
            .await;

        if result.is_err() {
            return api::Result::Err(result.unwrap_err().into_server_error());
        }

        let resp = result.unwrap();

        // check that the request indeed came from the hub
        api::return_if_ec!(signed_req.open(&*resp.verifying_key).inspect_err(|ec| {
            log::warn!(
                "could not verify authenticity of hub ticket request for hub {}: {ec}",
                req.handle,
            )
        }));

        // if so, hand out ticket
        api::Result::Ok(api::return_if_ec!(api::Signed::new(
            &*app.base.jwt_key,
            &api::phc::hub::TicketContent {
                handle: req.handle,
                verifying_key: resp.verifying_key,
            },
            std::time::Duration::from_secs(3600 * 24) /* = one day */
        )))
    }

    async fn handle_hub_key(
        app: Rc<Self>,
        signed_req: web::Json<api::phc::hub::TicketSigned<api::phct::hub::KeyReq>>,
    ) -> api::Result<api::phct::hub::KeyResp> {
        let running_state = &api::return_if_ec!(app.base.running_state()).extra;

        let ts_req = signed_req.into_inner();

        let ticket_digest = phcrypto::TicketDigest::new(&ts_req.ticket);

        let (_, _): (api::phct::hub::KeyReq, handle::Handle) =
            api::return_if_ec!(ts_req.open(&app.base.jwt_key.verifying_key()));

        // At this point we can be confident that the ticket is authentic, so we can give the hub
        // its decryption key based on the provided ticket

        let key_part: curve25519_dalek::Scalar = phcrypto::phc_hub_key_part(
            ticket_digest,
            &running_state.t_ss, // shared secret with transcryptor
            &app.master_enc_key_part,
        );

        api::ok(api::phct::hub::KeyResp { key_part })
    }
}

#[derive(Clone)]
pub struct AppCreator {
    base: AppCreatorBase<Server>,
    transcryptor_url: url::Url,
    auths_url: url::Url,
    hubs: crate::map::Map<hub::BasicInfo>,
    master_enc_key_part: elgamal::PrivateKey,
}

impl crate::servers::AppCreator<Server> for AppCreator {
    fn into_app(self, handle: &Handle<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(self.base, handle),
            transcryptor_url: self.transcryptor_url,
            auths_url: self.auths_url,
            hubs: self.hubs,
            master_enc_key_part: self.master_enc_key_part,
        })
    }

    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        let mut hubs: crate::map::Map<hub::BasicInfo> = Default::default();

        let xconf = &config.phc.as_ref().unwrap().extra;

        for basic_hub_info in xconf.hubs.iter() {
            if let Some(hub_or_id) = hubs.insert_new(basic_hub_info.clone()) {
                anyhow::bail!("two hubs are known as {hub_or_id}");
            }
        }

        let master_enc_key_part: elgamal::PrivateKey = xconf
            .master_enc_key_part
            .clone()
            .expect("master_enc_key_part not generated");

        Ok(Self {
            base: AppCreatorBase::<Server>::new(config)?,
            transcryptor_url: xconf.transcryptor_url.as_ref().clone(),
            auths_url: xconf.auths_url.as_ref().clone(),
            hubs,
            master_enc_key_part,
        })
    }

    fn base(&self) -> &AppCreatorBase<Server> {
        &self.base
    }

    fn base_mut(&mut self) -> &mut AppCreatorBase<Server> {
        &mut self.base
    }
}
