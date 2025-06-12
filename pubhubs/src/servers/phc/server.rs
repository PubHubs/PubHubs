//! Basic server [`Details`]: [`Server`], [`App`], etc.
use std::ops::{Deref, DerefMut};
use std::rc::Rc;

use actix_web::web;
use digest::Digest as _;

use crate::api::{self, ApiResultExt as _, EndpointDetails as _, NoPayload};
use crate::client;
use crate::common::secret::DigestibleSecret as _;
use crate::misc::crypto;
use crate::misc::jwt;
use crate::phcrypto;
use crate::servers::{self, AppBase, AppCreatorBase, Constellation, Handle, constellation};

use crate::{elgamal, hub};

/// PubHubs Central server
pub type Server = servers::ServerImpl<Details>;

pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::PubhubsCentral;
    type AppT = App;
    type AppCreatorT = AppCreator;
    type ExtraRunningState = ExtraRunningState;
    type ObjectStoreT = servers::object_store::DefaultObjectStore;

    fn create_running_state(
        server: &Server,
        constellation: &Constellation,
    ) -> anyhow::Result<Self::ExtraRunningState> {
        let auths_ss = server.enc_key.shared_secret(&constellation.auths_enc_key);
        Ok(ExtraRunningState {
            t_ss: server
                .enc_key
                .shared_secret(&constellation.transcryptor_enc_key),
            attr_signing_key: phcrypto::attr_signing_key(&auths_ss),
            auths_ss,
        })
    }
}

pub struct App {
    pub base: AppBase<Server>,
    pub transcryptor_url: url::Url,
    pub auths_url: url::Url,
    pub hubs: crate::map::Map<hub::BasicInfo>,
    pub master_enc_key_part: elgamal::PrivateKey,
    pub attr_id_secret: Box<[u8]>,
    pub auth_token_secret: crypto::SealingKey,
    pub auth_token_validity: core::time::Duration,
    pub user_object_hmac_secret: Box<[u8]>,
    pub quota: api::phc::user::Quota,
}

impl Deref for App {
    type Target = AppBase<Server>;

    fn deref(&self) -> &Self::Target {
        &self.base
    }
}

#[derive(Clone, Debug)]
pub struct ExtraRunningState {
    /// Shared secret with transcryptor
    pub(super) t_ss: elgamal::SharedSecret,

    /// Shared secret with authentication server
    #[expect(dead_code)]
    pub(super) auths_ss: elgamal::SharedSecret,

    /// Key used to sign [`Attr`]s, shared with the authentication server
    ///
    /// [`Attr`]: crate::attr::Attr
    pub(super) attr_signing_key: jwt::HS256,
}

impl crate::servers::App<Server> for App {
    fn configure_actix_app(self: &Rc<Self>, sc: &mut web::ServiceConfig) {
        api::phc::hub::TicketEP::add_to(self, sc, App::handle_hub_ticket);
        api::phct::hub::Key::add_to(self, sc, App::handle_hub_key);

        api::phc::user::WelcomeEP::caching_add_to(self, sc, App::cached_handle_user_welcome);
        api::phc::user::EnterEP::add_to(self, sc, App::handle_user_enter);
        api::phc::user::StateEP::add_to(self, sc, App::handle_user_state);

        api::phc::user::NewObjectEP::add_to(self, sc, App::handle_user_new_object);
        api::phc::user::OverwriteObjectEP::add_to(self, sc, App::handle_user_overwrite_object);
        api::phc::user::GetObjectEP::add_to(self, sc, App::handle_user_get_object);

        api::phc::user::PppEP::add_to(self, sc, App::handle_user_ppp);
    }

    fn check_constellation(&self, _constellation: &Constellation) -> bool {
        panic!("PHC creates the constellation; it has no need to check it")
    }

