use core::marker::PhantomData;

use std::fmt;

use serde::{de::DeserializeOwned, Deserialize, Serialize};

use crate::id;
use crate::misc::jwt;
use crate::servers::Constellation;

use crate::api::*;

/// A signed `T` by encoding `T` into a [`jwt::JWT`].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(transparent)]
pub struct Signed<T> {
    inner: jwt::JWT,

    phantom: PhantomData<T>,
}

/// Error returned by [`Signed::open`].
#[derive(thiserror::Error, Debug)]
pub enum OpenError {
    #[error("signature intended for other constellation")]
    OtherConstellation,

    #[error("signature expired")]
    Expired,

    #[error("invalid signature or malformed jwt")]
    OtherwiseInvalid,

    #[error("unexpected error - consult logs")]
    InternalError,
}

impl<T> Signed<T> {
    /// Old version of [`Signed::open`].  Will be deprecated eventually.
    pub fn old_open<VK: jwt::VerifyingKey>(self, key: &VK) -> Result<T>
    where
        T: Signable,
    {
        self.open(key, None).into_ec(|err| match err {
            OpenError::OtherConstellation => ErrorCode::InvalidSignature,
            OpenError::Expired => ErrorCode::Expired,
            OpenError::OtherwiseInvalid => ErrorCode::BadRequest,
            OpenError::InternalError => ErrorCode::InternalError,
        })
    }

    /// Opens this [`Signed`] message using the provided key.
    pub fn open<VK: jwt::VerifyingKey>(
        self,
        key: &VK,
        constellation: Option<id::Id>,
    ) -> std::result::Result<T, OpenError>
    where
        T: Signable,
    {
        if T::CONSTELLATION_BOUND != constellation.is_some() {
            log::error!(
                "internal error: a constellation must only be provided to Signed::open \
                     if the type T is constellation bound"
            );
            return Err(OpenError::InternalError);
        }

        let claims: jwt::Claims = self.inner.open(key).map_err(|err| {
            log::debug!(
                "could not open signed message (of type {}): {}",
                std::any::type_name::<T>(),
                err
            );

            match err {
                jwt::Error::Expired { .. } => OpenError::Expired,
                jwt::Error::DeserializingHeader(_)
                | jwt::Error::ClaimsNotJsonMap(_)
                | jwt::Error::MissingDot
                | jwt::Error::InvalidBase64(_)
                | jwt::Error::UnexpectedAlgorithm { .. } => OpenError::OtherwiseInvalid,
                jwt::Error::InvalidSignature { claims, .. } => {
                    // claims.check(CONSTELLATION_CLAIM, jwt::expecting::exactly())

                    todo! {}

                    OpenError::OtherwiseInvalid
                }
                _ => {
                    log::error!("unexpected error opening signed message: {err}");
                    OpenError::InternalError
                }
            }
        })?;

        // check that the message code is correct
        let claims = claims
            .check_present_and(
                MESSAGE_CODE_CLAIM,
                |claim_name: &'static str,
                 mesg_code: MessageCode|
                 -> std::result::Result<(), jwt::Error> {
                    if mesg_code == T::CODE {
                        return Ok(());
                    }

                    Err(jwt::Error::InvalidClaim {
                        claim_name,
                        source: anyhow::anyhow!(
                            "expected message code {}, but got {}",
                            T::CODE,
                            mesg_code
                        ),
                    })
                },
            )
            .map_err(|err| {
                log::debug!("could not verify signed message's claims: {}", err);
                OpenError::OtherwiseInvalid
            })?;

        let res = claims.into_custom().map_err(|err| {
            log::info!(
                "could not parse signed message jwt into {}: {}",
                std::any::type_name::<T>(),
                err
            );
            OpenError::OtherwiseInvalid
        })?;

        Ok(res)
    }

    pub fn open_without_checking_signature(self) -> Result<T>
    where
        T: Signable,
    {
        self.old_open(&jwt::IgnoreSignature)
    }

    /// Signs `message`, and returns the resulting [`Signed`].
    pub fn new<SK: jwt::SigningKey>(
        sk: &SK,
        message: &T,
        valid_for: std::time::Duration,
    ) -> Result<Self>
    where
        T: Signable,
    {
        let result = || -> std::result::Result<jwt::JWT, jwt::Error> {
            jwt::Claims::from_custom(message)?
                .nbf()?
                .exp_after(valid_for)?
                .claim(MESSAGE_CODE_CLAIM, T::CODE)?
                .sign(sk)
        }();

        let jwt = match result {
            Ok(jwt) => jwt,
            Err(err) => {
                log::warn!("failed to create signed message: {}", err);
                return Result::Err(ErrorCode::InternalError);
            }
        };

        Result::Ok(Self {
            inner: jwt,
            phantom: PhantomData,
        })
    }

    pub fn as_str(&self) -> &str {
        self.inner.as_str()
    }
}

/// A number that represents the type of a message.  Every message type that's [Signed] gets such a
/// code to prevent reuse of a message of one type as another.
#[non_exhaustive]
#[repr(u16)]
#[derive(serde_repr::Serialize_repr, serde_repr::Deserialize_repr, PartialEq, Eq, Debug)]
pub enum MessageCode {
    // NOTE: you can freely change the names of these variants, but DO NOT CHANGE the code of a
    // message once assigned, as this breaks existing signatures.
    PhcHubTicketReq = 1,
    PhcHubTicket = 2,
    PhcTHubKeyReq = 3,
    PhcTHubKeyResp = 4,
    AdminUpdateConfigReq = 5,
    AdminInfoReq = 6,
    Attr = 7,

    /// Only used as an example in a doctest
    Example = 65535,
}

impl std::fmt::Display for MessageCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.serialize(&mut *f)?; // Don't ask me why self.serialize(f) does not work..
        write!(f, " ({:?})", &self)
    }
}

/// The claim name used to store the [`MessageCode`].
pub const MESSAGE_CODE_CLAIM: &str = "ph-mc";

/// The claim name used to store the [`Constellation`] [`Id`].
///
/// [`Id`]: id::Id
pub const CONSTELLATION_CLAIM: &str = "ph-ci";

/// A type that's used as the contents of a [`Signed`] message.
pub trait Signable: serde::de::DeserializeOwned + serde::Serialize {
    const CODE: MessageCode;

    /// Include a [`CONSTELLATION_CLAIM`] in the [`Signed`] message of this type, binding the
    /// signed message to the current [`Constellation`].
    const CONSTELLATION_BOUND: bool = true;
}

#[macro_export]
macro_rules! having_message_code {
    { $tn:ty, $mc:ident } => {
        impl $crate::api::Signable for $tn {
            const CODE: $crate::api::MessageCode = $crate::api::MessageCode::$mc;
        }
    };
}
/// Implements [`Signable`] for the given struct.  Use as follows:
/// ```
/// use pubhubs::api::Signable;
///
/// #[derive(serde::Serialize, serde::Deserialize)]
/// struct T {};
///
/// pubhubs::api::having_message_code!{T, Example};
///
/// assert_eq!(T::CODE, pubhubs::api::MessageCode::Example);
/// ```
pub use having_message_code;

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_display_message_code() {
        assert_eq!(
            &format!("{}", MessageCode::PhcHubTicketReq),
            "1 (PhcHubTicketReq)"
        );
    }
}
