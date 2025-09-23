use core::marker::PhantomData;

use std::fmt;

use serde::de::IntoDeserializer as _;
use serde::{Deserialize, Serialize};

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
    OtherConstellation(ConstellationCompRes),

    #[error("signature expired")]
    Expired,

    #[error("invalid signature")]
    InvalidSignature,

    #[error("malformed jwt")]
    OtherwiseInvalid,

    #[error("unexpected error - consult logs")]
    InternalError,
}

impl<T> Signed<T> {
    /// Opens this [`Signed`] message using the provided key.
    pub fn open<VK: jwt::VerifyingKey>(
        self,
        key: &VK,
        constellation: Option<&Constellation>,
    ) -> std::result::Result<T, OpenError>
    where
        T: Signable,
    {
        if T::CONSTELLATION_BOUND != constellation.is_some() {
            log::error!(
                "internal error: a constellation must (only) be provided to Signed::open \
                     if the type T is constellation bound"
            );
            return Err(OpenError::InternalError);
        }

        let check_constellation = |mut claims| -> std::result::Result<jwt::Claims, OpenError> {
            if !T::CONSTELLATION_BOUND {
                return Ok(claims);
            }

            let Ok(Some(constellation_claim)) =
                claims.extract::<ConstellationClaim>(CONSTELLATION_CLAIM)
            else {
                return Err(OpenError::OtherwiseInvalid);
            };

            let ccr = constellation_claim.compare(constellation.unwrap());
            if ccr.are_equal() {
                return Ok(claims);
            }

            Err(OpenError::OtherConstellation(ccr))
        };

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
                    match check_constellation(claims) {
                        Ok(..) => {
                            // constellations coincide, so the invalid signature cannot be
                            // blamed on diverging constellations
                            OpenError::InvalidSignature
                        }
                        Err(err) => err,
                    }
                }
                _ => {
                    log::error!("unexpected error opening signed message: {err}");
                    OpenError::InternalError
                }
            }
        })?;

        let claims = check_constellation(claims)?;

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
                log::debug!("could not verify signed message's claims: {err}");
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

    /// Open this signed message without checking the signature.  Something that should be done
    /// only in exceptional circumstances, for example, in the  [`phc::hub::TicketEP`] endpoint.
    pub fn open_without_checking_signature(self) -> std::result::Result<T, OpenError>
    where
        T: Signable,
    {
        self.open(&jwt::IgnoreSignature, None)
    }

    /// Like `new_opts`, but with `None` for the `constellation`.
    pub fn new<SK: jwt::SigningKey>(
        sk: &SK,
        message: &T,
        valid_for: std::time::Duration,
    ) -> Result<Self>
    where
        T: Signable,
    {
        Self::new_opts(sk, message, valid_for, None)
    }

    /// Signs `message`, and returns the resulting [`Signed`], with more options.
    pub fn new_opts<SK: jwt::SigningKey>(
        sk: &SK,
        message: &T,
        valid_for: std::time::Duration,
        constellation: Option<&Constellation>,
    ) -> Result<Self>
    where
        T: Signable,
    {
        if T::CONSTELLATION_BOUND != constellation.is_some() {
            log::error!(
                "internal error: a constellation must (only) be provided to Signed::new \
                     if the type T is constellation bound"
            );
            return Err(ErrorCode::InternalError);
        }

        let result = || -> std::result::Result<jwt::JWT, jwt::Error> {
            let mut claims = jwt::Claims::from_custom(message)?
                .nbf()?
                .exp_after(valid_for)?
                .claim(MESSAGE_CODE_CLAIM, T::CODE)?;

            if T::CONSTELLATION_BOUND {
                let constellation = constellation.unwrap();

                claims =
                    claims.claim(CONSTELLATION_CLAIM, ConstellationClaim::from(constellation))?;
            }

            claims.sign(sk)
        }();

        let jwt = match result {
            Ok(jwt) => jwt,
            Err(err) => {
                log::warn!("failed to create signed message: {err}");
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
    Ppp = 8,
    Ehpp = 9,
    PpNonce = 10,
    Hhpp = 11,
    // new >v3.0.0
    CardPseudPackage = 12,

    /// Only used as an example in a doctest
    Example = 65535,
}

impl MessageCode {
    /// Returns big endian bytes representation of this message code.
    pub fn to_bytes(&self) -> [u8; 2] {
        // TODO: surely this should be achievable without serde_json somehow.
        u16::deserialize(serde_json::to_value(self).unwrap().into_deserializer())
            .unwrap()
            .to_be_bytes()
    }
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
/// [`Constellation`]: crate::servers::Constellation
pub const CONSTELLATION_CLAIM: &str = "ph-ci";

/// Contents of the [`CONSTELLATION_CLAIM`]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConstellationClaim {
    /// [`Constellation::id`]
    #[serde(rename = "i")]
    id: id::Id,

    /// [`Constellation::created_at`]
    #[serde(rename = "c")]
    created_at: NumericDate,
}

impl From<&Constellation> for ConstellationClaim {
    fn from(c: &Constellation) -> Self {
        Self {
            id: c.id,
            created_at: c.created_at,
        }
    }
}

impl ConstellationClaim {
    /// Compare this constellation claim with the constellation known to me
    pub fn compare(self, my_constellation: &Constellation) -> ConstellationCompRes {
        match self.created_at.cmp(&my_constellation.created_at) {
            std::cmp::Ordering::Less => ConstellationCompRes {
                update_my_constellation: false,
                update_constellation_claim: true,
            },
            std::cmp::Ordering::Greater => ConstellationCompRes {
                update_my_constellation: true,
                update_constellation_claim: false,
            },
            std::cmp::Ordering::Equal => {
                if my_constellation.id == self.id {
                    ConstellationCompRes {
                        update_my_constellation: false,
                        update_constellation_claim: false,
                    }
                } else {
                    ConstellationCompRes {
                        update_my_constellation: true,
                        update_constellation_claim: true,
                    }
                }
            }
        }
    }
}

/// Result of [`ConstellationClaim::compare`].
#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub struct ConstellationCompRes {
    /// The constellation claim is perhaps out of date, and it's best if the originator
    /// of it is asked to update it.
    pub update_constellation_claim: bool,

    /// My constellation is perhaps out of date (based on the constellation claim,
    /// which may, or may not be trustworthy), and may need to be updated.
    pub update_my_constellation: bool,
}

impl ConstellationCompRes {
    /// Whether the constellation and constellation claim are the same.
    fn are_equal(&self) -> bool {
        !self.update_constellation_claim && !self.update_my_constellation
    }
}

/// A type that's used as the contents of a [`Signed`] message.
pub trait Signable: serde::de::DeserializeOwned + serde::Serialize {
    const CODE: MessageCode;

    /// Include a [`CONSTELLATION_CLAIM`] in the [`Signed`] message of this type, binding the
    /// signed message to the current [`Constellation`].
    ///
    /// [`Constellation`]: crate::servers::Constellation
    const CONSTELLATION_BOUND: bool = false;
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
    fn test_message_code() {
        assert_eq!(
            &format!("{}", MessageCode::PhcHubTicketReq),
            "1 (PhcHubTicketReq)"
        );

        assert_eq!(MessageCode::PhcHubTicketReq.to_bytes(), [0, 1]);
        assert_eq!(MessageCode::Example.to_bytes(), [255, 255]);
    }
}
