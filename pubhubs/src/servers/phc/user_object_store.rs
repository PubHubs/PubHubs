//! User object store endpoints
use std::rc::Rc;

use anyhow::Context as _;
use bytes::BufMut as _;
use digest::Digest as _;

use super::user::UserState;
use crate::id::Id;

use crate::api;
use crate::handle;
use crate::phcrypto;

use super::server::*;
use crate::api::phc::user::*;

impl App {
    /// Implements [`NewObjectEP`]
    pub(super) async fn handle_user_new_object(
        app: Rc<Self>,
        payload: bytes::Bytes,
        path: actix_web::web::Path<(handle::Handle,)>,
        actix_web::web::Header(auth_token): actix_web::web::Header<AuthToken>,
    ) -> api::Result<StoreObjectResp> {
        let (handle,) = path.into_inner();

        app.handle_user_store_object(payload, handle, None, auth_token)
            .await
    }

    /// Implements [`api::phc::user::OverwriteObjectEP`]
    pub(super) async fn handle_user_overwrite_object(
        app: Rc<Self>,
        payload: bytes::Bytes,
        path: actix_web::web::Path<(handle::Handle, Id)>,
        actix_web::web::Header(auth_token): actix_web::web::Header<AuthToken>,
    ) -> api::Result<StoreObjectResp> {
        let (handle, overwrite_hash) = path.into_inner();

        app.handle_user_store_object(payload, handle, Some(overwrite_hash), auth_token)
            .await
    }

    /// Called by [`Self::handle_user_new_object`] and [`Self::handle_user_overwrite_object`].
    ///
    /// # Note on the implementation
    ///
    /// To add a user object we:
    ///   (1) First add the [`UserObject`] to the object store, if its not there already;
    ///   (2) Add a reference to that object in [`UserState`]; and
    ///   (3) Delete the old [`UserObject`] object, if there is any.
    ///
    /// This way, if the process fails between steps (1) and (2), the client will simply retry,
    /// and if the process fails between steps (2) and (3) we are only left with an orphaned
    /// object. (Which is not a big deal.)
    async fn handle_user_store_object(
        &self,
        payload: bytes::Bytes,
        handle: handle::Handle,
        overwrite_hash: Option<Id>,
        auth_token: AuthToken,
    ) -> api::Result<StoreObjectResp> {
        let user_id = if let Ok(user_id) = self.open_auth_token(auth_token) {
            user_id
        } else {
            return Ok(StoreObjectResp::RetryWithNewAuthToken);
        };

        let (mut user_state, user_state_version) = self
            .get_object::<UserState>(&user_id)
            .await?
            .ok_or_else(|| {
                log::error!(
                    "auth token refers to non- (or no longer) existing user with id {user_id}",
                );
                api::ErrorCode::InternalError
            })?;

        let obj = UserObject::new(payload, user_id);

        if let Some(overwrite_hash) = overwrite_hash {
            // client expects an object with `overwrite_hash` to exist; let's check this
            let existing_obj_details =
                if let Some(existing_obj_details) = user_state.stored_objects.get(&handle) {
                    existing_obj_details
                } else {
                    return Ok(StoreObjectResp::NotFound);
                };

            if existing_obj_details.id != overwrite_hash {
                return Ok(StoreObjectResp::HashDidNotMatch);
            }

            if existing_obj_details.id == obj.object_id {
                return Ok(StoreObjectResp::NoChanges);
            }
        } else {
            // client expects no object to exist
            if user_state.stored_objects.contains_key(&handle) {
                return Ok(StoreObjectResp::MissingHash);
            }
        }

        let object_details: UserObjectDetails = UserObjectDetails {
            size: obj.payload.len() as u32,
            id: obj.object_id,
        };

        // modify `user_state` locally to check quotum
        let mut existing_object_id: Option<Id> = None;

        user_state
            .stored_objects
            .entry(handle)
            .and_modify(|e| existing_object_id = Some(e.id))
            .insert_entry(object_details.clone());

        // check quota
        let _quota = match user_state.update_quota(self.quota.clone()) {
            Ok(quota) => quota,
            Err(quotum_name) => {
                return Ok(StoreObjectResp::QuotumReached(quotum_name));
            }
        };

        // Ok, everything if fine; start by putting object
        if self.put_object(&obj, None).await?.is_none() {
            log::debug!("user object {} already exists", obj.object_id);
            // might happen when updating `user_state` below fails
        }

        if self
            .put_object(&user_state, Some(user_state_version))
            .await?
            .is_none()
        {
            // someone else is changing `user_state` too
            return Ok(StoreObjectResp::PleaseRetry);
        }

        // remove previous object, if there is any
        if let Some(existing_object_id) = existing_object_id {
            match self.delete_object::<UserObject>(existing_object_id).await {
                Err(err) => {
                    log::warn!(
                        "failed to delete user object {existing_object_id} that is replaced by {}: {err:#}",
                        obj.object_id
                    );
                }
                Ok(false) => {
                    log::warn!("expected to delete {existing_object_id}, but it is already gone");
                }
                Ok(true) => { /* ok */ }
            }
        }

        Ok(StoreObjectResp::Stored {
            stored_objects: user_state
                .stored_objects
                .into_iter()
                .map(|(handle, uod)| (handle, uod.into_user_version(&self.user_object_hmac_secret)))
                .collect(),
        })
    }

