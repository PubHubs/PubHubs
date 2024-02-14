use core::marker::PhantomData;

use std::fmt;

use serde::{de::DeserializeOwned, Deserialize, Serialize};

use crate::misc::jwt;

use crate::api::*;

/// A signed `T` by encoding `T` into a [jwt::JWT].
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(transparent)]
pub struct Signed<T> {
    inner: jwt::JWT,

    phantom: PhantomData<T>,
}

impl<T> Signed<T> {
    pub fn open<VK: jwt::VerifyingKey>(self, key: &VK) -> Result<T>
    where
        T: DeserializeOwned + HavingMessageCode,
    {
        let claims: jwt::Claims = return_if_ec!(self.inner.open(key).into_ec(|err| {
            log::info!("could not open signed message: {}", err);
            ErrorCode::InvalidSignature
        }));

        // check that the message code is correct
        let claims = return_if_ec!(claims
            .check_present_and(
                MESSAGE_CODE_CLAIM,
                |mesg_code: MessageCode| -> std::result::Result<(), jwt::Error> {
                    if mesg_code == T::CODE {
                        return Ok(());
                    }

                    Err(jwt::Error::InvalidClaim {
                        claim_name: MESSAGE_CODE_CLAIM,
                        source: anyhow::anyhow!(
                            "expected message code {}, but got {}",
                            T::CODE,
                            mesg_code
                        ),
                    })
                },
            )
            .into_ec(|err| {
                log::info!("could not open signed message: {}", err);
                ErrorCode::BadRequest
            }));

        let res = return_if_ec!(claims.into_custom().into_ec(|err| {
            log::info!(
                "could not parse signed message jwt into {}: {}",
                std::any::type_name::<T>(),
                err
            );
            ErrorCode::BadRequest
        }));

        Result::Ok(res)
    }

    pub fn open_without_checking_signature(self) -> Result<T>
    where
        T: DeserializeOwned + HavingMessageCode,
    {
        self.open(&jwt::IgnoreSignature)
    }

    /// Signs `message`, and returns the resulting [`Signed`].
    pub fn new<SK: jwt::SigningKey>(
        sk: &SK,
        message: &T,
        valid_for: std::time::Duration,
    ) -> Result<Self>
    where
        T: Serialize + HavingMessageCode,
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
}

impl std::fmt::Display for MessageCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.serialize(&mut *f)?; // Don't ask me why self.serialize(f) does not work..
        write!(f, " ({:?})", &self)
    }
}

/// The claim name used to store the [MessageCode].
pub const MESSAGE_CODE_CLAIM: &str = "ph-mc";

/// A type that's used as the contents of a [Signed] message.
pub trait HavingMessageCode {
    const CODE: MessageCode;
}

macro_rules! having_message_code {
    { $tn:ty, $mc:ident } => {
        impl $crate::api::HavingMessageCode for $tn {
            const CODE: $crate::api::MessageCode = $crate::api::MessageCode::$mc;
        }
    };
}
pub(crate) use having_message_code;

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
