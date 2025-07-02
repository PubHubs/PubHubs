//! Basic user endpoints, such as [`EnterEP`].
use std::collections::{HashMap, HashSet};
use std::ops::Deref;
use std::rc::Rc;

use crate::api;
use crate::api::OpenError;
use crate::attr::{Attr, AttrState};
use crate::common::elgamal;
use crate::handle;
use crate::hub;
use crate::id::Id;
use crate::misc::crypto;
use crate::misc::error::{OPAQUE, Opaque};
use crate::misc::jwt;

use actix_web::web;

use super::server::*;
use api::phc::user::*;

use api::phc::user::UserState as ApiUserState;

impl App {
    /// Implements [`WelcomeEP`]
    pub(super) fn cached_handle_user_welcome(app: &Self) -> api::Result<WelcomeResp> {
        let running_state = app.running_state_or_please_retry()?;

        let hubs: HashMap<handle::Handle, hub::BasicInfo> = app
            .hubs
            .values()
            .map(|hub| (hub.handles.preferred().clone(), hub.clone()))
            .collect();

        Ok(WelcomeResp {
            constellation: (*running_state.constellation).clone(),
            hubs,
        })
    }

    /// Implements [`StateEP`]
    pub(super) async fn handle_user_state(
        app: Rc<Self>,
        auth_token: actix_web::web::Header<AuthToken>,
    ) -> api::Result<StateResp> {
        let Ok((user_state, _)) = app
            .open_auth_token_and_get_user_state(auth_token.into_inner())
            .await?
        else {
            return Ok(StateResp::RetryWithNewAuthToken);
        };

        Ok(StateResp::State(user_state.into_user_version(&app)))
    }

    /// Implements [`EnterEP`]
    pub(super) async fn handle_user_enter(
        app: Rc<Self>,
        req: web::Json<EnterReq>,
    ) -> api::Result<EnterResp> {
        let running_state = &app.running_state_or_please_retry()?;

        let EnterReq {
            identifying_attr,
            mode,
            add_attrs,
        } = req.into_inner();

        // Check attributes are valid
        let identifying_attr = app.id_attr(
            match identifying_attr.open(&running_state.attr_signing_key, None) {
                Ok(identifying_attr) => identifying_attr,
                Err(OpenError::OtherConstellation) | Err(OpenError::InternalError) => {
                    return Err(api::ErrorCode::InternalError);
                }
                Err(OpenError::OtherwiseInvalid) => {
                    return Err(api::ErrorCode::BadRequest);
                }
                Err(OpenError::Expired) | Err(OpenError::InvalidSignature) => {
                    return Ok(EnterResp::RetryWithNewIdentifyingAttr)
                }
            },
        );

        if !identifying_attr.identifying {
            log::warn!(
                "supposed attribute {} of type {} is not identifying",
                identifying_attr.value,
                identifying_attr.attr_type
            );
            return Err(api::ErrorCode::BadRequest);
        }

        let attrs: HashMap<Id, IdedAttr> = {
            let mut attrs: HashMap<Id, IdedAttr> = HashMap::with_capacity(add_attrs.len());

            attrs.insert(identifying_attr.id, identifying_attr.clone());

            for (add_attr_index, add_attr) in add_attrs.into_iter().enumerate() {
                let ided_attr =
                    app.id_attr(match add_attr.open(&running_state.attr_signing_key, None) {
                        Ok(attr) => attr,
                        Err(OpenError::OtherConstellation) | Err(OpenError::InternalError) => {
                            return Err(api::ErrorCode::InternalError);
                        }
                        Err(OpenError::OtherwiseInvalid) => {
                            return Err(api::ErrorCode::BadRequest);
                        }
                        Err(OpenError::Expired) | Err(OpenError::InvalidSignature) => {
                            return Ok(EnterResp::RetryWithNewAddAttr {
                                index: add_attr_index,
                            })
                        }
                    });

                let previous_value = attrs.insert(ided_attr.id, ided_attr);

                if let Some(attr) = previous_value {
                    log::warn!(
                        "entry: attribute {} of type {} provided twice",
                        attr.value,
                        attr.attr_type
                    );
                    return Err(api::ErrorCode::BadRequest);
                }
            }

            attrs
        };

        // will be filled while getting and putting attributes to the object store
        let mut attr_states: std::collections::HashMap<
            Id,
            (AttrState, object_store::UpdateVersion),
        > = Default::default();

        // keeps track of which attributes have already been added
        let mut attr_add_status: HashMap<Id, AttrAddStatus> = Default::default();

        // Attributes are fine, check if we have a user account
        let ((user_state, mut user_state_version), new_account) = 'found_user: {
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

                    break 'found_user (user_and_version, false);
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
                .precheck_attrs_for_registration(&attrs, &mut attr_states)
                .await?
            {
                return Ok(resp);
            }

            // we need to be careful with the order of things here lest we leave the object
            // store in a broken state.
            //
            //  1. Add the user account object.  Include the identying attributes in the user
            //     account already - they can be added later - but do not include the bannable
            //     attributes. If this fails, the client just needs to register
            //     again.
            //
            //  2. Add the identifying attribute pointing to the user account.  If this fails, the
            //     client can always register again, and we're only left with an orphaned account.
            //
            //  3. Add the other attributes.  If this fails the user can always add the attributes
            //     again using the identifying attribute already registered.
            //
            //  4. Modify the user account to register the added bannable attributes.  If this
            //     fails, the user can always re-add those bannable attributes.
            //
            //  Here, we're only doing steps 1 and 2. Steps 3 and 4 are shared with regular login.

            let user_state = UserState {
                id: Id::random(),
                polymorphic_pseudonym: running_state.constellation.master_enc_key.encrypt_random(),
                banned: false,
                allow_login_by: attrs
                    .values()
                    .filter_map(|attr| {
                        if attr.identifying {
                            Some(attr.id)
                        } else {
                            None
                        }
                    })
                    .collect(),
                could_be_banned_by: Default::default(),
                // NOTE: `could_be_banned_by` is set after the bannable attributes have been added
                stored_objects: Default::default(),
            };

            let user_state_version = app
                .put_object::<UserState>(&user_state, None)
                .await?
                .ok_or_else(|| {
                    log::error!("User with id {} already exists - very odd", user_state.id);
                    api::ErrorCode::InternalError
                })?;

            // Add identifying attribute.  We do not expect the attribute to exist, because
            // otherwise we would be logging in, not registering.
            assert!(!attr_states.contains_key(&identifying_attr.id));

            let identifying_attr_state =
                AttrState::new(identifying_attr.id, &identifying_attr, user_state.id);

            if let Some(identifying_attr_state_version) = app
                .put_object::<AttrState>(&identifying_attr_state, None)
                .await
                .inspect_err(|err| {
                    log::warn!(
                        "orphaned user account {} due to error with putting \
                        identifying attribute: {err}",
                        user_state.id
                    );
                })?
            {
                assert!(
                    attr_states
                        .insert(
                            identifying_attr.id,
                            (identifying_attr_state, identifying_attr_state_version),
                        )
                        .is_none()
                );

                assert!(
                    attr_add_status
                        .insert(identifying_attr.id, AttrAddStatus::Added)
                        .is_none()
                );
            } else {
                log::warn!(
                    "possibly orphaned user account {} because identifying \
                    attribute {} was just added before our noses",
                    user_state.id,
                    identifying_attr.id
                );
                return Ok(EnterResp::AttributeAlreadyTaken(identifying_attr.attr));
            }

            log::debug!("created user account {}", user_state.id);
            break 'found_user ((user_state, user_state_version), true);
        };

