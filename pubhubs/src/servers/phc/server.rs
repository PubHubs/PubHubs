//! Basic server [`Details`]: [`Server`], [`App`], etc.
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::convert::Infallible;
use std::ops::{Deref, DerefMut};
use std::rc::Rc;

use actix_web::web;
use digest::Digest as _;

use crate::api::{self, ApiResultExt as _, EndpointDetails as _, NoPayload};
use crate::client;
use crate::common::secret::DigestibleSecret as _;
use crate::handle;
use crate::misc::crypto;
use crate::misc::jwt;
use crate::misc::serde_ext;
use crate::misc::time_ext;
use crate::phcrypto;
use crate::servers::{
    self, AppBase, AppCreatorBase, Constellation, DiscoverVerdict, Handle, Server as _,
    constellation,
};

use crate::{elgamal, hub};

/// PubHubs Central server
pub type Server = servers::ServerImpl<Details>;

pub struct Details;
impl servers::Details for Details {
    const NAME: servers::Name = servers::Name::PubhubsCentral;
    type AppT = App;
    type AppCreatorT = AppCreator;
    type ExtraRunningState = ExtraRunningState;
    type ExtraSharedState = ExtraSharedState;
    type ObjectStoreT = servers::object_store::DefaultObjectStore;

    fn create_running_state(
        server: &Server,
        constellation: &Constellation,
    ) -> anyhow::Result<Self::ExtraRunningState> {
        let auths_ss = server.enc_key.shared_secret(&constellation.auths_enc_key);
        let t_ss = server
            .enc_key
            .shared_secret(&constellation.transcryptor_enc_key);
        Ok(ExtraRunningState {
            attr_signing_key: phcrypto::attr_signing_key(&auths_ss),
            t_sealing_secret: phcrypto::sealing_secret(&t_ss),
            auths_sealing_secret: phcrypto::sealing_secret(&auths_ss),
            auths_ss,
            t_ss,
        })
    }

    fn create_extra_shared_state(_config: &servers::Config) -> anyhow::Result<ExtraSharedState> {
        Ok(ExtraSharedState {})
    }
}

pub struct ExtraSharedState {}

pub struct App {
    pub base: AppBase<Server>,
    pub transcryptor_url: url::Url,
    pub auths_url: url::Url,
    pub global_client_url: url::Url,
    pub hubs: crate::map::Map<hub::BasicInfo>,
    pub master_enc_key_part: elgamal::PrivateKey,
    pub attr_id_secret: Box<[u8]>,
    pub auth_token_secret: crypto::SealingKey,
    pub auth_token_validity: core::time::Duration,
    pub pp_nonce_secret: crypto::SealingKey,
    pub pp_nonce_validity: core::time::Duration,
    pub user_object_hmac_secret: Box<[u8]>,
    pub quota: api::phc::user::Quota,
    pub card_pseud_validity: core::time::Duration,

    /// channel for sending messages between apps
    pub broadcast: tokio::sync::broadcast::Sender<InterAppMsg>,

    pub cached_hub_info: std::cell::RefCell<api::CachedResponse<api::phc::user::CachedHubInfoEP>>,
    pub hub_cache_config: HubCacheConfig,
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

    /// Key used to (un)seal messages to and from the transcryptor
    pub(super) t_sealing_secret: crypto::SealingKey,

    /// Key used to (un)seal messages to and from the authentication server
    #[expect(dead_code)]
    pub(super) auths_sealing_secret: crypto::SealingKey,
}

impl crate::servers::App<Server> for App {
    fn configure_actix_app(self: &Rc<Self>, sc: &mut web::ServiceConfig) {
        api::phc::hub::TicketEP::add_to(self, sc, App::handle_hub_ticket);
        api::phct::hub::KeyEP::add_to(self, sc, App::handle_hub_key);

        api::phc::user::WelcomeEP::caching_add_to(self, sc, App::cached_handle_user_welcome);
        api::phc::user::EnterEP::add_to(self, sc, App::handle_user_enter);
        api::phc::user::RefreshEP::add_to(self, sc, App::handle_user_refresh);
        api::phc::user::StateEP::add_to(self, sc, App::handle_user_state);

        api::phc::user::NewObjectEP::add_to(self, sc, App::handle_user_new_object);
        api::phc::user::OverwriteObjectEP::add_to(self, sc, App::handle_user_overwrite_object);
        api::phc::user::GetObjectEP::add_to(self, sc, App::handle_user_get_object);

        api::phc::user::PppEP::add_to(self, sc, App::handle_user_ppp);
        api::phc::user::HhppEP::add_to(self, sc, App::handle_user_hhpp);

        api::phc::user::CardPseudEP::add_to(self, sc, App::handle_user_card_pseud);

        // We add the following endpoint manually, for efficiency
        sc.app_data(web::Data::new(self.clone())).route(
            api::phc::user::CachedHubInfoEP::PATH,
            web::method(api::phc::user::CachedHubInfoEP::METHOD).to(App::handle_cached_hub_info),
        );
    }

