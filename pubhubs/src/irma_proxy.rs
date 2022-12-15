use actix_web::http::header::CONTENT_LENGTH;
use actix_web::web::Data;
use actix_web::{HttpRequest, HttpResponse};
use anyhow::anyhow;
use regex::Regex;

use crate::context::Main;
use crate::error::{AnyhowExt, HttpContextExt, TranslatedError};

pub async fn irma_proxy_stream(
    request: HttpRequest,
    context: Data<Main>,
    body: String,
) -> Result<HttpResponse, TranslatedError> {
    let irma_url = &context.irma.client_url;
    let client = awc::Client::default();
    let uri = request.uri().to_string();

    let mut request_to_irma = client.request(request.method().clone(), irma_url.to_owned() + &uri);
    for pair in request.headers() {
        request_to_irma = request_to_irma.insert_header(pair);
    }

    let original_response = request_to_irma
        .send_body(body)
        .await
        .map_err(|e| anyhow!(e.to_string()))
        .bad_gateway()
        .into_translated_error(&request)?;

    let mut resp = HttpResponse::build(original_response.status());
    for pair in original_response.headers() {
        resp.insert_header(pair);
    }
    Ok(resp.streaming(original_response))
}

pub async fn irma_proxy(
    request: HttpRequest,
    context: Data<Main>,
    body: String,
) -> Result<HttpResponse, TranslatedError> {
    let irma_url = &context.irma.client_url;
    let proxy_host = &context.url;
    let uri = request.uri().to_string();
    let client = awc::Client::default();

    let mut request_to_irma = client.request(request.method().clone(), irma_url.to_owned() + &uri);
    for pair in request.headers() {
        request_to_irma = request_to_irma.insert_header(pair);
    }

    let mut original_response = request_to_irma
        .send_body(body)
        .await
        .map_err(|e| anyhow!(e.to_string()))
        .bad_gateway()
        .into_translated_error(&request)?;

    let mut resp = HttpResponse::build(original_response.status());
    for pair in original_response.headers() {
        resp.insert_header(pair);
    }
    let r = String::from_utf8(
        original_response
            .body()
            .await
            .bad_gateway()
            .into_translated_error(&request)?
            .to_vec(),
    )
    .into_translated_error(&request)?;

    // We want to replace all instances of a "u" in a IRMA response whatever the structure of the request is.
    let re = Regex::new(r#""u":"https?://[^/]+/"#).unwrap();

    let body_with_new_url = if re.is_match(&r) {
        re.replace(&r, format!(r#""u":"{}"#, proxy_host))
            .to_string()
    } else {
        let re_api = Regex::new(r#""u":""#).unwrap();
        re_api
            .replace(&r, format!(r#""u":"{}irma/"#, proxy_host))
            .to_string()
    };

    resp.insert_header((CONTENT_LENGTH, body_with_new_url.len()));
    Ok(resp.body(body_with_new_url))
}

#[cfg(test)]
#[allow(unused_must_use)]
mod tests {
    use crate::config::File;
    use crate::context::Main;
    use actix_web::test::TestRequest;
    use actix_web::web::Data;
    use actix_web::{body::MessageBody, rt::pin, web};
    use core::convert::Infallible;
    use hyper::service::make_service_fn;
    use hyper::service::service_fn;
    use hyper::{Body, Request, Response};
    use hyper::{Server, StatusCode};
    use std::future;
    use std::net::SocketAddr;
    use std::sync::Arc;

    #[actix_web::test]
    async fn it_works() {
        start_fake_server().await;
        let req = TestRequest::get()
            .insert_header(("x-test", "yes"))
            .to_http_request();
        let context = create_test_context_with(|mut f| {
            f.irma.client_url = Some("http://localhost:3005/test1".to_string());
            f
        })
        .await
        .unwrap();

        let resp = super::irma_proxy(req.clone(), Data::from(context.clone()), "none".to_owned())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let content =
            String::from_utf8(resp.into_body().try_into_bytes().unwrap().to_vec()).unwrap();

        assert_eq!(content, "Hello, World".to_string());

        let resp = super::irma_proxy_stream(req, Data::from(context), "none".to_owned())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = resp.into_body();
        pin!(body);

        let bytes = future::poll_fn(|cx| body.as_mut().poll_next(cx)).await;
        assert_eq!(
            bytes.unwrap().unwrap(),
            web::Bytes::from_static(b"Hello, World")
        );
    }

    async fn start_fake_server() {
        let port_bound = Arc::new(tokio::sync::Notify::new());

        {
            let port_bound = port_bound.clone();
            tokio::spawn(async move {
                // We'll bind to 127.0.0.1:3005
                let addr = SocketAddr::from(([127, 0, 0, 1], 3005));

                // A `Service` is needed for every connection, so this
                // creates one from our `hello_world` function.
                let make_svc = make_service_fn(|_conn| async {
                    // service_fn converts our function into a `Service`
                    Ok::<_, Infallible>(service_fn(move |req| handle(req)))
                });

                let server = Server::bind(&addr).serve(make_svc);

                port_bound.notify_one();

                // Run this server for... forever!
                if let Err(e) = server.await {
                    eprintln!("server error: {}", e);
                }
            });
        }

        port_bound.notified().await;
    }

    async fn handle(req: Request<Body>) -> Result<Response<Body>, Infallible> {
        Ok(hello_world(req).await)
    }
    async fn hello_world(req: Request<Body>) -> Response<Body> {
        assert_eq!(
            req.headers().get("x-test").unwrap().to_str().unwrap(),
            "yes"
        );
        Response::new("Hello, World".into())
    }

    async fn create_test_context_with(
        config: impl FnOnce(File) -> File,
    ) -> anyhow::Result<Arc<Main>> {
        Main::create(config(File::for_testing())).await
    }
}
