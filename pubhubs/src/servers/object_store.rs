//! Storage backend for pubhubs servers
use std::borrow::Cow;

use anyhow::Context as _;
use object_store::{ObjectStore as _, ObjectStoreExt as _};

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

        let url = c.url.as_ref();

        let (scheme, path) = object_store::ObjectStoreScheme::parse(url)
            .with_context(|| format!("could not determine object store type from url {url}"))?;

        // We disabled object_store's built-in reqwest client (see Cargo.toml), so the S3 store has
        // no HTTP client unless we provide one.  `parse_url_opts` offers no way to inject a
        // connector and would fail at runtime for `s3://`, so we build the S3 store ourselves and
        // hand it our awc-based connector.  Other schemes (e.g. `memory://`) need no HTTP client
        // and keep going through `parse_url_opts`.
        let store: Box<object_store::DynObjectStore> = match scheme {
            object_store::ObjectStoreScheme::AmazonS3 => {
                let mut builder = object_store::aws::AmazonS3Builder::new()
                    .with_url(url.to_string())
                    .with_http_connector(crate::misc::awc_http_connector::AwcHttpConnector::new());

                for (key, value) in c.options.iter() {
                    match key
                        .to_ascii_lowercase()
                        .parse::<object_store::aws::AmazonS3ConfigKey>()
                    {
                        Ok(config_key) => {
                            // A client option our awc connector doesn't read back would only
                            // configure object_store's built-in HTTP client, which we replaced;
                            // reject it rather than silently ignore an admin's setting.  The honored
                            // set lives next to the connector that consumes it.
                            if let object_store::aws::AmazonS3ConfigKey::Client(client_key) =
                                &config_key
                            {
                                // `DefaultContentType` is a client key but not a transport option:
                                // object_store applies it as a `Content-Type` request header, which
                                // our connector forwards verbatim, so it works regardless of the HTTP
                                // client.  Every other client key configures the transport we replaced.
                                anyhow::ensure!(
                                    matches!(
                                        client_key,
                                        object_store::client::ClientConfigKey::DefaultContentType
                                    ) || crate::misc::awc_http_connector::ConnectorOptions::honors_client_config_key(
                                        client_key
                                    ),
                                    "object store option {key:?} configures the HTTP client, which \
                                     is not currently supported by the awc-based S3 connector"
                                );
                            }
                            builder = builder.with_config(config_key, value);
                        }
                        // object_store's own parse_url_opts silently ignores unknown keys; we warn
                        // instead, so a typo in the config surfaces.
                        Err(_) => {
                            log::warn!("ignoring unrecognized S3 object store option {key:?}")
                        }
                    }
                }

                Box::new(builder.build().with_context(|| {
                    format!(
                        "creating S3 object store from url {url} and options {}",
                        serde_json::to_string(&c.options)
                            .unwrap_or_else(|_| "<failed to format>".to_string())
                    )
                })?)
            }

            // Non-S3 object store
            _ => {
                let (store, _path) = object_store::parse_url_opts(url, c.options.iter())
                    .with_context(|| {
                        format!(
                            "creating object store from url {url} and options {}",
                            serde_json::to_string(&c.options)
                                .unwrap_or_else(|_| "<failed to format>".to_string())
                        )
                    })?;
                store
            }
        };

        Ok(Self(Box::new(object_store::prefix::PrefixStore::new(
            store, path,
        ))))
    }
}

/// Details on how to store this type in the object store.
///
/// You probably want to implement this trait via [`JsonObjectDetails`].
pub trait ObjectDetails: std::marker::Sized {
    type Identifier: std::fmt::Display;

    const PREFIX: &'static str;

    fn object_id(&self) -> &Self::Identifier;

    fn path_for(id: &Self::Identifier) -> object_store::path::Path {
        std::format!("{}/{id}", Self::PREFIX).into()
    }

    fn from_bytes(bytes: bytes::Bytes) -> anyhow::Result<Self>;

    /// Turn this object into one (or more) [`bytes::Bytes`]
    fn to_put_payload(&self) -> anyhow::Result<object_store::PutPayload>;
}

/// Default way to implement [`ObjectDetails`], via json serialization.
pub trait JsonObjectDetails: serde::Serialize + serde::de::DeserializeOwned {
    type Identifier: std::fmt::Display;

