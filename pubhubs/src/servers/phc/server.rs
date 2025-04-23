use std::collections::HashMap;
use std::ops::{Deref, DerefMut};
use std::rc::Rc;

use actix_web::web;

use crate::api::phc::user::{EnterMode, EnterResp};
use crate::api::{self, ApiResultExt as _, EndpointDetails as _};
use crate::attr::{self, Attr, AttrState};
use crate::client;
use crate::handle;
use crate::id::{self, Id};
use crate::misc::jwt;
use crate::phcrypto;
use crate::servers::{self, constellation, AppBase, AppCreatorBase, Constellation, Handle};

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
    base: AppBase<Server>,
    transcryptor_url: url::Url,
    auths_url: url::Url,
    hubs: crate::map::Map<hub::BasicInfo>,
    master_enc_key_part: elgamal::PrivateKey,
    attr_id_secret: Box<[u8]>,
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
    t_ss: elgamal::SharedSecret,

    /// Shared secret with authentication server
    #[expect(dead_code)]
    auths_ss: elgamal::SharedSecret,

    /// Key used to sign [`Attr`]s, shared with the authentication server
    attr_signing_key: jwt::HS256,
}

impl crate::servers::App<Server> for App {
    fn configure_actix_app(self: &Rc<Self>, sc: &mut web::ServiceConfig) {
        api::phc::hub::TicketEP::add_to(self, sc, App::handle_hub_ticket);
        api::phct::hub::Key::add_to(self, sc, App::handle_hub_key);
        api::phc::user::WelcomeEP::caching_add_to(self, sc, App::cached_handle_user_welcome);
        api::phc::user::EnterEP::add_to(self, sc, App::handle_user_enter);
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
            js.spawn_local(self.client.query::<api::DiscoveryRun>(&url, &()));
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
            js.spawn_local(self.client.query::<api::DiscoveryRun>(&url, &()));
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
            .query::<api::DiscoveryInfo>(url, &())
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

    async fn handle_hub_ticket(
        app: Rc<Self>,
        signed_req: web::Json<api::Signed<api::phc::hub::TicketReq>>,
    ) -> api::Result<api::Signed<api::phc::hub::TicketContent>> {
        let signed_req = signed_req.into_inner();

        let req = signed_req.clone().open_without_checking_signature()?;

        let hub = app
            .hubs
            .get(&req.handle)
            .ok_or(api::ErrorCode::UnknownHub)?;

        let resp = app
            .client
            .query::<api::hub::Info>(&hub.info_url, &())
            .await
            .into_server_result()?;

        // check that the request indeed came from the hub
        signed_req
            .old_open(&*resp.verifying_key)
            .inspect_err(|ec| {
                log::warn!(
                    "could not verify authenticity of hub ticket request for hub {}: {ec}",
                    req.handle,
                )
            })?;

        // if so, hand out ticket
        api::Signed::new(
            &*app.jwt_key,
            &api::phc::hub::TicketContent {
                handle: req.handle,
                verifying_key: resp.verifying_key,
            },
            std::time::Duration::from_secs(3600 * 24), /* = one day */
        )
    }

    async fn handle_hub_key(
        app: Rc<Self>,
        signed_req: web::Json<api::phc::hub::TicketSigned<api::phct::hub::KeyReq>>,
    ) -> api::Result<api::phct::hub::KeyResp> {
        let running_state = &app.running_state_or_not_yet_ready()?;

        let ts_req = signed_req.into_inner();

        let ticket_digest = phcrypto::TicketDigest::new(&ts_req.ticket);

        let (_, _): (api::phct::hub::KeyReq, handle::Handle) =
            ts_req.open(&app.jwt_key.verifying_key())?;

        // At this point we can be confident that the ticket is authentic, so we can give the hub
        // its decryption key based on the provided ticket

        let key_part: curve25519_dalek::Scalar = phcrypto::phc_hub_key_part(
            ticket_digest,
            &running_state.t_ss, // shared secret with transcryptor
            &app.master_enc_key_part,
        );

        Ok(api::phct::hub::KeyResp { key_part })
    }

    fn cached_handle_user_welcome(app: &Self) -> api::Result<api::phc::user::WelcomeResp> {
        let running_state = app.running_state_or_not_yet_ready()?;

        let hubs: HashMap<handle::Handle, hub::BasicInfo> = app
            .hubs
            .values()
            .map(|hub| (hub.handles.preferred().clone(), hub.clone()))
            .collect();

        Ok(api::phc::user::WelcomeResp {
            constellation: (*running_state.constellation).clone(),
            hubs,
        })
    }

    async fn handle_user_enter(
        app: Rc<Self>,
        req: web::Json<api::phc::user::EnterReq>,
    ) -> api::Result<EnterResp> {
        let running_state = &app.running_state_or_not_yet_ready()?;

        let api::phc::user::EnterReq {
            identifying_attr,
            mode,
            add_attrs,
        } = req.into_inner();

        // Check attributes are valid
        let identifying_attr =
            app.id_attr(identifying_attr.old_open(&running_state.attr_signing_key)?);

        if !identifying_attr.identifying {
            log::debug!(
                "supposed attribute {} of type {} is not identifying",
                identifying_attr.value,
                identifying_attr.attr_type
            );
            return Err(api::ErrorCode::BadRequest);
        }

        let mut add_attrs: Vec<IdedAttr> = {
            let mut new_add_attrs: Vec<IdedAttr> = Vec::with_capacity(add_attrs.len());

            for add_attr in add_attrs {
                new_add_attrs
                    .push(app.id_attr(add_attr.old_open(&running_state.attr_signing_key)?));
            }

            new_add_attrs
        };

        let mut attr_states: std::collections::HashMap<
            Id,
            (AttrState, object_store::UpdateVersion),
        > = Default::default();

        // Attributes are fine, check if we have a user account
        let (user_state, user_state_v) = 'found_user: {
            if matches!(mode, EnterMode::Login | EnterMode::LoginOrRegister) {
                // see if account exists
                if let Some((ias, ias_v)) =
                    app.get_object::<AttrState>(&identifying_attr.id).await?
                {
                    log::trace!(
                        "enter: account exists for attribute {} of type {}",
                        identifying_attr.value,
                        identifying_attr.attr_type,
                    );

                    let user_id = ias.may_identify_user.ok_or_else(|| {
                        log::error!(
                            "identifying attribute {} of type {} has may_identify_user set to None",
                            identifying_attr.value,
                            identifying_attr.attr_type
                        );
                        api::ErrorCode::InternalError
                    })?;

                    attr_states.insert(identifying_attr.id, (ias, ias_v));

                    let user_and_version = app
                        .get_object::<UserState>(&user_id)
                        .await?
                        .ok_or_else(|| {
                            log::error!(
                                "identifying attribute {} of type {} refers to a user \
                            account {user_id} that does not exist",
                                identifying_attr.value,
                                identifying_attr.attr_type
                            );
                            api::ErrorCode::InternalError
                        })?;

                    break 'found_user user_and_version;
                }

                log::trace!(
                    "enter: no account exists for attribute {} of type {}",
                    identifying_attr.value,
                    identifying_attr.attr_type,
                );
            }

            if mode == EnterMode::Login {
                return Ok(EnterResp::AccountDoesNotExist);
            }

            assert!(matches!(
                mode,
                EnterMode::LoginOrRegister | EnterMode::Register
            ));

            if let Some(resp) = app
                .precheck_attrs_for_registration(
                    std::iter::once(&identifying_attr).chain(add_attrs.iter()),
                )
                .await?
            {
                return Ok(resp);
            }

            let new_user_id = Id::random();

            // we need to be careful with the order of things here lest we leave the object
            // store in a broken state.
            //
            //  1. Add the user account object.  If this fails, the client just needs to register
            //     again.
            //
            //  2. Add the identifying attribute pointing to the user account.  If this fails, the
            //     client can always register again, and we're only left with an orphaned account.
            //
            //  3. Add the other attributes.  If this fails the user can always add the attributes
            //     again using the identifying attribute already registered.
            //

            todo! {}
        };

        // add the missing attributes
        todo! {}
    }

