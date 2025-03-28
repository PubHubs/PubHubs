use serde::{de::IntoDeserializer as _, Deserialize, Serialize};

use crate::misc::serde_ext::bytes_wrapper;
use crate::servers::server;

use actix_web::web;

/// The result of an API-request to a PubHubs server endpoint.
///
/// We have made a new type because we cannot implement [actix_web::Responder]
/// for the existing [std::result::Result].
#[derive(Serialize, Deserialize, Debug)]
pub enum Result<T> {
    Ok(T),
    Err(ErrorCode),
}

/// Creates an [actix_web::Responder] from the given [Serialize] `T`.
pub fn ok<T>(t: T) -> Result<T>
where
    T: Serialize,
{
    Result::Ok(t)
}

/// Creates an [actix_web::Responder] from the given [ErrorCode].
pub fn err<T: Serialize>(code: ErrorCode) -> Result<T> {
    Result::<T>::Err(code)
}

impl<T: Serialize> actix_web::Responder for Result<T> {
    type Body = actix_web::body::EitherBody<String>;

    fn respond_to(self, req: &actix_web::HttpRequest) -> actix_web::HttpResponse<Self::Body> {
        // NOTE: `actix_web::web::Json(self).respond_to(req)` does not work here,
        // because actix_web::web::Json implements `Deref` so the very function we are defining
        // will shadow the function we want to call.
        actix_web::Responder::respond_to(actix_web::web::Json(self), req)
    }
}

impl<T> Result<T> {
    pub fn unwrap(self) -> T {
        match self {
            Result::Ok(v) => v,
            Result::Err(err) => panic!("unwrapped non-Ok: {err:?}: {err}"),
        }
    }

    pub fn unwrap_err(self) -> ErrorCode {
        match self {
            Result::Err(err) => err,
            Result::Ok(_) => panic!("unwrapped_err-ed non-Err"),
        }
    }

    pub fn is_err(&self) -> bool {
        !self.is_ok()
    }

    pub fn is_ok(&self) -> bool {
        matches!(self, Result::Ok(_))
    }

    pub fn inspect_err(self, f: impl FnOnce(ErrorCode)) -> Self {
        if let Result::Err(ref ec) = self {
            f(*ec);
        }
        self
    }

    /// Converts this [crate::api::Result] into a standard [std::result::Result].
    pub fn into_std(self) -> std::result::Result<T, ErrorCode> {
        match self {
            Result::Ok(v) => Ok(v),
            Result::Err(err) => Err(err),
        }
    }

    /// Creates an [crate::api::Result] from a standard [std::result::Result].
    pub fn from_std(res: std::result::Result<T, ErrorCode>) -> Self {
        match res {
            Ok(v) => Result::Ok(v),
            Err(err) => Result::Err(err),
        }
    }

    /// Turns retryable errors into `None`, and the [Result] into a [std::result::Result],
    /// making the output suitable for use with [crate::misc::task::retry].
    pub fn retryable(self) -> std::result::Result<Option<T>, ErrorCode> {
        match self {
            Result::Ok(v) => Ok(Some(v)),
            Result::Err(ec) => {
                if ec.info().retryable == Some(true) {
                    log::trace!("ignoring retryable error: {ec}");
                    Ok(None)
                } else {
                    Err(ec)
                }
            }
        }
    }

    /// When passing along a result from another server to a client, this method is called
    /// to modify any [ErrorCode]. For details, see  [ErrorCode::into_server_error].
    pub fn into_server_result(self) -> Self {
        self.map_err(ErrorCode::into_server_error)
    }

    pub fn map_err(self, f: impl FnOnce(ErrorCode) -> ErrorCode) -> Self {
        match self {
            Result::Ok(v) => Result::Ok(v),
            Result::Err(ec) => Result::Err(f(ec)),
        }
    }
}

/// Like `?`, but for [crate::api::Result].
macro_rules! return_if_ec {
    ( $x:expr ) => {{
        let result = $x;
        #[allow(clippy::unnecessary_unwrap)] // clippy's suggestion won't work with api::Result
        if result.is_err() {
            return $crate::api::Result::Err(result.unwrap_err());
        }
        result.unwrap()
    }};
}
pub(crate) use return_if_ec;

