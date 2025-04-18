//! Storage backend for pubhubs servers
use crate::servers::config::ObjectStoreConfig;

use anyhow::Context as _;
use std::borrow::Cow;

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

/// The default object store we use.
pub struct DefaultObjectStore(Box<object_store::DynObjectStore>);

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