    /// Implements [`GetObjectEP`].
    pub(crate) async fn handle_user_get_object(
        app: Rc<Self>,
        path: actix_web::web::Path<(Id, Id)>,
    ) -> api::Payload<api::Result<GetObjectResp>> {
        let (hash, hmac) = path.into_inner();

        if phcrypto::phc_user_object_hmac(hash, &*app.user_object_hmac_secret) != hmac {
            return api::Payload::Json(Ok(GetObjectResp::RetryWithNewHmac));
        }

        let (obj, _) = match app.get_object::<UserObject>(&hash).await {
            Ok(Some(obj)) => obj,
            Ok(None) => {
                log::debug!("user object {hash} was requested (with valid hmac), but not found");
                return api::Payload::Json(Ok(GetObjectResp::NotFound));
            }
            Err(err) => {
                return api::Payload::Json(Err(err));
            }
        };

        if obj.object_id != hash {
            log::error!(
                "user object {} submitted by user {} is corrupted!",
                hash,
                obj.user_id
            );
            return api::Payload::Json(Err(api::ErrorCode::InternalError));
        }

        api::Payload::Octets(obj.payload)
    }
}

/// Represents how an object stored for a user is stored in our object store
pub(crate) struct UserObject {
    /// So that we can change the format in the future
    version: u8,

    /// The user that uploaded this object
    user_id: Id,

    /// Actual contents of the object
    payload: bytes::Bytes,

    /// Digest of this object - not actually stored in the object itself, but cached here
    object_id: Id,
}

impl UserObject {
    fn new(payload: bytes::Bytes, user_id: Id) -> Self {
        let version = 0;
        let object_id = Self::derive_id(version, user_id, &payload);

        Self {
            version,
            user_id,
            payload,
            object_id,
        }
    }

    fn derive_id(version: u8, user_id: Id, payload: &bytes::Bytes) -> Id {
        let mut hasher = sha2::Sha256::new();

        hasher.update([version]);
        hasher.update(user_id.as_slice());
        hasher.update(payload);

        <[u8; 32]>::from(hasher.finalize()).into()
    }
}

impl crate::servers::object_store::ObjectDetails for UserObject {
    type Identifier = Id;
    const PREFIX: &str = "user-obj";

    fn object_id(&self) -> &Id {
        &self.object_id
    }

    fn from_bytes(mut bytes: bytes::Bytes) -> anyhow::Result<Self> {
        let object_id: Id = <[u8; 32]>::from(sha2::Sha256::digest(&bytes)).into();

        let version: u8 = *bytes
            .first()
            .context("missing version number byte in stored user object")?;

        if version != 0 {
            anyhow::bail!("unsupported stored user object version, {version}");
        }

        if bytes.len() < 1 + 32 {
            anyhow::bail!("stored user object header too small");
        }

        let payload = bytes.split_off(1 + 32);
        let user_id = Id::from(<[u8; 32]>::try_from(&bytes[1..33]).unwrap());

        Ok(Self {
            version,
            user_id,
            payload,
            object_id,
        })
    }

    fn to_put_payload(&self) -> anyhow::Result<object_store::PutPayload> {
        let mut header = bytes::BytesMut::with_capacity(1 + 32);
        header.put_u8(self.version);
        header.put(self.user_id.as_slice());

        Ok(vec![header.freeze(), self.payload.clone()]
            .into_iter()
            .collect())
    }
}

/// Details contained in [`UserState`] about an object stored by a user at pubhubs central
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct UserObjectDetails {
    /// To make sure a user does not exceed their quotum
    pub size: u32,

    /// The sha256 digest of the stored object
    pub id: Id,
}

impl UserObjectDetails {
    /// Turns this [`UserObjectDetails`] into a [`api::phc::user::UserObjectDetails`].
    pub(crate) fn into_user_version(self, hmac_secret: &[u8]) -> api::phc::user::UserObjectDetails {
        api::phc::user::UserObjectDetails {
            hash: self.id,
            hmac: phcrypto::phc_user_object_hmac(self.id, hmac_secret),
            size: self.size,
        }
    }
}