        if user_state.banned {
            return Ok(EnterResp::Banned);
        }

        // Add the missing attributes.  First the attribute states.
        for attr in attrs.values() {
            if attr_states.contains_key(&attr.id) {
                attr_add_status
                    .entry(attr.id)
                    .or_insert(AttrAddStatus::AlreadyThere);
                continue;
            }

            let attr_state = AttrState::new(attr.id, attr, user_state.id);

            match app.put_object::<AttrState>(&attr_state, None).await {
                Ok(Some(attr_state_version)) => {
                    assert!(
                        attr_states
                            .insert(attr.id, (attr_state, attr_state_version))
                            .is_none()
                    );
                    assert!(
                        attr_add_status
                            .insert(attr.id, AttrAddStatus::Added)
                            .is_none()
                    );
                }
                _ => {
                    assert!(
                        attr_add_status
                            .insert(attr.id, AttrAddStatus::PleaseTryAgain)
                            .is_none()
                    );
                }
            }
        }

        // Now check that all the bannable attributes ban this user
        for attr in attrs.values() {
            let (attr_state, attr_state_version) =
                if let Some(attr_state_and_version) = attr_states.get(&attr.id) {
                    attr_state_and_version
                } else {
                    continue;
                };

            if !attr.bannable || attr_state.bans_users.contains(&user_state.id) {
                continue;
            }

            let mut attr_state = attr_state.clone();
            assert!(attr_state.bans_users.insert(user_state.id));

            match app
                .put_object::<AttrState>(&attr_state, Some(attr_state_version.clone()))
                .await
            {
                Ok(Some(attr_state_version)) => {
                    assert!(
                        attr_states
                            .insert(attr.id, (attr_state.clone(), attr_state_version))
                            .is_none()
                    );
                    assert!(
                        attr_add_status
                            .insert(attr.id, AttrAddStatus::Added)
                            .is_none()
                    );
                }
                _ => {
                    assert!(
                        attr_add_status
                            .insert(attr.id, AttrAddStatus::PleaseTryAgain)
                            .is_none()
                    );
                }
            }
        }