    async fn discover(
        self: &Rc<Self>,
        _phc_di: api::DiscoveryInfoResp,
    ) -> api::Result<Option<Constellation>> {
        let (tdi_res, asdi_res) = tokio::join!(
            self.discovery_info_of(servers::Name::Transcryptor, &self.transcryptor_url),
            self.discovery_info_of(servers::Name::AuthenticationServer, &self.auths_url)
        );

        let tdi = tdi_res?;
        let asdi = asdi_res?;

        let transcryptor_master_enc_key_part = tdi
            .master_enc_key_part
            .expect("should already have been checked to be some by discovery_info_of");
        let new_constellation_inner = crate::servers::constellation::Inner {
            // The public master encryption key is `x_PHC * ( x_T * B )`
            master_enc_key: phcrypto::combine_master_enc_key_parts(
                &transcryptor_master_enc_key_part,
                &self.master_enc_key_part,
            ),
            transcryptor_master_enc_key_part,
            phc_url: self.phc_url.clone(),
            phc_jwt_key: self.jwt_key.verifying_key().into(),
            phc_enc_key: self.enc_key.public_key().clone(),
            transcryptor_url: self.transcryptor_url.clone(),
            transcryptor_jwt_key: tdi.jwt_key,
            transcryptor_enc_key: tdi.enc_key,
            auths_url: self.auths_url.clone(),
            auths_jwt_key: asdi.jwt_key,
            auths_enc_key: asdi.enc_key,
        };

        if self.running_state.is_none()
            || self.running_state.as_ref().unwrap().constellation.inner != new_constellation_inner
        {
            let new_constellation_id = constellation::Inner::derive_id(&new_constellation_inner);

            if self.running_state.is_some() {
                log::info!(
                    "Detected change in constellation {} -> {}",
                    self.running_state.as_ref().unwrap().constellation.id,
                    new_constellation_id
                );
            } else {
                log::info!("Computed constellation {}", new_constellation_id);
            }

            return Ok(Some(Constellation {
                id: new_constellation_id,
                inner: new_constellation_inner,
            }));
        }

        let constellation = &self.running_state.as_ref().unwrap().constellation;

        log::info!("My own constellation is up-to-date");

        // Check whether the other servers' constellations are up-to-date

        let mut js = tokio::task::JoinSet::new();

        if tdi
            .constellation
            .as_ref()
            .is_some_and(|c| c.id != constellation.id)
        {
            // transcryptor's constellation is out of date; invoke discovery
            log::info!(
                "{phc}: {t}'s constellation is out of date - invoking its discovery..",
                phc = servers::Name::PubhubsCentral,
                t = servers::Name::Transcryptor
            );
            let url = self.transcryptor_url.clone();
            js.spawn_local(
                self.client
                    .query::<api::DiscoveryRun>(&url, NoPayload)
                    .into_future(),
            );
        }

        if asdi
            .constellation
            .as_ref()
            .is_some_and(|c| c.id != constellation.id)
        {
            // authentication server's constellation is out of date; invoke discovery
            log::info!(
                "{phc}: {auths}'s constellation is out of date - invoking its discovery..",
                phc = servers::Name::PubhubsCentral,
                auths = servers::Name::AuthenticationServer
            );
            let url = self.auths_url.clone();
            js.spawn_local(
                self.client
                    .query::<api::DiscoveryRun>(&url, NoPayload)
                    .into_future(),
            );
        }

        let result_maybe = js.join_next().await;

        // Whatever the result, we don't want to abort the the discovery run calls
        // prematurely when `js` is dropped.
        js.detach_all();

        match result_maybe {
            // joinset was empty, no discovery was ran
            None => {
                if tdi.constellation.is_some() && asdi.constellation.is_some() {
                    log::info!("Constellation of all servers up to date!");
                    Ok(None)
                } else {
                    log::info!("Waiting for the other servers to update their constellation.");
                    Err(api::ErrorCode::NotYetReady)
                }
            }
            // a task ended irregularly (panicked, joined,...)
            Some(Err(join_err)) => {
                log::error!("discovery run task joined unexpectedly: {}", join_err);
                Err(api::ErrorCode::InternalError)
            }
            // we got a result from one of the tasks..
            Some(Ok(res)) => {
                match res.retryable() {
                    Ok(_) => {
                        // the discovery task was completed succesfully, or made some progress,
                        // or we got a retryable error.
                        // In all these cases the caller should try again.
                        Err(api::ErrorCode::NotYetReady)
                    }
                    Err(err) => {
                        log::error!("Failed to run discovery of other server: {err}",);
                        Err(api::ErrorCode::InternalError)
                    }
                }
            }
        }
    }