    /// Computes and caches the [`Id`] of an [`Attr`].
    fn id_attr(&self, attr: Attr) -> IdedAttr {
        IdedAttr {
            id: attr.id(&*self.attr_id_secret),
            attr: attr,
        }
    }

    /// Pre-checks whether the given attributes permit registration of a new user account
    ///
    /// Returns `Ok(None)` when there are no issues.
    ///
    /// The situation can, of course, change between the time of the check and the time of
    /// registration.
    async fn precheck_attrs_for_registration(
        &self,
        attrs: impl Iterator<Item = &IdedAttr> + Clone,
    ) -> api::Result<Option<EnterResp>> {
        // Before doing potentially expensive queries to the object store, make sure a bannable
        // attribute has been provided by the client
        if !attrs.clone().any(|attr| attr.bannable) {
            return Ok(Some(EnterResp::NoBannableAttribute));
        }

        // TODO: parallelize?
        for attr in attrs {
            if let Some((attr_state, _)) = self.get_object::<AttrState>(&attr.id).await? {
                if attr_state.banned {
                    return Ok(Some(EnterResp::AttributeBanned(attr.attr.clone())));
                }

                if attr_state.may_identify_user.is_some() {
                    return Ok(Some(EnterResp::AttributeAlreadyTaken(attr.attr.clone())));
                }
            }
        }

        Ok(None)
    }
}

/// An [`Attr`] with its [`Id`].
struct IdedAttr {
    id: Id,
    attr: Attr,
}

impl IdedAttr {
    #[expect(dead_code)]
    pub fn id(&self) -> Id {
        unimplemented!("use the field `id` instead")
    }
}

impl Deref for IdedAttr {
    type Target = Attr;

    fn deref(&self) -> &Attr {
        &self.attr
    }
}

#[derive(Clone)]
pub struct AppCreator {
    base: AppCreatorBase<Server>,
    transcryptor_url: url::Url,
    auths_url: url::Url,
    hubs: crate::map::Map<hub::BasicInfo>,
    master_enc_key_part: elgamal::PrivateKey,
    attr_id_secret: Box<[u8]>,
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

        Ok(Self {
            base: AppCreatorBase::<Server>::new(config)?,
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
        })
    }
}

/// Details pubhubs central stores about a user's account
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct UserState {
    /// Randomly generated identifier for this account
    pub id: Id,

    /// Whether this account is banned
    pub banned: bool,

    /// Attributes that may be used to log in as this user,
    /// provided that [`attr::AttrState.may_identify_user`] also points to this account.
    ///
    /// The user may remove an attribute from this list.
    pub allow_login_by: std::collections::HashSet<Id>,

    /// Attributes that when banned will ban this user
    ///
    /// The user can only add attributes to this list, but not remove them.
    ///
    /// This list is used to keep track of whether there is at least one attribute that would
    /// ban this user.  If there are none, the user must add a bannable attribute before they can
    /// login in.
    pub could_be_banned_by: Vec<Id>,
}