/// Extension trait to add [IntoErrorCode::into_ec] to [std::result::Result].
pub trait IntoErrorCode {
    type Ok;
    type Err;

    /// Turns `self` into an [ErrorCode] result by calling `f` when `self` is an error.
    ///
    /// Consider logging the error you're turning into an [ErrorCode].
    fn into_ec<F: FnOnce(Self::Err) -> ErrorCode>(self, f: F) -> Result<Self::Ok>;
}

impl<T, E> IntoErrorCode for std::result::Result<T, E> {
    type Ok = T;
    type Err = E;

    fn into_ec<F: FnOnce(E) -> ErrorCode>(self, f: F) -> Result<T> {
        match self {
            Ok(v) => Result::Ok(v),
            Err(err) => Result::Err(f(err)),
        }
    }
}

impl<T> IntoErrorCode for Option<T> {
    type Ok = T;
    type Err = ();

    fn into_ec<F: FnOnce(()) -> ErrorCode>(self, f: F) -> Result<T> {
        match self {
            Some(v) => Result::Ok(v),
            None => Result::Err(f(())),
        }
    }
}

/// List of possible errors.  We use error codes in favour of more descriptive strings,
/// because error codes can be more easily processed by the calling code,
/// should change less often, and can be easily translated.
#[derive(Clone, Copy, Serialize, Deserialize, Debug, thiserror::Error)]
pub enum ErrorCode {
    #[error("requested process already running")]
    AlreadyRunning,

    #[error("this, or one of the other servers, is not yet ready to process the request")]
    NotYetReady,

    #[error("server is no longer in the correct state to process this request")]
    NoLongerInCorrectState,

    #[error("malconfiguration detected")]
    Malconfigured,

    #[error("unexpected problem with the client (not the server)")]
    InternalClientError,

    #[error("severed connection to server; action may or may not have succeeded")]
    SeveredConnection,

    #[error("problem connecting to server of a potentially temporary nature")]
    CouldNotConnectYet,

    #[error("problem connecting to server")]
    CouldNotConnect,

    #[error("server encountered a problem which is likely of a temporary nature")]
    TemporaryFailure,

    #[error("server encountered an unexpected problem")]
    InternalError,

    #[error("a signature could not be verified")]
    InvalidSignature,

    #[error("invalid admin key")]
    InvalidAdminKey,

    #[error("something is wrong with the request")]
    BadRequest,

    #[error("not (yet) implemented")]
    NotImplemented,

    #[error("unknown hub")]
    UnknownHub,

    #[error("unknown attribute type")]
    UnknownAttributeType,

    #[error("attribute of this type cannot be obtained from this source")]
    MissingAttributeSource,

    #[error("yivi is not configured for this authentication server")]
    YiviNotConfigured,
}
use ErrorCode::*;

/// Information about an [ErrorCode].
pub struct ErrorInfo {
    /// If [true], retrying the same request might result in success.  
    ///
    /// If [false], the request should not be retried without relevant changes.
    ///
    /// If [None], we do not know.
    pub retryable: Option<bool>,
}

impl ErrorCode {
    /// Returns additional information about this error code.
    pub fn info(&self) -> ErrorInfo {
        match self {
            AlreadyRunning
            | NoLongerInCorrectState
            | Malconfigured
            | InvalidSignature
            | InvalidAdminKey
            | UnknownHub
            | UnknownAttributeType
            | MissingAttributeSource
            | YiviNotConfigured
            | NotImplemented => ErrorInfo {
                retryable: Some(false),
            },
            CouldNotConnectYet | TemporaryFailure | NotYetReady | SeveredConnection => ErrorInfo {
                retryable: Some(true),
            },
            InternalClientError | InternalError | BadRequest | CouldNotConnect => {
                ErrorInfo { retryable: None }
            }
        }
    }

    /// When a server receives an error from another server, it calls this method
    /// to get the error to send tot the client.
    pub fn into_server_error(self) -> ErrorCode {
        match self {
            Malconfigured => Malconfigured,
            NotYetReady => NotYetReady,
            err => {
                if err.info().retryable == Some(true) {
                    TemporaryFailure
                } else {
                    InternalError
                }
            }
        }
    }
}

