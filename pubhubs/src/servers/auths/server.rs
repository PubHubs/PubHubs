use std::rc::Rc;

use actix_web::web;

use crate::servers::{self, yivi, AppBase, AppCreatorBase, Constellation, Handle};
use crate::{
    api::{self, EndpointDetails as _, IntoErrorCode as _},
    attr, map,
    misc::jwt,
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
    yivi: Option<YiviCtx>,
}

#[derive(Debug, Clone)]
pub struct YiviCtx {
    requestor_url: url::Url,
    requestor_creds: servers::yivi::Credentials,
}

impl App {
    fn get_yivi(&self) -> Result<&YiviCtx, api::ErrorCode> {
        self.yivi.as_ref().ok_or(api::ErrorCode::YiviNotConfigured)
    }
}

impl App {
    async fn handle_auth_start(
        app: Rc<Self>,
        req: web::Json<api::auths::AuthStartReq>,
    ) -> api::Result<api::auths::AuthStartResp> {
        let mut attr_types = Vec::<attr::Type>::with_capacity(req.attr_types.len());

        for attr_type_handle in req.attr_types.iter() {
            if let Some(attr_type) = app.attribute_types.get(attr_type_handle) {
                attr_types.push(attr_type.clone());
            } else {
                log::debug!("got authentication start request with unknown attribute type handle: {attr_type_handle}");
                return api::err(api::ErrorCode::UnknownAttributeType);
            }
        }

        match req.source {
            attr::Source::Yivi => Self::handle_auth_start_yivi(app, attr_types).await,
        }
    }

    async fn handle_auth_start_yivi(
        app: Rc<Self>,
        attr_types: Vec<attr::Type>,
    ) -> api::Result<api::auths::AuthStartResp> {
        let yivi = api::return_if_ec!(app.get_yivi());

        // Create ConDisCon for our attributes
        let mut cdc: servers::yivi::AttributeConDisCon = Default::default(); // empty

        for attr_ty in attr_types.iter() {
            let mut dc: Vec<Vec<servers::yivi::AttributeRequest>> = Default::default();

            for source in attr_ty.sources.iter() {
                let attr_type_id: yivi::AttributeTypeIdentifier = match source {
                    attr::SourceDetails::Yivi { attr_type_id } => attr_type_id.clone(),
                    #[expect(unreachable_patterns)]
                    _ => continue,
                };

                dc.push(vec![servers::yivi::AttributeRequest { ty: attr_type_id }]);
            }

            if dc.len() == 0 {
                log::debug!("got yivi authentication start request for {attr_ty}, but yivi is not supported for this attribute type");
                return api::err(api::ErrorCode::MissingAttributeSource);
            }

            cdc.push(dc);
        }

        let disclosure_request: jwt::JWT =
            api::return_if_ec!(servers::yivi::SessionRequest::disclosure(cdc)
                .sign(&yivi.requestor_creds)
                .into_ec(|err| {
                    log::error!("failed to create signed disclosure request: {err}");

                    api::ErrorCode::InternalError
                }));

        api::ok(api::auths::AuthStartResp {
            task: api::auths::AuthTask::Yivi {
                disclosure_request,
                yivi_requestor_url: yivi.requestor_url.clone(),
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
    yivi: Option<YiviCtx>,
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

        let yivi: Option<YiviCtx> = xconf.yivi.as_ref().map(|cfg| YiviCtx {
            requestor_url: cfg.requestor_url.as_ref().clone(),
            requestor_creds: cfg.requestor_creds.clone(),
        });

        Ok(Self {
            base: AppCreatorBase::<Server>::new(config)?,
            attribute_types,
            yivi,
        })
    }

    fn into_app(self, handle: &Handle<Server>) -> Rc<App> {
        Rc::new(App {
            base: AppBase::new(self.base, handle),
            attribute_types: self.attribute_types,
            yivi: self.yivi,
        })
    }

    fn base(&self) -> &AppCreatorBase<Server> {
        &self.base
    }

    fn base_mut(&mut self) -> &mut AppCreatorBase<Server> {
        &mut self.base
    }
}
