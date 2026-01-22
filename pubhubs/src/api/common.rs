use std::rc::Rc;
use std::str::FromStr as _;

use serde::{
    Deserialize, Serialize,
    de::{DeserializeOwned, IntoDeserializer as _},
};

use anyhow::Context as _;

use actix_web::http;
use actix_web::http::header;
use actix_web::web;

use crate::misc::fmt_ext;
use crate::misc::serde_ext::bytes_wrapper;
use crate::servers::server;

pub type Result<T> = std::result::Result<T, ErrorCode>;

/// The [`actix_web::Responder`] used for almost all API endpoints, [`EndpointDetails`] together with an
/// instance of [`Result<EndpointDetails::ResponseType>`].
pub struct Responder<EP: EndpointDetails>(pub EP::ResponseType);

impl<EP: EndpointDetails> actix_web::Responder for Responder<EP> {
    type Body = <CachedResponse<EP> as actix_web::Responder>::Body;

    fn respond_to(self, req: &actix_web::HttpRequest) -> actix_web::HttpResponse<Self::Body> {
        self.into_cached().respond_to(req)
    }
}

impl<EP: EndpointDetails> Responder<EP> {
    pub fn into_cached(self) -> CachedResponse<EP> {
        let payload = self.0.into_payload();
        let mut content_type = payload.content_type();

        let body = payload.into_body().unwrap_or_else(|err| {
            log::error!(
                "failed to serialize payload for {method} {url}: {err:#}",
                method = EP::METHOD,
                url = EP::PATH
            );

            content_type = Some(header::ContentType::json());
            Some(
                serde_json::to_vec_pretty(&Result::<()>::Err(ErrorCode::InternalError))
                    .unwrap()
                    .into(),
            )
        });

        CachedResponse {
            body,
            content_type,
            ep: std::marker::PhantomData,
        }
    }
}

/// Cached response
#[derive(Debug)]
pub struct CachedResponse<EP: EndpointDetails> {
    content_type: Option<header::ContentType>,
    body: Option<bytes::Bytes>,
    ep: std::marker::PhantomData<EP>,
}

impl<EP: EndpointDetails> Clone for CachedResponse<EP> {
    fn clone(&self) -> Self {
        Self {
            content_type: self.content_type.clone(),
            body: self.body.clone(),
            ep: std::marker::PhantomData::<EP>,
        }
    }
}

impl<EP: EndpointDetails> CachedResponse<EP> {
    /// Returns a response builder appropriate for this response
    pub fn response_builder(&self) -> actix_web::HttpResponseBuilder {
        let mut rb = actix_web::HttpResponse::Ok();

        if let Some(ct) = &self.content_type {
            rb.content_type(ct.clone());
        }

        if EP::immutable_response() {
            rb.insert_header(header::CacheControl(vec![
                header::CacheDirective::MaxAge(i32::MAX as u32),
                // https://github.com/actix/actix-web/issues/2666
                header::CacheDirective::Extension("immutable".to_string(), None),
            ]));
        }

        rb
    }
}

impl<EP: EndpointDetails> actix_web::Responder for CachedResponse<EP> {
    type Body = actix_web::body::BoxBody;

    fn respond_to(self, _req: &actix_web::HttpRequest) -> actix_web::HttpResponse<Self::Body> {
        let mut rb = self.response_builder();

        match self.body {
            Some(bytes) => rb.body(bytes),
            None => rb.finish(),
        }
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
#[derive(Clone, Copy, Serialize, Deserialize, Debug, thiserror::Error, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub enum ErrorCode {
    #[error(
        "the request you sent failed for now, but please do retry the exact same request again"
    )]
    PleaseRetry,

    #[error("encountered an unexpected problem")]
    InternalError,

    #[error("something is wrong with the request")]
    BadRequest,
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
            PleaseRetry => ErrorInfo {
                retryable: Some(true),
            },
            InternalError | BadRequest => ErrorInfo {
                retryable: Some(false),
            },
        }
    }

    /// When a server receives an error from another server, it calls this method
    /// to get the error to send tot the client.
    pub fn into_server_error(self) -> ErrorCode {
        match self {
            InternalError => InternalError,
            PleaseRetry => PleaseRetry,
            err => {
                if err.info().retryable == Some(true) {
                    PleaseRetry
                } else {
                    InternalError
                }
            }
        }
    }
}

// TODO: remove Clone, needed for current query impl
/// What's expected from a [`EndpointDetails::RequestType`].
pub trait PayloadTrait: Clone {
    type JsonType: Serialize + DeserializeOwned + core::fmt::Debug;

    /// Used when creating requests
    fn to_payload(&self) -> Payload<&Self::JsonType>;