/// Details on a PubHubs server endpoint
pub trait EndpointDetails {
    type RequestType: Serialize + for<'a> Deserialize<'a> + core::fmt::Debug;
    type ResponseType: Serialize + for<'a> Deserialize<'a> + core::fmt::Debug;

    const METHOD: http::Method;
    const PATH: &'static str;

    /// Helper function to add this endpoint to a [web::ServiceConfig].
    fn add_to<App: Clone, F, Args: actix_web::FromRequest + 'static>(
        app: &App,
        sc: &mut web::ServiceConfig,
        handler: F,
    ) where
        server::AppMethod<App, F>: actix_web::Handler<Args>,
        <server::AppMethod<App, F> as actix_web::Handler<Args>>::Output:
            actix_web::Responder + 'static,
    {
        sc.route(
            Self::PATH,
            web::method(Self::METHOD).to(server::AppMethod::new(app, handler)),
        );
    }
}

/// Wraps one of the dalek types to enforce hex serialization
macro_rules! wrap_dalek_type {
    {$type:ident, $wrapped_type:path, derive( $($derive:tt)* ), $visitor_type:path } => {
        /// Wrapper around [`$wrapped_type`] enforcing base16 serialization.
        #[derive(Clone, Debug, Serialize, Deserialize, $( $derive )* )]
        #[serde(transparent)]
        pub struct $type {
            inner: bytes_wrapper::BytesWrapper<
                $wrapped_type,
                bytes_wrapper::ChangeVisitorType<
                    (bytes_wrapper::B16Encoding,),
                    { $visitor_type as isize },
                >,
            >,
        }

        impl From<$wrapped_type> for $type {
            fn from(inner: $wrapped_type) -> Self {
                Self {
                    inner: inner.into(),
                }
            }
        }

        // We implement [FromStr] so that this type can be used as a command-line argument with [clap].
        impl std::str::FromStr for $type {
            type Err = serde::de::value::Error;

            fn from_str(s : &str) -> std::result::Result<Self, Self::Err> {
                Self::deserialize(s.into_deserializer())
            }
        }

        impl core::ops::Deref for $type {
            type Target = $wrapped_type;

            fn deref(&self) -> &Self::Target {
                &self.inner
            }
        }

        impl core::ops::DerefMut for $type {
            fn deref_mut(&mut self) -> &mut Self::Target {
                &mut self.inner
            }
        }
    }
}

wrap_dalek_type! {
    VerifyingKey, ed25519_dalek::VerifyingKey,
    derive(PartialEq, Eq),
    bytes_wrapper::VisitorType::BorrowedByteArray
}

wrap_dalek_type! {
    SigningKey, ed25519_dalek::SigningKey,
    derive(),
    bytes_wrapper::VisitorType::BorrowedByteArray
}

wrap_dalek_type! {
    Scalar, curve25519_dalek::scalar::Scalar,
    derive(PartialEq, Eq),
    bytes_wrapper::VisitorType::ByteSequence
}

wrap_dalek_type! {
    CurvePoint, curve25519_dalek::ristretto::CompressedRistretto,
    derive(PartialEq, Eq),
    bytes_wrapper::VisitorType::ByteSequence
}

impl SigningKey {
    pub fn generate() -> Self {
        ed25519_dalek::SigningKey::generate(&mut rand::rngs::OsRng).into()
    }
}

impl Scalar {
    pub fn random() -> Self {
        curve25519_dalek::scalar::Scalar::random(&mut rand::rngs::OsRng).into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serde_scalar() {
        assert_eq!(
            Scalar::deserialize(
                serde::de::value::StrDeserializer::<serde::de::value::Error>::new(
                    &"ff00000000000000000000000000000000000000000000000000000000000000",
                ),
            )
            .unwrap(),
            curve25519_dalek::scalar::Scalar::from(255u8).into(),
        );

        let s: Scalar = curve25519_dalek::scalar::Scalar::from(1u8).into();
        assert_eq!(
            &serde_json::to_string(&s).unwrap(),
            "\"0100000000000000000000000000000000000000000000000000000000000000\""
        );
    }
}