    fn master_enc_key_part(&self) -> Option<&elgamal::PrivateKey> {
        Some(&self.master_enc_key_part)
    }
}

impl App {
    /// Obtains and checks [`api::DiscoveryInfoResp`] from the given server
    async fn discovery_info_of(
        &self,
        name: servers::Name,
        url: &url::Url,
    ) -> api::Result<api::DiscoveryInfoResp> {
        let tdi = self
            .client
            .query::<api::DiscoveryInfo>(url, NoPayload)
            .await
            .into_server_result()?;

        client::discovery::DiscoveryInfoCheck {
            phc_url: &self.phc_url,
            name,
            self_check_code: None,
            constellation: None,
        }
        .check(tdi, url)
    }
}

#[derive(Clone)]
pub struct AppCreator {
    pub base: AppCreatorBase<Server>,
    pub transcryptor_url: url::Url,
    pub auths_url: url::Url,
    pub hubs: crate::map::Map<hub::BasicInfo>,
    pub master_enc_key_part: elgamal::PrivateKey,
    pub attr_id_secret: Box<[u8]>,
    pub auth_token_secret: crypto::SealingKey,
    pub auth_token_validity: core::time::Duration,
    pub user_object_hmac_secret: Box<[u8]>,
    pub quota: api::phc::user::Quota,
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
    fn into_app(self, handle: &Handle<Server>) -> App {
        App {
            base: AppBase::new(self.base, handle),
            transcryptor_url: self.transcryptor_url,
            auths_url: self.auths_url,
            hubs: self.hubs,
            master_enc_key_part: self.master_enc_key_part,
            attr_id_secret: self.attr_id_secret,
            auth_token_secret: self.auth_token_secret,
            auth_token_validity: self.auth_token_validity,
            user_object_hmac_secret: self.user_object_hmac_secret,
            quota: self.quota,
        }
    }

    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        let mut hubs: crate::map::Map<hub::BasicInfo> = Default::default();

        let xconf = &config.phc.as_ref().unwrap();

        for basic_hub_info in xconf.hubs.iter() {
            if let Some(hub_or_id) = hubs.insert_new(basic_hub_info.clone()) {
                anyhow::bail!("two hubs are known as {hub_or_id}");
            }
        }

        let master_enc_key_part: elgamal::PrivateKey = xconf
            .master_enc_key_part
            .clone()
            .expect("master_enc_key_part not generated");

        let base = AppCreatorBase::<Server>::new(config)?;

        let auth_token_secret: crypto::SealingKey = base
            .enc_key
            .derive_sealing_key(sha2::Sha256::new(), "pubhubs-phc-auth-token-secret");

        Ok(Self {
            base,
            transcryptor_url: xconf.transcryptor_url.as_ref().clone(),
            auths_url: xconf.auths_url.as_ref().clone(),
            hubs,
            master_enc_key_part,
            attr_id_secret: <serde_bytes::ByteBuf as Clone>::clone(
                xconf
                    .attr_id_secret
                    .as_ref()
                    .expect("attr_id_secret was not initialized"),
            )
            .into_vec()
            .into_boxed_slice(),
            auth_token_secret,
            auth_token_validity: xconf.auth_token_validity,
            user_object_hmac_secret: <serde_bytes::ByteBuf as Clone>::clone(
                xconf
                    .user_object_hmac_secret
                    .as_ref()
                    .expect("user_object_hmac_secret was not initialized"),
            )
            .into_vec()
            .into_boxed_slice(),
            quota: xconf.user_quota.clone(),
        })
    }
}
