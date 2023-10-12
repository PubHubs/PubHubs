//! Adds tools to [crate::api] for servers.
use serde::Serialize;

pub use crate::api::*;

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
