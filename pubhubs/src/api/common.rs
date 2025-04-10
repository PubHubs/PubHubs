use std::rc::Rc;

use serde::{
    de::{DeserializeOwned, IntoDeserializer as _},
    Deserialize, Serialize,
};

use crate::misc::serde_ext::bytes_wrapper;
use crate::servers::server;

use actix_web::web;

pub type Result<T> = std::result::Result<T, ErrorCode>;

/// The [`actix_web::Responder`] used for all API endpoints: a wrapper around [`Result<T, ErrorCode>`].
pub struct ResultResponder<T>(Result<T>);

impl<T: Serialize> actix_web::Responder for ResultResponder<T> {
    type Body = actix_web::body::EitherBody<String>;

    fn respond_to(self, req: &actix_web::HttpRequest) -> actix_web::HttpResponse<Self::Body> {
        // NOTE: `actix_web::web::Json(self).respond_to(req)` does not work here,
        // because actix_web::web::Json implements `Deref` so the very function we are defining
        // will shadow the function we want to call.
        actix_web::Responder::respond_to(actix_web::web::Json(self.0), req)
    }
}

impl<T> From<Result<T>> for ResultResponder<T> {
    fn from(res: Result<T>) -> Self {
        Self(res)
    }
}

/// Extension trait for [`std::result::Result`].
pub trait ResultExt {
    type Ok;
    type Err;

    /// Turns `self` into an [`ErrorCode`] result by calling `f` when `self` is an error.
    ///
    /// Consider logging the error you're turning into an [`ErrorCode`].
    fn into_ec<F: FnOnce(Self::Err) -> ErrorCode>(self, f: F) -> Result<Self::Ok>;
}

impl<T, E> ResultExt for std::result::Result<T, E> {
    type Ok = T;
    type Err = E;

    fn into_ec<F: FnOnce(E) -> ErrorCode>(self, f: F) -> Result<T> {
        match self {
            Ok(v) => Result::Ok(v),
            Err(err) => Result::Err(f(err)),
        }
    }
}

impl<T> ResultExt for Option<T> {
    type Ok = T;
    type Err = ();

    fn into_ec<F: FnOnce(()) -> ErrorCode>(self, f: F) -> Result<T> {
        match self {
            Some(v) => Result::Ok(v),
            None => Result::Err(f(())),
        }
    }
}

/// Extension trait for [`Result<T,ErrorCode>`].
pub trait ApiResultExt: Sized {
    type Ok;

    fn into_ec(self) -> Result<Self::Ok>;

    /// Turns retryable errors into `None`, and the [Result] into a [std::result::Result],
    /// making the output suitable for use with [crate::misc::task::retry].
    fn retryable(self) -> std::result::Result<Option<Self::Ok>, ErrorCode> {
        match self.into_ec() {
            Ok(v) => Ok(Some(v)),
            Err(ec) => {
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
    fn into_server_result(self) -> Result<Self::Ok> {
        self.into_ec().map_err(ErrorCode::into_server_error)
    }
}

impl<T> ApiResultExt for Result<T> {
    type Ok = T;

    fn into_ec(self) -> Result<T> {
        self
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

    #[error("could not unseal data: corrupted or outdated")]
    BrokenSeal,

    #[error("invalid authentication proof")]
    InvalidAuthProof,

    #[error("expired data")]
    Expired,
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
            | NotImplemented
            | Expired
            | InvalidAuthProof
            | BrokenSeal => ErrorInfo {
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
    type RequestType: Serialize + DeserializeOwned + core::fmt::Debug;
    type ResponseType: Serialize + DeserializeOwned + core::fmt::Debug;

    const METHOD: http::Method;
    const PATH: &'static str;

    /// Helper function to add this endpoint to a [`web::ServiceConfig`].
    ///
    /// The `handler` argument must be of the form:
    /// ```text
    /// async fn f(app : Rc<App>, ...) -> api::Result<ResponseType>
    /// ```
    /// The `...` can contain arguments of type [`actix_web::FromRequest`].
    fn add_to<App, F, Args: actix_web::FromRequest + 'static>(
        app: &Rc<App>,
        sc: &mut web::ServiceConfig,
        handler: F,
    ) where
        server::AppMethod<App, F, Self::ResponseType>: actix_web::Handler<Args>,
        <server::AppMethod<App, F, Self::ResponseType> as actix_web::Handler<Args>>::Output:
            'static + actix_web::Responder,
    {
        sc.route(
            Self::PATH,
            web::method(Self::METHOD).to(server::AppMethod::new(app, handler)),
        );
    }

    /// Like [`add_to`], but runs `handler` only once, caching the result.
    ///
    /// Of course, `handler` won't have access to the usual [`actix_web::FromRequest`] arguments,
    /// as there is no request to derive these arguments from.
    ///
    /// Moreover `handler` cannot be `async`, since [`actix_web::App::configure`] takes a non-async
    /// function.
    ///
    /// # `handler` errors and panics
    ///
    /// If `handler` returns an [`Err`], then this will not cause the `App` (and associated `Server`) to
    /// crash.  Instead the [`Err`] is cached and served to any client requesting this endpoint.
    ///
    /// If a crash is desirable, then `handler` should panic.  Unlike a panic in a regular
    /// [`actix_web::Handler`] (which will just cause a connection reset), a panic here will cause
    /// the `Server` to exit.
    ///
    /// [`Err`]: Result::Err
    /// [`add_to`]: Self::add_to
    fn caching_add_to<App, F>(app: &Rc<App>, sc: &mut web::ServiceConfig, handler: F)
    where
        F: Fn(&App) -> Result<Self::ResponseType>,
    {
        let response: String = serde_json::to_string_pretty(&handler(app)).unwrap_or_else(|err| {
            log::error!("while preparing response for {}: {err}", Self::PATH);
            serde_json::to_string_pretty(&Result::<Self::ResponseType>::Err(
                ErrorCode::InternalError,
            ))
            .unwrap()
        });

        sc.route(
            Self::PATH,
            web::method(Self::METHOD).to(move || {
                // TODO: etag
                let response = actix_web::HttpResponse::Ok()
                    .content_type(actix_web::http::header::ContentType::json())
                    .body(response.clone());
                async { response }
            }),
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

        /// We implement [`std::str::FromStr`] so that this type can be used as a command-line argument with [`clap`].
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

        impl std::fmt::Display for $type {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                self.serialize(f)
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