        let mut new_user_state = user_state.clone();
        let mut added_attrs: HashSet<Id> = Default::default();

        // Finally check that the attributes are added to the user's account state
        for (attr_id, (attr_state, ..)) in attr_states {
            if *attr_add_status.get(&attr_id).unwrap() == AttrAddStatus::PleaseTryAgain {
                continue;
            }

            if let Some(identifies_user_id) = attr_state.may_identify_user {
                assert_eq!(identifies_user_id, user_state.id);

                if new_user_state.allow_login_by.insert(attr_id) {
                    added_attrs.insert(attr_id);
                }
            }

            if attr_state.bans_users.contains(&user_state.id)
                && new_user_state.could_be_banned_by.insert(attr_id)
            {
                added_attrs.insert(attr_id);
            }
        }

        if !added_attrs.is_empty() {
            match app
                .put_object::<UserState>(&new_user_state, Some(user_state_version))
                .await
            {
                Ok(Some(new_user_state_version)) => {
                    #[expect(unused_assignments)]
                    {
                        user_state_version = new_user_state_version;
                    }

                    for added_attr_id in added_attrs {
                        attr_add_status.insert(added_attr_id, AttrAddStatus::Added);
                    }
                }

                _ => {
                    for added_attr_id in added_attrs {
                        attr_add_status.insert(added_attr_id, AttrAddStatus::PleaseTryAgain);
                    }
                }
            }
        }
        let user_state = new_user_state;

        let auth_token = if user_state.could_be_banned_by.is_empty() {
            Err(AuthTokenDeniedReason::NoBannableAttribute)
        } else {
            let iat = jwt::NumericDate::now();
            let exp = iat + app.auth_token_validity;
            Ok(AuthTokenInner {
                user_id: user_state.id,
                iat,
                exp,
            }
            .seal(&app.auth_token_secret)?)
        };

        Ok(EnterResp::Entered {
            new_account,
            auth_token,
            attr_status: attr_add_status
                .iter()
                .map(|(attr_id, attr_add_status)| {
                    (attrs.get(attr_id).unwrap().attr.clone(), *attr_add_status)
                })
                .collect(),
        })
    }

    /// Computes and caches the [`Id`] of an [`Attr`].
    fn id_attr(&self, attr: Attr) -> IdedAttr {
        IdedAttr {
            id: attr.id(&*self.attr_id_secret),
            attr,
        }
    }

    /// Pre-checks whether the given attributes in `attrs` are suitable for
    /// registering a new user.
    ///
    /// Potential problems:
    ///  1. None of the given attributes is bannable.
    ///  2. One of the attributes is banned
    ///  3. One of the attributes already identifies another user.
    ///
    /// Will try to retrieve attribute states for attributes not already in `attr_states`,
    /// and will add those to `attr_states`.
    ///
    /// Returns `Ok(None)` when there are no issues.
    ///
    /// The situation can, of course, change between the time of the check and the time of
    /// registration.
    async fn precheck_attrs_for_registration(
        &self,
        attrs: &HashMap<Id, IdedAttr>,
        attr_states: &mut HashMap<Id, (AttrState, object_store::UpdateVersion)>,
    ) -> api::Result<Option<EnterResp>> {
        // Before doing potentially expensive queries to the object store, make sure a bannable
        // attribute has been provided by the client
        if !attrs.values().any(|attr| attr.bannable) {
            return Ok(Some(EnterResp::NoBannableAttribute));
        }

        // Retrieve attributes states in so far they are available
        for (attr_id, attr) in attrs {
            // TODO: parallelize?
            if attr_states.contains_key(attr_id) {
                continue;
            }

            if let Some(attr_state_and_version) = self.get_object::<AttrState>(attr_id).await? {
                attr_states.insert(attr.id, attr_state_and_version);
            }
        }

        for (attr_id, (attr_state, ..)) in attr_states.iter() {
            if attr_state.banned {
                return Ok(Some(EnterResp::AttributeBanned(
                    attrs.get(attr_id).unwrap().attr.clone(),
                )));
            }

            if attr_state.may_identify_user.is_some() {
                return Ok(Some(EnterResp::AttributeAlreadyTaken(
                    attrs.get(attr_id).unwrap().attr.clone(),
                )));
            }
        }

        Ok(None)
    }
}

/// Plaintext content of [`AuthToken`].
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub(super) struct AuthTokenInner {
    /// The [`Id`] of the user to whom this token has been issued.
    user_id: Id,

    /// When this token expires.
    exp: jwt::NumericDate,

    /// When this token was issued.
    iat: jwt::NumericDate,
}

