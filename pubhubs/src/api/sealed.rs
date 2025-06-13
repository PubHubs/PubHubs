//! Sealing data using symmetric crypto

use std::marker::PhantomData;

use serde::{de::DeserializeOwned, Deserialize, Serialize};

use crate::api;
use crate::misc::crypto;
use crate::misc::error::Opaque;
use crate::misc::serde_ext::bytes_wrapper::B64UU;

pub use crypto::SealingKey;

/// A symmetrically encrypted encoding of `T`.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(transparent)]
pub struct Sealed<T>
where
    T: api::Signable,
{
    pub(crate) inner: B64UU,

    phantom_data: PhantomData<T>,
}

impl<T> Sealed<T>
where
    T: api::Signable,
{
    /// Seals a `message` using the given [`SealingKey`].
    pub fn new(message: &T, key: &SealingKey) -> api::Result<Self> {
        Ok(Self {
            phantom_data: PhantomData,
            inner: serde_bytes::ByteBuf::from(
                crypto::seal(message, key, &T::CODE.to_bytes()).map_err(|err| {
                    log::error!(
                        "failed to seal message of type {tp}: {err:#}",
                        tp = std::any::type_name::<T>()
                    );

                    api::ErrorCode::InternalError
                })?,
            )
            .into(),
        })
    }

    /// Opens this sealed message
    pub fn open(self, key: &SealingKey) -> Result<T, Opaque> {
        crypto::unseal(&*self.inner, key, &T::CODE.to_bytes())
    }
}