    /// Used when forming responses
    fn into_payload(self) -> Payload<Self::JsonType>;

    fn from_payload(payload: Payload<Self::JsonType>) -> anyhow::Result<Self>;
}

/// Payload of a request or response to an api endpoint.
#[derive(Debug, Clone)] // TODO: remove Clone
pub enum Payload<JsonType> {
    None,

    /// This is the regular response type used by the pubhubs API.
    Json(JsonType),

    /// Raw bytes; used, for example, by [`crate::api::phc::user::GetObjectEP`].
    Octets(bytes::Bytes),
}

impl<T> Payload<T> {
    /// Returns the content type appropriate for this payload
    pub fn content_type(&self) -> Option<header::ContentType> {
        match self {
            Payload::None => None,
            Payload::Json(..) => Some(header::ContentType::json()),
            Payload::Octets(..) => Some(header::ContentType::octet_stream()),
        }
    }

    /// Converts this payload into bytes.
    pub fn into_body(self) -> anyhow::Result<Option<bytes::Bytes>>
    where
        T: Serialize,
    {
        match self {
            Payload::None => Ok(None),
            Payload::Octets(bytes) => Ok(Some(bytes)),
            Payload::Json(tp) => Ok(Some(
                serde_json::to_vec_pretty(&tp)
                    .with_context(|| {
                        format!("failed to convert {} to JSON", std::any::type_name::<T>())
                    })?
                    .into(),
            )),
        }
    }

    /// Extracts payload from [`awc::ClientResponse`].
    pub async fn from_client_response<S>(
        mut resp: awc::ClientResponse<S>,
    ) -> anyhow::Result<Payload<T>>
    where
        S: futures::stream::Stream<
                Item = std::result::Result<bytes::Bytes, awc::error::PayloadError>,
            >,
        T: DeserializeOwned,
    {
        let Some(content_type_hv) = resp.headers().get(http::header::CONTENT_TYPE) else {
            anyhow::bail!("no Content-Type in response",);
        };

        let content_type = mime::Mime::from_str(
            content_type_hv
                .to_str()
                .context("Content-Type value not utf8")?,
        )
        .context("could not parse Content-Type value")?;

        match (content_type.type_(), content_type.subtype()) {
            (mime::APPLICATION, mime::JSON) => Ok(Payload::Json({
                let body: bytes::Bytes = resp
                    .body()
                    .await
                    .context("failed to receive response body")?;

                serde_json::from_slice::<T>(&body).with_context(|| {
                    format!(
                        "could not deserialize JSON {json} to type {tp} ",
                        tp = std::any::type_name::<T>(),
                        json = crate::misc::fmt_ext::Bytes(&body),
                    )
                })?
            })),
            (mime::APPLICATION, mime::OCTET_STREAM) => Ok(Payload::Octets(
                resp.body().await.context("problem loading body")?,
            )),
            _ => {
                anyhow::bail!(
                    "expected Content-Type {} or {}, but got {content_type}",
                    mime::APPLICATION_JSON,
                    mime::APPLICATION_OCTET_STREAM
                )
            }
        }
    }
}

impl<T> std::fmt::Display for Payload<T>
where
    T: Serialize,
{
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Payload::None => write!(f, ""),
            Payload::Json(t) => write!(f, "{}", fmt_ext::Json(t)),
            Payload::Octets(b) => write!(f, "{} bytes", b.len()),
        }
    }
}

impl<T> PayloadTrait for Payload<T>
where
    T: Serialize + DeserializeOwned + core::fmt::Debug + Clone, // TODO: remove Clone
{
    type JsonType = T;

    fn to_payload(&self) -> Payload<&T> {
        match self {
            Payload::None => Payload::None,
            Payload::Json(t) => Payload::Json(t),
            Payload::Octets(b) => Payload::Octets(b.clone()), // cheap clone
        }
    }

    fn into_payload(self) -> Payload<T> {
        self
    }

    fn from_payload(payload: Payload<T>) -> anyhow::Result<Self> {
        Ok(payload)
    }
}

impl<T> PayloadTrait for T
where
    T: Serialize + DeserializeOwned + core::fmt::Debug + Clone,
{
    type JsonType = T;

    fn to_payload(&self) -> Payload<&T> {
        Payload::Json(self)
    }

    fn into_payload(self) -> Payload<T> {
        Payload::Json(self)
    }

    fn from_payload(payload: Payload<T>) -> anyhow::Result<T> {
        let Payload::Json(res) = payload else {
            anyhow::bail!("expected, but did not get, application/json");
        };

        Ok(res)
    }
}

/// Use [`NoPayload`] as [`EndpointDetails::RequestType`] to indicate no payload is expected.
#[derive(Clone, Copy)]
pub struct NoPayload;

