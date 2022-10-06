use hyper::http::HeaderValue;
use hyper::{Body, Client, Request, Response};
use hyper_tls::HttpsConnector;
use regex::Regex;

pub async fn irma_proxy_stream(request: Request<Body>, irma_url: &str) -> Response<Body> {
    let method = request.method().clone();
    let uri = request.uri().to_string();
    let headers = request.headers().clone();
    let https = HttpsConnector::new();
    let client = Client::builder().build::<_, hyper::Body>(https);

    let body = String::from_utf8(Vec::from(
        hyper::body::to_bytes(&mut request.into_body())
            .await
            .unwrap()
            .as_ref(),
    ))
    .unwrap();

    let mut req = Request::builder().uri(irma_url.to_owned() + &uri);

    for (x, y) in headers {
        req = req.header(x.unwrap(), y);
    }

    let req = req.method(method).body(Body::from(body)).unwrap();

    client.request(req).await.unwrap()
}

pub async fn irma_proxy(
    request: Request<Body>,
    irma_url: &str,
    proxy_host: &str,
) -> Response<Body> {
    let method = request.method().clone();
    let uri = request.uri().to_string();
    let headers = request.headers().clone();
    let https = HttpsConnector::new();
    let client = Client::builder().build::<_, hyper::Body>(https);

    let body = String::from_utf8(Vec::from(
        hyper::body::to_bytes(&mut request.into_body())
            .await
            .unwrap()
            .as_ref(),
    ))
    .unwrap();

    let mut req = Request::builder().uri(irma_url.to_owned() + &uri);

    for (x, y) in headers {
        req = req.header(x.unwrap(), y);
    }

    let req = req.method(method).body(Body::from(body)).unwrap();
    // client.request(req).await.unwrap()
    let mut resp = client.request(req).await.unwrap();
    let h = resp.headers().clone();
    let r = body_to_string(&mut resp).await;
    //TODO actually parse this, very sloppy this way
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
    let mut rresp = Response::new(Body::from(body_with_new_url.clone()));
    *rresp.headers_mut() = h;
    rresp
        .headers_mut()
        .insert("content-length", HeaderValue::from(body_with_new_url.len()));
    rresp
}

async fn body_to_string(mut response: &mut Response<Body>) -> String {
    String::from_utf8(Vec::from(
        hyper::body::to_bytes(&mut response).await.unwrap().as_ref(),
    ))
    .unwrap()
}

#[cfg(test)]
#[allow(unused_must_use)]
mod tests {
    use crate::irma_proxy;
    use core::convert::Infallible;
    use hyper::body::HttpBody;
    use hyper::http::HeaderValue;
    use hyper::service::make_service_fn;
    use hyper::service::service_fn;
    use hyper::{Body, Request, Response};
    use hyper::{Server, StatusCode};
    use std::net::SocketAddr;
    use std::sync::Arc;

    #[tokio::test]
    async fn it_works() {
        start_fake_server().await;
        let mut req = Request::new(Body::empty());
        req.headers_mut()
            .insert("x-test", HeaderValue::from_str("yes").unwrap());

        let resp = irma_proxy(req, "http://localhost:3005", "none").await;
        assert_eq!(resp.status(), StatusCode::OK);
        let content =
            String::from_utf8(resp.into_body().data().await.unwrap().unwrap().to_vec()).unwrap();

        assert_eq!(content, "Hello, World".to_string())
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
}
