//! Tools for the (json) API of the PubHubs servers.
use serde::{Deserialize, Serialize};

/// The result of an API-request to a PubHubs server endpoint.
#[derive(Serialize, Deserialize)]
pub enum Result<T> {
    Ok(T),
    Err(ErrorCode),
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

/// List of possible errors.  We use error codes in favour of more descriptive strings,
/// because error codes can be more easily processed by the calling code,
/// should change less often, and can be easily translated.
#[derive(Serialize, Deserialize)]
pub enum ErrorCode {
    AlreadyRunning,
    NoLongerInCorrectState,
}
use ErrorCode::*;

/// Information about an [ErrorCode].
pub struct ErrorInfo {
    /// If [true], retrying the same request might result in success.  
    ///
    /// If [false], the request should not be retried without relevant changes.
    ///
    /// If [None], we do not know.
    retryable: Option<bool>,
}

impl ErrorCode {
    pub fn info(&self) -> ErrorInfo {
        match self {
            AlreadyRunning => ErrorInfo {
                retryable: Some(false),
            },
            NoLongerInCorrectState => ErrorInfo {
                retryable: Some(false),
            },
        }
    }
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

/// What's returned by the `.phc/discovery/info` endpoint
#[derive(Serialize, Deserialize)]
pub struct DiscoveryInfo {
    pub name: crate::servers::Name,

    /// Random string used by a server to check that it has contact with itself.
    pub self_check_code: String,

    /// URL of the PubHubs Central server this server tries to connect to.
    pub phc_url: url::Url,
}