    fn check_constellation(&self, _constellation: &Constellation) -> bool {
        panic!("PHC creates the constellation; it has no need to check it")
    }

    async fn discover(
        self: &Rc<Self>,
        _phc_di: api::DiscoveryInfoResp,
    ) -> api::Result<DiscoverVerdict> {
        let (tdi_res, asdi_res) = tokio::join!(
            self.discovery_info_of(servers::Name::Transcryptor, &self.transcryptor_url),
            self.discovery_info_of(servers::Name::AuthenticationServer, &self.auths_url)
        );

        let tdi = tdi_res?;
        let asdi = asdi_res?;

        for (odi, other_server_name) in [
            (&tdi, servers::Name::Transcryptor),
            (&asdi, servers::Name::AuthenticationServer),
        ] {
            if let Some(ref other_version) = odi.version
                && let Some(my_version) = &self.version
            {
                let other_version = crate::servers::version::to_semver(other_version).map_err(|err| {
                    log::error!(
                        "{my_server_name}: could not parse semantic version returned by {other_server_name}: {other_version}: {err}",
                        my_server_name = Server::NAME
                    );
                    api::ErrorCode::InternalError
                })?;

                let my_version = crate::servers::version::to_semver(my_version).map_err(|err| {
                    log::error!(
                        "{my_server_name}: could not parse my semantic version {my_version}: {err}",
                        my_server_name = Server::NAME
                    );
                    api::ErrorCode::InternalError
                })?;

                if my_version < other_version {
                    log::warn!(
                        "{my_server_name}: {other_server_name}'s version ({other_version}) > my version ({my_version})",
                        my_server_name = Server::NAME,
                    );
                    return Ok(DiscoverVerdict::BinaryOutdated);
                }
            } else {
                log::warn!(
                    "{my_server_name}: not checking my version ({my_version}) against {other_server_name}'s version ({other_version})",
                    my_server_name = Server::NAME,
                    my_version = crate::servers::version::VERSION,
                    other_version = odi.version.as_deref().unwrap_or("n/a")
                );
            }
        }

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
            global_client_url: self.global_client_url.clone(),
            phc_url: self.phc_url.clone(),
            phc_jwt_key: self.jwt_key.verifying_key().into(),
            phc_enc_key: self.enc_key.public_key().clone(),
            transcryptor_url: self.transcryptor_url.clone(),
            transcryptor_jwt_key: tdi.jwt_key,
            transcryptor_enc_key: tdi.enc_key,
            auths_url: self.auths_url.clone(),
            auths_jwt_key: asdi.jwt_key,
            auths_enc_key: asdi.enc_key,
            ph_version: self.version.clone(),
        };

