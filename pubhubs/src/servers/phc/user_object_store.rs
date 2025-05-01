//! Object store pubhubs offers to users
use std::rc::Rc;

use super::server::*;
use crate::api::phc::user::*;

use crate::api;
use crate::handle;
use crate::misc::serde_ext::bytes_wrapper::B64UU;

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
        path: actix_web::web::Path<(handle::Handle, B64UU)>,
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
        overwrite_hash: Option<B64UU>,
        auth_token: AuthToken,
    ) -> api::Result<StoreObjectResp> {
        todo! {}
    }
}

/// Details about an object stored by a user at pubhubs central
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct UserObjectDetails {
    /// To make sure a user does not exceed their quotum
    pub size: u32,

    /// The sha256 digest of the stored object
    pub hash: B64UU,
}
