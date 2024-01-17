use actix_web::dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::http::header::ContentType;
use actix_web::http::StatusCode;
use actix_web::web::Data;
use actix_web::{error, Error, HttpMessage as _, HttpResponse};

use std::fmt::{Debug, Display, Formatter};
use std::future::{ready, Future, Ready};
use std::pin::Pin;
use std::rc::Rc;

#[derive(Clone)]
pub struct Auth {}
#[derive(Debug)]
struct Forbidden;

/// Extracts context from service request, panics if the context was not set.
fn context_from_request(req: &ServiceRequest) -> &Data<crate::context::Main> {
    req.app_data::<Data<crate::context::Main>>()
        .expect("context not set")
}

impl Display for Forbidden {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "Forbidden")
    }
}

impl error::ResponseError for Forbidden {
    fn status_code(&self) -> StatusCode {
        StatusCode::FORBIDDEN
    }

    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status_code())
            .insert_header(ContentType::html())
            .body("Forbidden")
    }
}

impl<S, B> Transform<S, ServiceRequest> for Auth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddleware {
            service: Rc::new(service),
        }))
    }
}

pub struct AuthMiddleware<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for AuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();

        Box::pin(async move {
            let context = context_from_request(&req);

            if !context.is_admin_request(req.request()).await {
                return Err(Error::from(Forbidden {}));
            }
            service.call(req).await
        })
    }
}

/// Translation middleware
pub fn translate<
    B: actix_web::body::MessageBody,
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error>,
>(
    mut req: ServiceRequest,
    srv: &S,
) -> impl Future<Output = Result<ServiceResponse<B>, actix_web::Error>> {
    // based on actix_web::middleware::NormalizePath

    let context = context_from_request(&req).clone();
    // NB We clone the (pointer to) context here to prevent borrowing req,
    // which makes req immutable.

    let translations = context.translations.extract_lang(&mut req.head_mut().uri);

    // If translations is not none, uri was changed, and so req.match_info_mut
    // must be changed too (cf. actix_web::middleware::NormalizePath).
    if !translations.is_none() {
        let uri = req.uri().clone();
        req.match_info_mut().get_mut().update(&uri);
        // NB: clone uri to prevent borrowing req both mutably and immutably
    }

    // insert translations into the request, and assert it wasn't already set
    assert!(req.extensions_mut().insert(translations).is_none());

    srv.call(req)
}

/// Metrics authentication middleware
pub fn metrics_auth<
    B: actix_web::body::MessageBody,
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error>,
>(
    req: ServiceRequest,
    srv: &S,
) -> impl Future<Output = Result<ServiceResponse<B>, actix_web::Error>> {
    let context = context_from_request(&req).clone();
    if !context.is_metrics_request(req.headers()) {
        futures::future::Either::Left(async { Err(Error::from(Forbidden {})) })
    } else {
        futures::future::Either::Right(srv.call(req))
    }
}

/// Metrics middleware
pub fn metrics_middleware<
    B: actix_web::body::MessageBody,
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error>,
>(
    req: ServiceRequest,
    srv: &S,
) -> impl Future<Output = Result<ServiceResponse<B>, actix_web::Error>> {
    let resource = req.match_pattern().unwrap_or_default();
    let context = context_from_request(&req);
    let http_req_histogram = &context.http_req_histogram;
    let http_req_status = context.http_req_status.clone();

    //Add timer to the request, when the request is dropped the timer will end and record timings.
    let timer = http_req_histogram
        .with_label_values(&[&resource])
        .start_timer();
    req.extensions_mut().insert(timer);

    let fut = srv.call(req);

    async move {
        let resp = fut.await;
        let status = match resp {
            Ok(ref res) => res.status(),
            Err(ref e) => e.as_response_error().status_code(),
        };

        http_req_status
            .with_label_values(&[&resource, status.as_str()])
            .inc();

        resp
    }
}

pub fn hotfix_middleware<
    B: actix_web::body::MessageBody + 'static,
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error>,
>(
    req: ServiceRequest,
    srv: &S,
) -> impl Future<Output = Result<ServiceResponse, actix_web::Error>>
where
    B::Error: Debug,
{
    let context = context_from_request(&req).clone();

    let fut = srv.call(req);

    async move {
        let mut resp = fut.await?.map_into_boxed_body();

        for header in context.hotfixes.remove_headers.iter() {
            resp.headers_mut().remove(header);
        }

        if context.hotfixes.no_streaming {
            let (req, http_resp): (actix_web::HttpRequest, actix_web::HttpResponse) =
                resp.into_parts();
            let (http_resp, body): (actix_web::HttpResponse<()>, actix_web::body::BoxBody) =
                http_resp.into_parts();

            let bytes: bytes::Bytes = actix_web::body::to_bytes(body).await?;

            resp = ServiceResponse::new(req, http_resp.set_body(bytes)).map_into_boxed_body();
        }

        Ok(resp)
    }
}