impl AuthTokenInner {
    fn seal(&self, key: &crypto::SealingKey) -> api::Result<AuthToken> {
        Ok(AuthToken {
            inner: serde_bytes::ByteBuf::from(crypto::seal(&self, key, b"").map_err(|err| {
                log::warn!("failed to seal AuthTokenInner: {err}");
                api::ErrorCode::InternalError
            })?)
            .into(),
        })
    }

    fn unseal(sealed: &AuthToken, key: &crypto::SealingKey) -> Result<AuthTokenInner, Opaque> {
        crypto::unseal(&*sealed.inner, key, b"")
    }

    /// Opens this [`AuthToken`], returning the enclosed user's [`Id`].
    fn open(self) -> Result<Id, Opaque> {
        if self.exp < jwt::NumericDate::now() {
            return Err(OPAQUE);
        }

        Ok(self.user_id)
    }
}

impl App {
    /// Opens the given [`AuthToken`] returning the enclosed user's [`Id`].
    pub(super) fn open_auth_token(&self, auth_token: AuthToken) -> Result<Id, Opaque> {
        AuthTokenInner::unseal(&auth_token, &self.auth_token_secret)?.open()
    }

    /// Opens the given [`AuthToken`] and retrieve the associated [`UserState`].
    ///
    /// Returns `Ok(Err(Opaque))` when the auth token was invalid.
    pub(super) async fn open_auth_token_and_get_user_state(
        &self,
        auth_token: AuthToken,
    ) -> api::Result<Result<(UserState, object_store::UpdateVersion), Opaque>> {
        let Ok(user_id) = self.open_auth_token(auth_token) else {
            return Ok(Err(OPAQUE));
        };

        Ok(Ok(self
            .get_object::<UserState>(&user_id)
            .await?
            .ok_or_else(|| {
                log::error!(
                    "auth token refers to non- (or no longer) existing user with id {user_id}",
                );
                api::ErrorCode::InternalError
            })?))
    }
}

/// An [`Attr`] with its [`Id`].
#[derive(Clone)]
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

/// Details pubhubs central stores about a user's account
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct UserState {
    /// Randomly generated identifier for this account, used for creating access tokens and such
    pub id: Id,

    /// Randomly generated and by [`Constellation::master_enc_key`] elgamal encrypted
    /// identifier used to generate hub pseudonyms for this user.
    ///
    /// [`Constellation::master_enc_key`]: crate::servers::constellation::Inner::master_enc_key
    pub polymorphic_pseudonym: elgamal::Triple,

    /// Whether this account is banned
    pub banned: bool,

    // TODO: limit number of allow_login_by attributes
    /// Attributes that may be used to log in as this user,
    /// provided that [`AttrState::may_identify_user`] also points to this account.
    ///
    /// The user may remove an attribute from this list.
    pub allow_login_by: HashSet<Id>,

    /// Attributes that when banned will ban this user
    ///
    /// The user can only add attributes to this list, but not remove them.
    ///
    /// This list is used to keep track of whether there is at least one attribute that would
    /// ban this user.  If there are none, the user must add a bannable attribute before they can
    /// login in.
    pub could_be_banned_by: HashSet<Id>,

    /// Details about the objects stored by this user at pubhubs central
    pub stored_objects: HashMap<handle::Handle, super::user_object_store::UserObjectDetails>,
}

impl UserState {
    /// Subtract quota usage from the given [`Quota`], returning an error when a [`QuotumName`] was
    /// reached.
    pub(crate) fn update_quota(&self, mut quota: Quota) -> Result<Quota, QuotumName> {
        quota.object_count = quota
            .object_count
            .checked_sub(self.stored_objects.len().try_into().unwrap_or(u16::MAX))
            .ok_or_else(|| {
                let quotum = QuotumName::ObjectCount;
                log::warn!("user {} has reached quotum {quotum}", self.id);
                quotum
            })?;

        for sod in self.stored_objects.values() {
            quota.object_bytes_total =
                quota
                    .object_bytes_total
                    .checked_sub(sod.size)
                    .ok_or_else(|| {
                        let quotum = QuotumName::ObjectBytesTotal;
                        log::warn!("user {} has reached quotum {quotum}", self.id);
                        quotum
                    })?;
        }

        Ok(quota)
    }

    /// Turns this [`UserState`] into a [`ApiUserState`].
    pub(crate) fn into_user_version(self: UserState, app: &App) -> ApiUserState {
        ApiUserState {
            allow_login_by: self.allow_login_by,
            could_be_banned_by: self.could_be_banned_by,
            stored_objects: self
                .stored_objects
                .into_iter()
                .map(|(handle, uod)| (handle, uod.into_user_version(&app.user_object_hmac_secret)))
                .collect(),
        }
    }
}