impl PayloadTrait for NoPayload {
    type JsonType = ();

    fn to_payload(&self) -> Payload<&()> {
        Payload::None
    }

    fn into_payload(self) -> Payload<()> {
        Payload::None
    }

    fn from_payload(payload: Payload<()>) -> anyhow::Result<Self> {
        let Payload::None = payload else {
            anyhow::bail!("expected no payload");
        };

        Ok(NoPayload)
    }
}

/// A payload (see [`PayloadTrait`]) that can only hold bytes. Probably only useful for as
/// [`EndpointDetails::RequestType`].
#[derive(Clone)]
pub struct BytesPayload(pub bytes::Bytes);

impl PayloadTrait for BytesPayload {
    type JsonType = ();

    fn to_payload(&self) -> Payload<&()> {
        Payload::Octets(self.0.clone()) // cheap clone
    }

    fn into_payload(self) -> Payload<()> {
        Payload::Octets(self.0)
    }

    fn from_payload(payload: Payload<()>) -> anyhow::Result<Self> {
        let Payload::Octets(bytes) = payload else {
            anyhow::bail!("expected, but did not get, bytes payload (application/octet-stream)");
        };

        Ok(BytesPayload(bytes))
    }
}

/// What's expected from a [`EndpointDetails::ResponseType`].
///
/// Or: trait for those [`PayloadTrait`]s that have a [`PayloadTrait::JsonType`] of the form
/// `Result<T>`, and for which `Self::from_payload(Payload::Json(Err(..)))`
/// and `Self::from_payload(Self::into_payload())` never fail.
pub trait ResultPayloadTrait: PayloadTrait<JsonType = Result<Self::OkType>> {
    type OkType: Serialize + DeserializeOwned + core::fmt::Debug + Clone;

    /// Create an instance of this result payload type from the given [`ErrorCode`] infallibly.
    fn from_ec(ec: ErrorCode) -> Self {
        Self::from_payload(Payload::Json(Err(ec))).unwrap()
    }

    /// Destructs this payload result, extracting any error.
    fn into_result(self) -> Result<Self> {
        match self.into_payload() {
            Payload::Json(Err(ec)) => Err(ec),
            oth => Ok(Self::from_payload(oth).unwrap()),
        }
    }

    fn from_result(res: Result<Self>) -> Self {
        res.unwrap_or_else(Self::from_ec)
    }
}

impl<T> ResultPayloadTrait for Result<T>
where
    T: Serialize + DeserializeOwned + core::fmt::Debug + Clone,
{
    type OkType = T;
}

impl<T> ResultPayloadTrait for Payload<Result<T>>
where
    T: Serialize + DeserializeOwned + core::fmt::Debug + Clone,
{
    type OkType = T;
}

/// Details on a PubHubs server endpoint
pub trait EndpointDetails {
    type RequestType: PayloadTrait;
    type ResponseType: ResultPayloadTrait;

    const METHOD: http::Method;
    const PATH: &'static str;

    /// Can the response be cached indefinitely?
    fn immutable_response() -> bool {
        false
    }

    /// Helper function to add this endpoint to a [`web::ServiceConfig`].
    ///
    /// The `handler` argument must be of the form:
    /// ```text
    /// async fn f(app : Rc<App>, ...) -> api::ResponseType
    /// ```
    /// The `...` can contain arguments of type [`actix_web::FromRequest`].
    fn add_to<App, F, Args: actix_web::FromRequest + 'static>(
        app: &Rc<App>,
        sc: &mut web::ServiceConfig,
        handler: F,
    ) where
        server::AppMethod<App, F, Self>: actix_web::Handler<Args>,
        <server::AppMethod<App, F, Self> as actix_web::Handler<Args>>::Output:
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
    /// Only `application/json` responses are supported.
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
        F: Fn(&App) -> Self::ResponseType,
        Self: Sized + 'static,
    {
        let cached = Responder::<Self>(handler(app)).into_cached();

        // TODO: etag
        sc.route(
            Self::PATH,
            web::method(Self::METHOD).to(move || {
                let cached = cached.clone();
                async { cached }
            }),
        );
    }
}

/// Wraps one of the dalek types to enforce hex serialization
macro_rules! wrap_dalek_type {
    {$type:ident, $wrapped_type:path, derive( $($derive:tt)* ), $visitor_type:path } => {
        #[doc = "Wrapper around [`"]
        #[doc = stringify!($wrapped_type)]
        #[doc = "`] enforcing base16 serialization."]
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
        ed25519_dalek::SigningKey::generate(&mut aead::rand_core::OsRng).into()
    }
}

impl Scalar {
    pub fn random() -> Self {
        curve25519_dalek::scalar::Scalar::random(&mut aead::rand_core::OsRng).into()
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