        if self.running_state.is_none()
            || self.running_state.as_ref().unwrap().constellation.inner != new_constellation_inner
        {
            let new_constellation_id = constellation::Inner::derive_id(&new_constellation_inner);

            if let Some(ref running_state) = self.running_state {
                log::info!(
                    "Detected change in constellation {} -> {}",
                    running_state.constellation.id,
                    new_constellation_id
                );
            } else {
                log::info!("Computed constellation {new_constellation_id}");
            }

            return Ok(DiscoverVerdict::ConstellationOutdated {
                new_constellation: Box::new(Constellation {
                    id: new_constellation_id,
                    created_at: api::NumericDate::now(),
                    inner: new_constellation_inner,
                }),
            });
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
                    Ok(DiscoverVerdict::Alright)
                } else {
                    log::info!("Waiting for the other servers to update their constellation.");
                    Err(api::ErrorCode::PleaseRetry)
                }
            }
            // a task ended irregularly (panicked, joined,...)
            Some(Err(join_err)) => {
                log::error!("discovery run task joined unexpectedly: {join_err}");
                Err(api::ErrorCode::InternalError)
            }
            // we got a result from one of the tasks..
            Some(Ok(res)) => {
                match res.retryable() {
                    Ok(_) => {
                        // the discovery task was completed succesfully, or made some progress,
                        // or we got a retryable error.
                        // In all these cases the caller should try again.
                        Err(api::ErrorCode::PleaseRetry)
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

    async fn local_task(weak: std::rc::Weak<Self>) {
        use tokio::sync::broadcast::error::RecvError;

        let mut receiver: tokio::sync::broadcast::Receiver<InterAppMsg>;

        {
            let Some(app) = weak.upgrade() else {
                log::debug!("App is gone before local task started");
                return;
            };

            receiver = app.broadcast.subscribe();
        }

        loop {
            let recv_result = receiver.recv().await;
            let Ok(msg) = recv_result else {
                match recv_result.unwrap_err() {
                    RecvError::Closed => {
                        return;
                    }
                    RecvError::Lagged(skipped) => {
                        log::error!(
                            "PHC local task on {:?} is lagging behind, \
                            and has skipped processing {skipped} messages!",
                            std::thread::current().id()
                        );
                        continue;
                    }
                }
            };

            let Some(app) = weak.upgrade() else {
                log::warn!("Inter app message dropped because app is gone");
                return;
            };

            match msg {
                InterAppMsg::UpdatedHubInfo(cached_hub_info) => {
                    app.cached_hub_info.replace(cached_hub_info);
                }
            }
        }
    }

    async fn global_task(app: Rc<Self>) -> anyhow::Result<Infallible> {
        let localset = tokio::task::LocalSet::new();
        let _hcu = HubCacheUpdater::new(app, &localset);

        localset.await;

        log::error!("bug: PHC global task  exits prematurely");
        anyhow::bail!("bug: PHC global task exits prematurely")
    }
}

/// Configures [`HubCacheUpdater`].
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct HubCacheConfig {
    /// Query [`api::hub::InfoEP`] this often
    #[serde(with = "time_ext::human_duration")]
    #[serde(default = "default_hub_cache_request_interval")]
    request_interval: core::time::Duration,

    /// The request to [`api::hub::InfoEP`] times out after this amount of time
    #[serde(with = "time_ext::human_duration")]
    #[serde(default = "default_hub_cache_request_timeout")]
    request_timeout: core::time::Duration,

    /// Push a new version of the cache to [`App`] instances this often
    #[serde(with = "time_ext::human_duration")]
    #[serde(default = "default_hub_cache_push_interval")]
    push_interval: core::time::Duration,
}

fn default_hub_cache_request_interval() -> core::time::Duration {
    core::time::Duration::from_secs(60)
}

fn default_hub_cache_request_timeout() -> core::time::Duration {
    core::time::Duration::from_secs(10)
}

fn default_hub_cache_push_interval() -> core::time::Duration {
    core::time::Duration::from_secs(5)
}

impl Default for HubCacheConfig {
    fn default() -> Self {
        serde_ext::default_object()
    }
}

struct HubCacheUpdater {
    app: Rc<App>,
    hub_info: RefCell<HashMap<handle::Handle, Option<api::hub::InfoResp>>>,
    unpublished_updates: Cell<bool>,
}

impl HubCacheUpdater {
    fn new(app: Rc<App>, localset: &tokio::task::LocalSet) -> Rc<Self> {
        let hcu = Rc::new(Self {
            app: app.clone(),
            hub_info: RefCell::new(Default::default()),
            unpublished_updates: Cell::new(false),
        });

        for basic_hub_info in app.hubs.values() {
            localset.spawn_local(hcu.clone().handle_hub(basic_hub_info.clone()));
        }

        localset.spawn_local(hcu.clone().push_updates());

        hcu
    }

    async fn handle_hub(self: Rc<Self>, basic_hub_info: hub::BasicInfo) {
        let hub_handle = basic_hub_info.handles.preferred();

        self.hub_info.borrow_mut().insert(hub_handle.clone(), None);

        let mut interval = tokio::time::interval(self.app.hub_cache_config.request_interval);
        let mut failure_since: Option<std::time::SystemTime> = None;

        loop {
            interval.tick().await;

            let hir = self
                .app
                .client
                .query::<api::hub::InfoEP>(&basic_hub_info.url, api::NoPayload)
                .quiet()
                .timeout(self.app.hub_cache_config.request_timeout)
                .await;

            let Ok(hi) = hir else {
                if failure_since.is_none() {
                    log::warn!("hub {hub_handle} not reachable");
                    failure_since = Some(std::time::SystemTime::now());
                }

                continue;
            };

            if let Some(time) = failure_since.take() {
                log::info!(
                    "hub {hub_handle} is reachable again;  it was unreachable since {}.)",
                    time_ext::format_time(time)
                );
            }

            use std::collections::hash_map::Entry;

            {
                let mut hub_info = self.hub_info.borrow_mut();

                let Entry::Occupied(mut oe) = hub_info.entry(hub_handle.clone()) else {
                    panic!("bug: hub info cache entry for hub {hub_handle} disappeared");
                };

                if oe.get().as_ref() == Some(&hi) {
                    continue;
                }

                oe.insert(Some(hi));
            }

            if !self.unpublished_updates.replace(true) {
                log::trace!("new hub info on {hub_handle} will be pushed to app soon");
            }
        }
    }

    async fn push_updates(self: Rc<Self>) {
        let mut interval = tokio::time::interval(self.app.hub_cache_config.push_interval);

        loop {
            interval.tick().await;

            if !self.unpublished_updates.get() {
                continue;
            }

            let chir = api::phc::user::CachedHubInfoResp {
                hubs: self.hub_info.borrow().clone(),
            };

            let cr = api::Responder(Ok(chir)).into_cached();

            log::trace!("pushing updated cached hub info to apps");
            if self
                .app
                .broadcast
                .send(InterAppMsg::UpdatedHubInfo(cr))
                .is_err()
            {
                log::error!("failed to internally broadcast updated hub information");
                continue;
            };

            self.unpublished_updates.set(false);
        }
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
    pub global_client_url: url::Url,
    pub hubs: crate::map::Map<hub::BasicInfo>,
    pub master_enc_key_part: elgamal::PrivateKey,
    pub attr_id_secret: Box<[u8]>,
    pub auth_token_secret: crypto::SealingKey,
    pub auth_token_validity: core::time::Duration,
    pub pp_nonce_secret: crypto::SealingKey,
    pub pp_nonce_validity: core::time::Duration,
    pub user_object_hmac_secret: Box<[u8]>,
    pub quota: api::phc::user::Quota,
    pub card_pseud_validity: core::time::Duration,
    pub hub_cache_config: HubCacheConfig,
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

#[derive(Clone)]
pub struct AppCreatorContext {
    broadcast: tokio::sync::broadcast::Sender<InterAppMsg>,
}

impl Default for AppCreatorContext {
    fn default() -> Self {
        Self {
            broadcast: tokio::sync::broadcast::Sender::<InterAppMsg>::new(10),
        }
    }
}

impl crate::servers::AppCreator<Server> for AppCreator {
    type ContextT = AppCreatorContext;

    fn into_app(self, handle: &Handle<Server>, context: &Self::ContextT, generation: usize) -> App {
        App {
            base: AppBase::new(self.base, handle, generation),
            transcryptor_url: self.transcryptor_url,
            auths_url: self.auths_url,
            global_client_url: self.global_client_url,
            hubs: self.hubs,
            master_enc_key_part: self.master_enc_key_part,
            attr_id_secret: self.attr_id_secret,
            auth_token_secret: self.auth_token_secret,
            auth_token_validity: self.auth_token_validity,
            pp_nonce_secret: self.pp_nonce_secret,
            pp_nonce_validity: self.pp_nonce_validity,
            user_object_hmac_secret: self.user_object_hmac_secret,
            quota: self.quota,
            card_pseud_validity: self.card_pseud_validity,
            broadcast: context.broadcast.clone(),
            // cached_hub_info will be set later
            cached_hub_info: std::cell::RefCell::new(
                api::Responder(Err(api::ErrorCode::PleaseRetry)).into_cached(),
            ),
            hub_cache_config: self.hub_cache_config,
        }
    }

    fn new(config: &servers::Config) -> anyhow::Result<Self> {
        let mut hubs: crate::map::Map<hub::BasicInfo> = Default::default();

        let xconf = &config.phc.as_ref().unwrap();

        for basic_hub_info in xconf.hubs.iter() {
            if let Some(hub_or_id) = hubs.insert_new(basic_hub_info.clone().into()) {
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

        let pp_nonce_secret: crypto::SealingKey = base
            .enc_key
            .derive_sealing_key(sha2::Sha256::new(), "pubhubs-pp-nonce-secret");

        Ok(Self {
            base,
            transcryptor_url: xconf.transcryptor_url.as_ref().clone(),
            auths_url: xconf.auths_url.as_ref().clone(),
            global_client_url: xconf.global_client_url.as_ref().clone(),
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
            pp_nonce_secret,
            pp_nonce_validity: xconf.pp_nonce_validity,
            user_object_hmac_secret: <serde_bytes::ByteBuf as Clone>::clone(
                xconf
                    .user_object_hmac_secret
                    .as_ref()
                    .expect("user_object_hmac_secret was not initialized"),
            )
            .into_vec()
            .into_boxed_slice(),
            quota: xconf.user_quota.clone(),
            card_pseud_validity: xconf.card_pseud_validity,
            hub_cache_config: xconf.hub_cache.clone(),
        })
    }
}

/// Message sent between [`App`] instances accross threads
#[derive(Clone, Debug)]
pub(crate) enum InterAppMsg {
    UpdatedHubInfo(api::CachedResponse<api::phc::user::CachedHubInfoEP>),
}
