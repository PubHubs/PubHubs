use std::rc::Rc;

use actix_web::web;

use crate::servers::{self, AppBase, AppCreatorBase, Constellation, Handle};
use crate::{
    api::{self, EndpointDetails as _},
    attr, handle, map,
};

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
    attribute_types: map::Map<attr::Type>,
    yivi_requestor_url: url::Url,
    yivi_requestor_creds: servers::yivi::RequestorCredentials,
}

impl App {
    async fn handle_auth_start(
        app: Rc<Self>,
        req: web::Json<api::auths::AuthStartReq>,
    ) -> api::Result<api::auths::AuthStartResp> {
        let mut source: Option<attr::Source> = None;
        let mut attr_types = Vec::<attr::Type>::with_capacity(req.attr_types.len());

        if req.attr_types.len() == 0 {
            log::debug!("got authentication start request without any attribute types");
            return api::err(api::ErrorCode::BadRequest);
        }

        for attr_type_handle in req.attr_types.iter() {
            if let Some(attr_type) = app.attribute_types.get(attr_type_handle) {
                attr_types.push(attr_type.clone());
            } else {
                log::debug!("got authentication start request with unknown attribute type handle: {attr_type_handle}");
                return api::err(api::ErrorCode::UnknownAttributeType);
            }
        }

        let source = attr_types[0].source_details.source();

        for attr_type in attr_types.iter() {
            if source != attr_type.source_details.source() {
                log::debug!("got authentication start request with mixed sources");
                return api::err(api::ErrorCode::BadRequest);
            }
        }

        match source {
            attr::Source::Yivi => Self::handle_auth_start_yivi(app, attr_types).await,
        }
    }

    async fn handle_auth_start_yivi(
        app: Rc<Self>,
        attr_types: Vec<attr::Type>,
    ) -> api::Result<api::auths::AuthStartResp> {
        let cdc: servers::yivi::AttributeConDisCon = Default::default(); // empty

        for attr_ty in attr_types.iter() {
            match attr_ty.source_details {
                attr::SourceDetails::Yivi {
                    cdc
                }
            }
        }

        let disclosure_request_jwt: String =
            servers::yivi::SessionRequest::disclosure(cdc).sign(app.yivi_requestor_creds);

        Ok(api::auths::AuthStartResp {
            task: api::auths::AuthTask::Yivi {
                disclosure_request_jwt,
                yivi_requestor_url: app.yivi_requestor_url.clone(),
            },
        })
    }

    async fn handle_auth_complete(
        app: Rc<Self>,
        req: web::Json<api::auths::AuthCompleteReq>,
    ) -> api::Result<api::auths::AuthCompleteResp> {
        todo! {}
    }
}

impl crate::servers::App<Server> for Rc<App> {
    fn configure_actix_app(&self, sc: &mut web::ServiceConfig) {
        api::auths::AuthStartEP::add_to(self, sc, App::handle_auth_start);
        api::auths::AuthCompleteEP::add_to(self, sc, App::handle_auth_complete);
    }

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
    attribute_types: map::Map<attr::Type>,
    yivi_requestor_url: url::Url,
    yivi_requestor_creds: servers::yivi::RequestorCredentials,
}

impl crate::servers::AppCreator<Server> for AppCreator {
    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        let xconf = &config.auths.as_ref().unwrap().extra;

        let mut attribute_types: crate::map::Map<attr::Type> = Default::default();

        for attr_type in xconf.attribute_types.iter() {
            if let Some(handle_or_id) = attribute_types.insert_new(attr_type.clone()) {
                anyhow::bail!("two attribute types are known as {handle_or_id}");
            }
        }

        Ok(Self {
            base: AppCreatorBase::<Server>::new(config)?,
            attribute_types,
            yivi_requestor_url: xconf.yivi.requestor_url.as_ref().clone(),
            yivi_requestor_creds: xconf.yivi.requestor_creds.clone(),
        })
    }

    fn into_app(self, handle: &Handle<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(self.base, handle),
            attribute_types: self.attribute_types,
            yivi_requestor_url: self.yivi_requestor_url,
            yivi_requestor_creds: self.yivi_requestor_creds,
        })
    }

    fn base(&self) -> &AppCreatorBase<Server> {
        &self.base
    }

    fn base_mut(&mut self) -> &mut AppCreatorBase<Server> {
        &mut self.base
    }
}
