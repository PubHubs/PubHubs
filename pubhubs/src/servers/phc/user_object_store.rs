//! User object store endpoints
use std::rc::Rc;

use anyhow::Context as _;
use bytes::BufMut as _;
use digest::Digest as _;

use super::user::UserState;
use crate::id::Id;

use crate::api;
use crate::handle;

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

        let (user_state, _user_state_version) = self
            .get_object::<UserState>(&user_id)
            .await?
            .ok_or_else(|| {
                log::error!(
                    "auth token refers to non- (or no longer) existing user with id {user_id}",
                );
                api::ErrorCode::InternalError
            })?;

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
        } else {
            // client expects no object to exist
            if user_state.stored_objects.contains_key(&handle) {
                return Ok(StoreObjectResp::MissingHash);
            }
        }

        let _obj = UserObject::new(payload, user_id);

        todo! {}
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
pub(crate) struct UserObjectDetails {
    /// To make sure a user does not exceed their quotum
    pub size: u32,

    /// The sha256 digest of the stored object
    pub id: Id,
}
