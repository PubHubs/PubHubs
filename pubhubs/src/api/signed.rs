use core::marker::PhantomData;

use serde::{de::DeserializeOwned, Deserialize, Serialize};

use crate::misc::jwt;

use crate::api::*;

/// A signed `T` by encoding `T` into a [jwt::JWT].
#[derive(Serialize, Deserialize, Debug)]
#[serde(transparent)]
pub struct Signed<T> {
    inner: jwt::JWT,

    phantom: PhantomData<T>,
}

impl<T> Signed<T> {
    pub fn open<VK: jwt::VerifyingKey>(self, key: &VK) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let claims: jwt::Claims = match self.inner.open(key) {
            Ok(claims) => claims,
            Err(err) => {
                log::info!("could not open signed message: {}", err);
                return Result::Err(ErrorCode::InvalidSignature);
            }
        };

        let res: T = match claims.into_custom() {
            Ok(v) => v,
            Err(err) => {
                log::info!(
                    "could not parse jwt into {}: {}",
                    std::any::type_name::<T>(),
                    err
                );
                return Result::Err(ErrorCode::BadRequest);
            }
        };

        Result::Ok(res)
    }

    pub fn open_without_checking_signature(self) -> Result<T>
    where
        T: DeserializeOwned,
    {
        self.open(&jwt::IgnoreSignature)
    }
}
