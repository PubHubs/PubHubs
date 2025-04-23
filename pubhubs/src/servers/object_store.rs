//! Storage backend for pubhubs servers
use std::borrow::Cow;

use anyhow::Context as _;
use object_store::ObjectStore as _;

use crate::api;
use crate::id::Id;
use crate::servers;

use crate::servers::config::ObjectStoreConfig;

/// Don't use an object store.
pub struct UseNone;

impl<'a> TryFrom<&'a Option<ObjectStoreConfig>> for UseNone {
    type Error = anyhow::Error;

    fn try_from(c: &'a Option<ObjectStoreConfig>) -> anyhow::Result<Self> {
        if c.is_none() {
            return Ok(UseNone);
        }

        anyhow::bail!("Object store configured, but this server does not use one.");
    }
}

/// A type that can provide an [`object_store::ObjectStore`] implementation.
pub trait AsObjectStore {
    type ObjectStoreT: object_store::ObjectStore + ?Sized;

    fn as_object_store(&self) -> &Self::ObjectStoreT;
}

/// The default object store we use.
pub struct DefaultObjectStore(Box<object_store::DynObjectStore>);

impl AsObjectStore for DefaultObjectStore {
    type ObjectStoreT = object_store::DynObjectStore;

    fn as_object_store(&self) -> &Self::ObjectStoreT {
        &self.0
    }
}

impl std::ops::Deref for DefaultObjectStore {
    type Target = object_store::DynObjectStore;

    fn deref(&self) -> &Self::Target {
        &*self.0
    }
}

impl<'a> TryFrom<&'a Option<ObjectStoreConfig>> for DefaultObjectStore {
    type Error = anyhow::Error;

    fn try_from(c_maybe: &'a Option<ObjectStoreConfig>) -> anyhow::Result<Self> {
        // Turn &Option<ObjectStoreConfig> into &ObjectStoreConfig,
        // by using the default value of ObjectStoreConfig if necessary
        let c: Cow<'a, ObjectStoreConfig> = match c_maybe {
            None => Cow::<'a, ObjectStoreConfig>::Owned(Default::default()),
            Some(c) => Cow::<'a, ObjectStoreConfig>::Borrowed(c),
        };

        let (os, path) = object_store::parse_url_opts(c.url.as_ref(), c.options.iter())
            .with_context(|| {
                format!(
                    "creating object store from url {} and options {}",
                    c.url,
                    serde_json::to_string(&c.options)
                        .context("error while formatting error")
                        .unwrap_or("<failed to format>".to_string())
                )
            })?;

        Ok(Self(Box::new(object_store::prefix::PrefixStore::new(
            os, path,
        ))))
    }
}

/// Details on how to store this type in the object store.
pub trait ObjectDetails: serde::Serialize + serde::de::DeserializeOwned {
    type Identifier: std::fmt::Display;

    const PREFIX: &'static str;

    fn object_id(&self) -> &Self::Identifier;

    fn path_for(id: &Self::Identifier) -> object_store::path::Path {
        std::format!("{}/{id}", Self::PREFIX).into()
    }
}

impl<S> crate::servers::AppBase<S>
where
    S::ObjectStoreT: AsObjectStore,
    S: servers::Server,
{
    /// Tries to retrieve an object of type `T` from this server's object store with the given
    /// `id`, returning `Ok(None)` if no such object exists.
    pub async fn get_object<T>(
        &self,
        id: &T::Identifier,
    ) -> api::Result<Option<(T, object_store::UpdateVersion)>>
    where
        T: ObjectDetails,
    {
        let os = self.shared.object_store.as_object_store();

        let path = T::path_for(&id);

        match os.get(&path).await {
            Ok(get_result) => {
                let version = object_store::UpdateVersion {
                    e_tag: get_result.meta.e_tag.clone(),
                    version: get_result.meta.version.clone(),
                };

                let bytes: bytes::Bytes = get_result.bytes().await.map_err(|err| {
                    log::error!(
                        "{}'s object store: unexpected error getting body of {path}: {err}",
                        S::NAME
                    );
                    api::ErrorCode::InternalError
                })?;

                Ok(Some((
                    serde_json::from_slice(&bytes).map_err(|err| {
                        log::error!(
                            "{}'s object store: could not parse object stored at {path}: {err}",
                            S::NAME
                        );
                        api::ErrorCode::InternalError
                    })?,
                    version,
                )))
            }
            Err(object_store::Error::NotFound { .. }) => Ok(None),
            // TODO: deal with timeouts
            Err(err) => Err({
                log::error!(
                    "{}'s object store: unexpected error getting {path}: {err}",
                    S::NAME
                );
                api::ErrorCode::InternalError
            }),
        }
    }

    /// Attempts to put an object of type `T` into the object store, only overwriting the object that
    /// is already present when the version of the to-be-overwritten object is passed via `update`.
    ///
    /// Returs `Ok(None)` when there is already an object present in the store with that id and
    /// type, but its version was not specified in `update`.
    ///
    /// [`get_object`]: Self::get_object
    pub async fn put_object<T>(
        &self,
        obj: T,
        update: Option<object_store::UpdateVersion>,
    ) -> api::Result<Option<object_store::UpdateVersion>>
    where
        T: ObjectDetails,
    {
        let os = self.shared.object_store.as_object_store();

        let path = T::path_for(obj.object_id());

        let bytes: bytes::Bytes = serde_json::to_vec(&obj)
            .map_err(|err| {
                log::error!(
                "{}'s object store: unexpected error encoding object to be put at {path}: {err}",
                S::NAME
            );
                api::ErrorCode::InternalError
            })?
            .into();

        match os
            .put_opts(
                &path,
                object_store::PutPayload::from_bytes(bytes),
                object_store::PutOptions {
                    mode: if let Some(ref version) = update {
                        object_store::PutMode::Update(version.clone())
                    } else {
                        object_store::PutMode::Create
                    },
                    tags: Default::default(),
                    attributes: Default::default(),
                    extensions: Default::default(),
                },
            )
            .await
        {
            Ok(put_result) => Ok(Some(object_store::UpdateVersion {
                e_tag: put_result.e_tag,
                version: put_result.version,
            })),
            Err(object_store::Error::Precondition { .. }) => {
                if update.is_some() {
                    return Ok(None);
                }
                log::error!("object store create put mode caused unexpected 'precondition' error");
                Err(api::ErrorCode::InternalError)
            }
            Err(object_store::Error::AlreadyExists { .. }) => {
                if update.is_none() {
                    return Ok(None);
                }
                log::error!(
                    "object store update put mode caused unexpected 'already exists' error"
                );
                Err(api::ErrorCode::InternalError)
            }
            Err(err) => Err({
                log::error!(
                    "{}'s object store: unexpected error putting {path}: {err}",
                    S::NAME
                );
                api::ErrorCode::InternalError
            }),
        }
    }
}

impl ObjectDetails for crate::attr::AttrState {
    type Identifier = Id;
    const PREFIX: &str = "attr";

    fn object_id(&self) -> &Id {
        &self.attr
    }
}

impl ObjectDetails for crate::servers::phc::UserState {
    type Identifier = Id;
    const PREFIX: &str = "user";

    fn object_id(&self) -> &Id {
        &self.id
    }
}
