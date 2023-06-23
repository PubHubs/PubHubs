//! Error handling helpers
//!
//! The [HttpContextExt] trait is used to turn [anyhow::Result]s into an
//! [actix_web::ResponseError].

use actix_web::body::BoxBody;
use actix_web::{HttpMessage, HttpRequest, HttpResponse};
use std::fmt::Formatter;
use std::{
    fmt::{self, Debug, Display},
    result::Result,
};

use crate::context::Main;
use anyhow::Context as _;
use http::StatusCode;

use crate::hairy_ext::hairy_eval_html_translations;

use crate::translate::Translations;

/// Trait to add the [HttpContextExt::http_context] method to [Result].
///
/// ```
/// use pubhubs::error::{HttpContextExt as _, HttpContext};
/// use http::StatusCode;
/// use anyhow::{anyhow, Context as _};
///
/// // extracting a http context from an error that has none gives back the original error
/// const ERR_MSG : &str= "unexpected character in hex-encoded secret key \"aDb2=7Ndj8\"";
/// let err = HttpContext::try_from(anyhow!(ERR_MSG)).err().unwrap();
/// assert_eq!(err.to_string(), ERR_MSG);
///
/// // but if a http context is set...
/// let err = Err::<(),_>(err)
///     .http_context(StatusCode::INTERNAL_SERVER_ERROR, Some("message".to_owned()))
///     .err().unwrap();
///
/// // then we do get back a HttpContext instance:
/// let hc = HttpContext::try_from(err).unwrap();
/// assert_eq!(hc.to_string(), "500 Internal Server Error - message");
///
/// // If multiple http contexts are added...
/// let err = Err::<(),_>(anyhow!(ERR_MSG))
///     .http_context(StatusCode::INTERNAL_SERVER_ERROR, Some("ise".to_owned()))
///     .with_context(|| "loading configuration")
///     .http_context(StatusCode::BAD_REQUEST, Some("br".to_owned()))
///     .with_context(|| "handling request from ip address 1.2.3.4").err().unwrap();
///
/// // The last http context is used
/// assert_eq!(HttpContext::try_from(err).unwrap().to_string(), "400 Bad Request - br")
/// ```
pub trait HttpContextExt<T> {
    /// Adds additional context to the error value that is used when this result
    /// (or one derived from it by [anyhow::Context::context] calls)
    /// is turned into a [actix_web::ResponseError].
    ///
    /// When e.g. [HttpContextExt::http_context] is called multiple times, the last call determines
    /// the details used to create the [actix_web::ResponseError].
    fn http_context(
        self,
        status_code: http::StatusCode,
        public_message: Option<String>,
    ) -> anyhow::Result<T>;

    fn internal_server_error(self, public_message: Option<String>) -> anyhow::Result<T>
    where
        Self: Sized,
    {
        self.http_context(StatusCode::INTERNAL_SERVER_ERROR, public_message)
    }

    fn bad_request(self, public_message: Option<String>) -> anyhow::Result<T>
    where
        Self: Sized,
    {
        self.http_context(StatusCode::BAD_REQUEST, public_message)
    }

    fn bad_gateway(self, public_message: Option<String>) -> anyhow::Result<T>
    where
        Self: Sized,
    {
        self.http_context(StatusCode::BAD_GATEWAY, public_message)
    }
}

impl<T, E> HttpContextExt<T> for Result<T, E>
where
    Result<T, E>: anyhow::Context<T, E>,
{
    fn http_context(
        self,
        status_code: http::StatusCode,
        public_message: Option<String>,
    ) -> anyhow::Result<T> {
        self.with_context(|| HttpContext {
            status_code,
            public_message,
        })
    }
}

/// Holds the http context added to an [anyhow::Result].
#[derive(Debug)]
pub struct HttpContext {
    pub status_code: http::StatusCode,
    pub public_message: Option<String>,
}