    const PREFIX: &'static str;

    fn object_id(&self) -> &Self::Identifier;
}

impl<T: JsonObjectDetails> ObjectDetails for T {
    type Identifier = <T as JsonObjectDetails>::Identifier;

    const PREFIX: &str = <T as JsonObjectDetails>::PREFIX;

    fn object_id(&self) -> &Self::Identifier {
        <T as JsonObjectDetails>::object_id(self)
    }

    fn from_bytes(bytes: bytes::Bytes) -> anyhow::Result<Self> {
        Ok(serde_json::from_slice(&bytes)?)
    }

    fn to_put_payload(&self) -> anyhow::Result<object_store::PutPayload> {
        Ok(object_store::PutPayload::from_bytes(
            serde_json::to_vec(&self)?.into(),
        ))
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

        let path = T::path_for(id);

        log::debug!("getting {path}");

        match os.get(&path).await {
            Ok(get_result) => {
                let version = object_store::UpdateVersion {
                    e_tag: get_result.meta.e_tag.clone(),
                    version: get_result.meta.version.clone(),
                };

                let bytes: bytes::Bytes = get_result.bytes().await.map_err(|err| {
                    log::error!(
                        "{}'s object store: unexpected error getting body of {path}: {err:#}",
                        S::NAME
                    );
                    api::ErrorCode::InternalError
                })?;

                log::debug!("got {path}");

                Ok(Some((
                    T::from_bytes(bytes).map_err(|err| {
                        log::error!(
                            "{}'s object store: unexpected error parsing object at {path}: {err:#}",
                            S::NAME
                        );
                        api::ErrorCode::InternalError
                    })?,
                    version,
                )))
            }
            Err(object_store::Error::NotFound { .. }) => {
                log::debug!("did not get {path}: not found");
                Ok(None)
            }
            // TODO: deal with timeouts
            Err(err) => Err({
                log::error!(
                    "{}'s object store: unexpected error getting {path}: {err:#}",
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
        obj: &T,
        update: Option<object_store::UpdateVersion>,
    ) -> api::Result<Option<object_store::UpdateVersion>>
    where
        T: ObjectDetails,
    {
        let os = self.shared.object_store.as_object_store();

        let path = T::path_for(obj.object_id());

        log::debug!("putting {path}");

        let put_payload: object_store::PutPayload = obj.to_put_payload().map_err(|err| {
            log::error!(
                "{}'s object store: unexpected error encoding object to be put at {path}: {err:#}",
                S::NAME
            );
            api::ErrorCode::InternalError
        })?;

        match os
            .put_opts(
                &path,
                put_payload,
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
            Ok(put_result) => {
                log::debug!("putting {path} succeeded");

                Ok(Some(object_store::UpdateVersion {
                    e_tag: put_result.e_tag,
                    version: put_result.version,
                }))
            }
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
                    "{}'s object store: unexpected error putting {path}: {err:#}",
                    S::NAME
                );
                api::ErrorCode::InternalError
            }),
        }
    }

    /// Attempts to delete an object with the given [`Id`]; returns `true` when an object was
    /// deleted, and false when no object with the given `id` was found.
    pub async fn delete_object<T>(&self, id: T::Identifier) -> api::Result<bool>
    where
        T: ObjectDetails,
    {
        let os = self.shared.object_store.as_object_store();

        let path = T::path_for(&id);

        log::debug!("deleting {path}");

        match os.delete(&path).await {
            Ok(()) => {
                log::debug!("deleted {path}");
                Ok(true)
            }
            Err(object_store::Error::NotFound { .. }) => {
                log::info!("deleting {path} failed: not found");
                Ok(false)
            }
            Err(err) => Err({
                log::error!(
                    "{}'s object store: failed to delete {path}: {err:#}",
                    S::NAME
                );
                api::ErrorCode::InternalError
            }),
        }
    }
}

impl JsonObjectDetails for crate::attr::AttrState {
    type Identifier = Id;
    const PREFIX: &str = "attr";

    fn object_id(&self) -> &Id {
        &self.attr
    }
}

impl JsonObjectDetails for crate::servers::phc::UserState {
    type Identifier = Id;
    const PREFIX: &str = "user";

    fn object_id(&self) -> &Id {
        &self.id
    }
}
