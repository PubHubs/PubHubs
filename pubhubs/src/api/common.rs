use serde::{Deserialize, Serialize};

use crate::misc::{fmt_ext, serde_ext::bytes_wrapper};
use crate::servers::server;

/// The result of an API-request to a PubHubs server endpoint.
///
/// We have made a new type because we cannot implement [actix_web::Responder]
/// for the existing [std::result::Result].
#[derive(Serialize, Deserialize, Debug)]
pub enum Result<T> {
    Ok(T),
    Err(ErrorCode),
}

impl<T> Result<T> {
    pub fn unwrap(self) -> T {
        match self {
            Result::Ok(v) => v,
            Result::Err(_) => panic!("unwrapped non-Ok"),
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

    /// Turns retryable errors into `None`, and the [Result] into a [std::result::Result],
    /// making the output suitable for use with [crate::misc::task::retry].
    pub fn retryable(self) -> std::result::Result<Option<T>, ErrorCode> {
        match self {
            Result::Ok(v) => Ok(Some(v)),
            Result::Err(ec) => {
                if ec.info().retryable == Some(true) {
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
        match self {
            Result::Ok(v) => Result::Ok(v),
            Result::Err(ec) => Result::Err(ec.into_server_error()),
        }
    }
}

/// Like `?`, but for [crate::api::Result].
macro_rules! return_if_ec {
    ( $x:expr ) => {{
        let result = $x;
        if result.is_err() {
            return $crate::api::Result::Err(result.unwrap_err());
        }
        result.unwrap()
    }};
}
pub(crate) use return_if_ec;

/// List of possible errors.  We use error codes in favour of more descriptive strings,
/// because error codes can be more easily processed by the calling code,
/// should change less often, and can be easily translated.
#[derive(Serialize, Deserialize, Debug, thiserror::Error)]
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

    #[error("something is wrong with the request")]
    BadRequest,

    #[error("not (yet) implemented")]
    NotImplemented,

    #[error("unknown hub")]
    UnknownHub,
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
            | UnknownHub
            | NotImplemented => ErrorInfo {
                retryable: Some(false),
            },
            CouldNotConnectYet | TemporaryFailure | NotYetReady => ErrorInfo {
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

/// What's returned by the `.ph/discovery/info` endpoint
#[derive(Serialize, Deserialize, Debug)]
pub struct DiscoveryInfoResp {
    pub name: crate::servers::Name,

    /// Random string used by a server to check that it has contact with itself.
    pub self_check_code: String,

    /// URL of the PubHubs Central server this server tries to connect to.
    pub phc_url: url::Url,

    /// Used to sign JWT of this server.
    pub jwt_key: VerifyingKey,

    /// Discovery state of the server
    pub state: ServerState,

    /// Details of the other PubHubs servers, according to this server
    /// None when `state` is [ServerState::Discovery]
    pub constellation: Option<crate::servers::Constellation>,
}

/// Discovery state of a server
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServerState {
    Discovery,
    UpAndRunning,
}

impl From<&server::State> for ServerState {
    fn from(s: &server::State) -> Self {
        match s {
            server::State::UpAndRunning { .. } => ServerState::UpAndRunning,
            server::State::Discovery { .. } => ServerState::Discovery,
        }
    }
}

/// Details on a PubHubs server endpoint
pub trait EndpointDetails {
    type RequestType: Serialize + for<'a> Deserialize<'a> + core::fmt::Debug;
    type ResponseType: Serialize + for<'a> Deserialize<'a> + core::fmt::Debug;

    const METHOD: http::Method;
    const PATH: &'static str;
}

/// Like [query], but retries the query when it fails with a [ErrorInfo::retryable] [ErrorCode].
///
/// When `A` queries `B` and `B` queries `C`, the `B` should, in general, not use
/// [query_with_retry], but let `A` manage retries.  This prevents `A`'s request from hanging
/// without any explanation.
pub async fn query_with_retry<EP: EndpointDetails>(
    server_url: &url::Url,
    req: &EP::RequestType,
) -> Result<EP::ResponseType> {
    match crate::misc::task::retry(|| async { query::<EP>(server_url, req).await.retryable() })
        .await
    {
        Ok(Some(resp)) => Result::Ok(resp),
        Ok(None) => Result::Err(ErrorCode::TemporaryFailure),
        Err(ec) => Result::Err(ec),
    }
}

/// Sends a request to `EP` [endpoint](EndpointDetails) at `server_url`.
pub async fn query<EP: EndpointDetails>(
    server_url: &url::Url,
    req: &EP::RequestType,
) -> Result<EP::ResponseType> {
    let client = awc::Client::default();

    let url = {
        let result = server_url.join(EP::PATH);
        if result.is_err() {
            log::error!(
                "Could not join urls {server_url} and {}: {}",
                EP::PATH,
                result.unwrap_err()
            );
            return Result::Err(ErrorCode::Malconfigured);
        }
        result.unwrap()
    };

    log::debug!("Querying {} {} {}", EP::METHOD, &url, fmt_ext::Json(&req));

    let mut resp = {
        let result = client
            .request(EP::METHOD, url.to_string())
            .send_json(&req)
            .await;

        if result.is_err() {
            return Result::Err(match result.unwrap_err() {
                awc::error::SendRequestError::Url(err) => {
                    log::error!("unexpected problem with {url}: {err}");
                    ErrorCode::InternalClientError
                }
                awc::error::SendRequestError::Connect(err) => match err {
                    awc::error::ConnectError::Timeout => {
                        log::warn!("connecting to {url} timed out");
                        ErrorCode::CouldNotConnectYet
                    }
                    awc::error::ConnectError::Resolver(err) => {
                        log::warn!("resolving {url}: {err}");
                        ErrorCode::CouldNotConnectYet
                    }
                    awc::error::ConnectError::Io(err) => {
                        // might happen when the port is closed
                        log::warn!("io error while connecting to {url}: {err}");
                        ErrorCode::CouldNotConnectYet
                    }
                    _ => {
                        log::error!("error connecting to {url}: {err}");
                        ErrorCode::CouldNotConnect
                    }
                },
                awc::error::SendRequestError::Send(err) => {
                    log::warn!(
                        "error while sending request to {} {url}: {}",
                        EP::METHOD,
                        err
                    );
                    ErrorCode::CouldNotConnectYet
                }
                awc::error::SendRequestError::Response(err) => {
                    log::error!("problem parsing response from {} {url}: {err}", EP::METHOD,);
                    ErrorCode::InternalClientError
                }
                awc::error::SendRequestError::Http(err) => {
                    log::error!("HTTP error with request {} {url}: {err}", EP::METHOD,);
                    ErrorCode::InternalClientError
                }
                awc::error::SendRequestError::H2(err) => {
                    log::error!("HTTP/2 error with request {} {url}: {err}", EP::METHOD,);
                    ErrorCode::InternalClientError
                }
                awc::error::SendRequestError::Timeout => {
                    log::warn!("request to {} {url} timed out", EP::METHOD);
                    ErrorCode::CouldNotConnectYet
                }
                awc::error::SendRequestError::TunnelNotSupported => {
                    log::error!("unexpected 'TunnelNotSupported' error");
                    ErrorCode::InternalClientError
                }
                awc::error::SendRequestError::Body(err) => {
                    log::warn!(
                        "problem sending request body to {} {url}: {err}",
                        EP::METHOD
                    );
                    ErrorCode::CouldNotConnectYet
                }
                awc::error::SendRequestError::Custom(err, dbg) => {
                    log::error!("unexpected custom error: {err}; {dbg:?}",);
                    ErrorCode::InternalClientError
                }
                err => {
                    log::error!("unexpected error of unexpected type: {err}",);
                    ErrorCode::InternalClientError
                }
            });
        }

        result.unwrap()
    };

    let response: Result<EP::ResponseType> = {
        let result = resp.json().await;
        if result.is_err() {
            log::error!(
                "problem parsing response to {} {url} as JSON: {}",
                EP::METHOD,
                result.unwrap_err()
            );
            return Result::Err(InternalClientError);
        }
        result.unwrap()
    };

    log::debug!(
        "{} {} returned {}",
        EP::METHOD,
        &url,
        fmt_ext::Json(&response)
    );

    response
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

impl SigningKey {
    pub fn generate() -> Self {
        ed25519_dalek::SigningKey::generate(&mut rand::rngs::OsRng).into()
    }
}

pub struct DiscoveryInfo {}
impl EndpointDetails for DiscoveryInfo {
    type RequestType = ();
    type ResponseType = DiscoveryInfoResp;

    const METHOD: http::Method = http::Method::GET;
    const PATH: &'static str = ".ph/discovery/info";
}

pub struct DiscoveryRun {}
impl EndpointDetails for DiscoveryRun {
    type RequestType = ();
    type ResponseType = ();

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/discovery/run";
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