impl Default for HttpContext {
    fn default() -> Self {
        HttpContext {
            status_code: http::StatusCode::INTERNAL_SERVER_ERROR,
            public_message: None,
        }
    }
}

impl Display for HttpContext {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        std::fmt::Display::fmt(&self.status_code, f)?;
        if self.public_message.is_none() {
            return Ok(());
        }
        write!(f, " - {}", self.public_message.as_ref().unwrap())
    }
}

impl TryFrom<anyhow::Error> for HttpContext {
    type Error = anyhow::Error;

    /// Extracts the [HttpContext] from a [anyhow::Error] if there is any,
    /// or otherwise returns the [anyhow::Error] unchanged.
    fn try_from(err: anyhow::Error) -> Result<HttpContext, anyhow::Error> {
        err.downcast()
    }
}

#[derive(Debug)]
pub struct TranslatedError {
    body: String,
    status: StatusCode,
}

impl Display for TranslatedError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.status, self.body)
    }
}

impl actix_web::ResponseError for TranslatedError {
    fn status_code(&self) -> StatusCode {
        self.status
    }

    fn error_response(&self) -> HttpResponse<BoxBody> {
        HttpResponse::build(self.status).body(self.body.clone())
    }
}

pub trait AnyhowExt<T> {
    fn into_translated_error(self, request: &HttpRequest) -> Result<T, TranslatedError>;
}

impl<T, E> AnyhowExt<T> for Result<T, E>
where
    E: Into<anyhow::Error>,
{
    fn into_translated_error(self, request: &HttpRequest) -> Result<T, TranslatedError> {
        self.map_err(|e| {
            let e = e.into();
            let msg = format!("{e:?}");
            let http_context: Result<HttpContext, anyhow::Error> = e.try_into();
            let http_context = http_context.unwrap_or_default();
            let context: &actix_web::web::Data<Main> =
                request.app_data().expect("Forgot context..");
            create_error_response(
                &context.hair,
                Some(&msg),
                request,
                request
                    .extensions()
                    .get::<Translations>()
                    .map(Clone::clone)
                    .unwrap_or(Translations::NONE),
                http_context.status_code,
                http_context.public_message,
            )
        })
    }
}

pub fn create_error_response(
    hair: &expry::BytecodeVec,
    internal_message: Option<&str>,
    request: &HttpRequest,
    translations: Translations,
    status_code: http::StatusCode,
    public_message: Option<String>,
) -> TranslatedError {
    use expry::key_str; // for expry::value!

    let code = uuid::Uuid::new_v4();

    // don't log client errors by default, because this makes us DOS-able
    let log_level = if status_code.is_server_error() {
        log::Level::Error
    } else {
        log::Level::Debug
    };

    log::log!(log_level,
        "Something went wrong: \n\n{}\n\n gave it user code {} with status {}. The origin was this request: {:?}",
        internal_message.unwrap_or_default(), code, status_code, request);

    // Perhaps we could we could use crypto::seal on the log message instead?
    let code = code.to_string();

    let public_message: String = public_message.unwrap_or_else(|| "".into());

    let data = expry::value!({
        "content": "error",
        "error_message": public_message,
        "code": code,
    })
    .to_vec(false);

    || -> anyhow::Result<TranslatedError> {
        Ok(TranslatedError {
            status: status_code,
            body: String::from_utf8(
                hairy_eval_html_translations(hair.to_ref(), data.to_ref(), translations)
                    .map_err(|s| anyhow::anyhow!(s))?,
            )
            .context("Templating failed.")?,
        })
    }()
    .unwrap_or_else(|e| {
        log::error!("failed to render error message to client: {}", e);
        TranslatedError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            body: "Translation failure for error".to_string(),
        }
    })
}

/// An opaque error.  Useful for crypto operations that do not wish to leak
/// any information via error details.
#[derive(thiserror::Error, Debug)]
pub enum Opaque {
    #[error("opaque error")]
    Error,
}

/// An opaque error
pub const OPAQUE: Opaque = Opaque::Error;
