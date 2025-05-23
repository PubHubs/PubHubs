use std::ops::{Deref, DerefMut};
use std::rc::Rc;

use actix_web::web;

use crate::{
    api::{self, EndpointDetails as _},
    servers::{self, AppBase, AppCreatorBase, Constellation, Handle, constellation},
};
use crate::{elgamal, handle, phcrypto};

/// Transcryptor
pub type Server = servers::ServerImpl<Details>;

pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::Transcryptor;
    type AppT = App;
    type AppCreatorT = AppCreator;
    type ExtraRunningState = ExtraRunningState;
    type ObjectStoreT = servers::object_store::UseNone;

    fn create_running_state(
        server: &Server,
        constellation: &Constellation,
    ) -> anyhow::Result<Self::ExtraRunningState> {
        Ok(ExtraRunningState {
            phc_ss: server.enc_key.shared_secret(&constellation.phc_enc_key),
        })
    }
}

#[derive(Clone, Debug)]
pub struct ExtraRunningState {
    phc_ss: elgamal::SharedSecret,
}

pub struct App {
    base: AppBase<Server>,
    master_enc_key_part: elgamal::PrivateKey,
}

impl Deref for App {
    type Target = AppBase<Server>;

    fn deref(&self) -> &Self::Target {
        &self.base
    }
}

impl crate::servers::App<Server> for App {
    fn configure_actix_app(self: &Rc<Self>, sc: &mut web::ServiceConfig) {
        api::phct::hub::Key::add_to(self, sc, App::handle_hub_key);
    }

    fn check_constellation(&self, constellation: &Constellation) -> bool {
        // Dear maintainer: this destructuring is intentional, making sure that this `check_constellation` function
        // is updated when new fields are added to the constellation
        let Constellation {
            inner:
                constellation::Inner {
                    // These fields we must check:
                    transcryptor_jwt_key: jwt_key,
                    transcryptor_enc_key: enc_key,
                    transcryptor_master_enc_key_part: master_enc_key_part,

                    // These fields we don't care about:
                    transcryptor_url: _,
                    auths_enc_key: _,
                    auths_jwt_key: _,
                    auths_url: _,
                    phc_jwt_key: _,
                    phc_enc_key: _,
                    phc_url: _,
                    master_enc_key: _,
                },
            id: _,
        } = constellation;

        enc_key == self.enc_key.public_key()
            && **jwt_key == self.jwt_key.verifying_key()
            && master_enc_key_part == self.master_enc_key_part.public_key()
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
        let running_state = &app.running_state_or_not_yet_ready()?;

        let ts_req = signed_req.into_inner();

        let ticket_digest = phcrypto::TicketDigest::new(&ts_req.ticket);

        let (_, _): (api::phct::hub::KeyReq, handle::Handle) =
            ts_req.open(&running_state.constellation.phc_jwt_key)?;

        // At this point we can be confident that the ticket is authentic, so we can give the hub
        // its decryption key based on the provided ticket

        let key_part: curve25519_dalek::Scalar = phcrypto::t_hub_key_part(
            ticket_digest,
            &running_state.phc_ss, // shared secret with pubhubs central
            &app.enc_key,
            &app.master_enc_key_part,
        );

        Ok(api::phct::hub::KeyResp { key_part })
    }
}

#[derive(Clone)]
pub struct AppCreator {
    base: AppCreatorBase<Server>,
    master_enc_key_part: elgamal::PrivateKey,
}

impl Deref for AppCreator {
    type Target = AppCreatorBase<Server>;

    fn deref(&self) -> &Self::Target {
        &self.base
    }
}

impl DerefMut for AppCreator {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.base
    }
}

impl crate::servers::AppCreator<Server> for AppCreator {
    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        let xconf = &config.transcryptor.as_ref().unwrap();

        let master_enc_key_part: elgamal::PrivateKey = xconf
            .master_enc_key_part
            .clone()
            .expect("master_enc_key_part was not generated");

        Ok(Self {
            base: AppCreatorBase::<Server>::new(config)?,
            master_enc_key_part,
        })
    }

    fn into_app(self, handle: &Handle<Server>) -> App {
        App {
            base: AppBase::new(self.base, handle),
            master_enc_key_part: self.master_enc_key_part,
        }
    }
}
