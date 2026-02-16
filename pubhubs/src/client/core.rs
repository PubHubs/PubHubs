use std::borrow::{Borrow, Cow};
use std::collections::HashMap;
use std::marker::PhantomData;
use std::rc::Rc;

use crate::api::{
    ApiResultExt as _, EndpointDetails, ErrorCode, Payload, PayloadTrait, Result,
    ResultPayloadTrait as _,
};
use crate::misc::fmt_ext;

use awc::error::StatusCode;
use awc::http::{self, header::TryIntoHeaderValue};
use futures_util::FutureExt as _;

/// Client for making requests to pubhubs servers and hubs; cheaply clonable
#[derive(Clone)]
pub struct Client {
    inner: Rc<Inner>,
}

/// Identifies the entity usig the client, for debugging purposes
#[derive(Default)]
pub enum Agent {
    Server(crate::servers::server::Name),
    Cli,
    Hub,
    IntegrationTest,

    #[default]
    Unspecified,
}

impl std::fmt::Display for Agent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::result::Result<(), std::fmt::Error> {
        match self {
            Agent::Server(name) => name.fmt(f),
            Agent::Cli => "CLI".fmt(f),
            Agent::Hub => "Hub".fmt(f),
            Agent::IntegrationTest => "Integration Test".fmt(f),
            Agent::Unspecified => "???".fmt(f),
        }
    }
}

/// Builder for [`Client`]
#[derive(Default)]
pub struct Builder {
    agent: Agent,
}

impl Builder {
    pub fn finish(self) -> Client {
        let http_client = awc::Client::default();

        Client {
            inner: Rc::new(Inner {
                http_client,
                agent: self.agent,
            }),
        }
    }

    pub fn agent(mut self, agent: Agent) -> Self {
        self.agent = agent;
        self
    }
}

/// The inner part of [`Client`]
struct Inner {
    http_client: awc::Client,
    agent: Agent,
}

/// Details for a query to be sent to a pubhubs server
pub struct QuerySetup<EP, BU, BR, PP, HV> {
    client: Client,
    phantom_ep: PhantomData<EP>,
    url: BU,
    request: BR,
    path_params: PP,
    auth_header: Option<HV>,
    timeout: Option<core::time::Duration>,
    quiet: bool,
}

impl<'a, EP, BU, BR, PP, HV> IntoFuture for QuerySetup<EP, BU, BR, PP, HV>
where
    EP: EndpointDetails + 'static,
    BU: Borrow<url::Url>,
    BR: Borrow<EP::RequestType>,
    PP: Borrow<PathParams<'a>>,
    HV: Borrow<http::header::HeaderValue>,
{
    type Output = EP::ResponseType;
    type IntoFuture = futures::future::LocalBoxFuture<'static, Self::Output>;

    fn into_future(self) -> Self::IntoFuture {
        let borrowed = self.borrow();
        let fut = borrowed.into_future_impl();
        fut.boxed_local()
    }
}

impl<'pp, EP, BU, BR, PP, HV> QuerySetup<EP, BU, BR, PP, HV>
where
    EP: EndpointDetails + 'static,
    BU: Borrow<url::Url>,
    BR: Borrow<EP::RequestType>,
    PP: Borrow<PathParams<'pp>>,
    HV: Borrow<http::header::HeaderValue>,
{
    fn borrow<'s>(&'s self) -> BorrowedQuerySetup<'s, EP>
    where
        'pp: 's,
    {
        QuerySetup {
            client: self.client.clone(),
            phantom_ep: PhantomData,
            path_params: self.path_params.borrow(),
            request: self.request.borrow(),
            url: self.url.borrow(),
            auth_header: self.auth_header.as_ref().map(|v| v.borrow()),
            timeout: self.timeout,
            quiet: self.quiet,
        }
    }

    pub async fn with_retry(self) -> EP::ResponseType {
        let borrowed = self.borrow();
        let retry_fut =
            crate::misc::task::retry(|| async { borrowed.clone().await.into_result().retryable() });

        EP::ResponseType::from_result(match retry_fut.await {
            Ok(Some(resp)) => Result::Ok(resp),
            Ok(None) => Result::Err(ErrorCode::PleaseRetry),
            Err(ec) => Result::Err(ec),
        })
    }
}

impl<EP, BU, BR, HV, PP> QuerySetup<EP, BU, BR, PP, HV> {
    /// Override timeout for this request
    pub fn timeout(mut self, duration: core::time::Duration) -> Self {
        self.timeout = Some(duration);

        self
    }

    /// Reduces logging for common errors, like not being able to connect.
    /// Use this to prevent errors in recurrring querries from swamping the log.
    pub fn quiet(mut self) -> Self {
        self.quiet = true;
        self
    }
}

impl<'a, EP, BU, BR, HV> QuerySetup<EP, BU, BR, PathParams<'a>, HV> {
    /// Sets path parameter `name` in [`EndpointDetails::PATH`] to `value`.
    pub fn path_param(mut self, name: &'static str, value: impl Into<Cow<'a, str>>) -> Self {
        self.path_params.insert(name, value.into());

        self
    }
}

impl<EP, BU, BR, PP> QuerySetup<EP, BU, BR, PP, http::header::HeaderValue> {
    /// Set `Authorization` header value.
    pub fn auth_header(mut self, value: impl TryIntoHeaderValue) -> Self {
        let original_value = std::mem::replace(
            &mut self.auth_header,
            value.try_into_value().map(Some).unwrap_or_else(|_| {
                log::error!("failed to set authorization header on request",);
                None
            }),
        );

        if original_value.is_some() {
            log::warn!("authorization header set twice");
        }

        self
    }
}

/// Base type for [`QuerySetup::path_params`]
type PathParams<'a> = HashMap<&'static str, Cow<'a, str>>;

/// Result of [`QuerySetup::borrow`], used by [`QuerySetup::with_retry`].
pub(crate) type BorrowedQuerySetup<'a, EP> = QuerySetup<
    EP,
    &'a url::Url,
    &'a <EP as EndpointDetails>::RequestType,
    &'a PathParams<'a>,
    &'a http::header::HeaderValue,
>;

impl<EP: EndpointDetails + 'static> Clone for BorrowedQuerySetup<'_, EP> {
    fn clone(&self) -> Self {
        QuerySetup {
            client: self.client.clone(), // cheap, Rc
            phantom_ep: PhantomData,
            path_params: self.path_params,
            request: self.request,
            url: self.url,
            auth_header: self.auth_header,
            timeout: self.timeout,
            quiet: self.quiet,
        }
    }
}

impl<EP: EndpointDetails + 'static> BorrowedQuerySetup<'_, EP> {
    fn into_future_impl(
        self,
    ) -> impl std::future::Future<Output = EP::ResponseType> + 'static + use<EP> {
        // endpoint url
        let ep_url = {
            let mut path = String::new();
            let resource = actix_web::dev::ResourceDef::new(EP::PATH);

            if !resource.resource_path_from_map(&mut path, self.path_params) {
                log::warn!(
                    "Failed to replace path parameters in {} by {:?} - did you provide all path params?",
                    EP::PATH,
                    self.path_params
                );
                return futures::future::Either::Left(std::future::ready(
                    EP::ResponseType::from_ec(ErrorCode::InternalError),
                ));
            }

            let result = self.url.join(&path);

            if let Err(err) = result {
                log::error!("Could not join urls {} and {}: {}", self.url, path, err);
                return futures::future::Either::Left(std::future::ready(
                    EP::ResponseType::from_ec(ErrorCode::InternalError),
                ));
            }
            result.unwrap()
        };

        let payload = self.request.to_payload();

        if !self.quiet {
            log::debug!(
                "{}: Querying {} {} {payload}",
                self.client.inner.agent,
                EP::METHOD,
                &ep_url,
            );
        }

        let client_req = {
            let mut client_req = self
                .client
                .inner
                .http_client
                .request(EP::METHOD, ep_url.to_string())
                .insert_header(("User-Agent", "pubhubs")); // see issue #1432

            if let Some(ct) = payload.content_type() {
                client_req = client_req.content_type(ct.try_into_value().unwrap());
            }

            if let Some(auth_header) = self.auth_header {
                client_req = client_req.insert_header(("Authorization", auth_header));
            }

            if let Some(timeout) = self.timeout {
                client_req = client_req.timeout(timeout);
            }

            client_req
        };

        let payload_bytes_maybe = match payload.into_body() {
            Ok(payload_bytes_maybe) => payload_bytes_maybe,
            Err(err) => {
                log::error!(
                    "{agent}: Failed to query {method} {url}: could not serialize payload: {err:#}",
                    agent = self.client.inner.agent,
                    method = EP::METHOD,
                    url = &ep_url
                );
                return futures::future::Either::Left(std::future::ready(
                    EP::ResponseType::from_ec(ErrorCode::BadRequest),
                ));
            }
        };

        let send_client_req = match payload_bytes_maybe {
            Some(bytes) => client_req.send_body(bytes),
            None => client_req.send(),
        };

        futures::future::Either::Right(
            self.client
                .clone()
                .query_inner::<EP>(ep_url, send_client_req, self.quiet)
                .map(EP::ResponseType::from_result),
        )
    }
}

impl Client {
    /// Creates a new [`Builder`].
    pub fn builder() -> Builder {
        Builder::default()
    }

    /// Like [`Client::query`], but retries the query when it fails with a [`crate::api::ErrorInfo::retryable`] [`ErrorCode`].
    ////
    /// When `A` queries `B` and `B` queries `C`, the `B` should, in general, not use
    /// [`Client::query_with_retry`], but let `A` manage retries.  This prevents `A`'s request from hanging
    /// without any explanation.
    ///
    /// Unlike [`Client::query`], the future returned by `query_with_retry` borrows `server_url`
    /// and `req`.  (It does not borrow `self`.)
    ///
    /// The borrowing of `server_url` and `req` by the returned future has the unfortunate
    /// side-effect that when the future is passed to, say, [`tokio::spawn`], `server_url`
    /// and `req` are forced to have the `'static` lifetime.  In such cases it's easiest to pass
    /// `server_url` and `req` not by reference, but by value - whence the use of the [`Borrow<T>`] trait,
    /// which is implemented both by `T` and `&T`.
    pub fn query_with_retry<EP: EndpointDetails + 'static, BU, BR>(
        &self,
        server_url: BU,
        req: BR,
    ) -> impl std::future::Future<Output = EP::ResponseType> + use<EP, BU, BR>
    where
        BU: Borrow<url::Url>,
        BR: Borrow<EP::RequestType>,
    {
        QuerySetup {
            client: self.clone(),
            url: server_url,
            request: req,
            phantom_ep: PhantomData::<EP>,
            path_params: HashMap::new(),
            auth_header: None::<http::header::HeaderValue>,
            timeout: None,
            quiet: false,
        }
        .with_retry()
    }

    /// Sends a request to `EP` [endpoint](EndpointDetails) at `server_url`.
    pub fn query<'a, EP: EndpointDetails + 'static>(
        &self,
        server_url: &'a url::Url,
        req: impl Borrow<EP::RequestType> + 'a,
    ) -> QuerySetup<
        EP,
        &'a url::Url,
        impl Borrow<EP::RequestType>,
        PathParams<'a>,
        http::header::HeaderValue,
    > {
        QuerySetup {
            client: self.clone(),
            url: server_url,
            request: req,
            phantom_ep: PhantomData,
            path_params: HashMap::new(),
            auth_header: None,
            timeout: None,
            quiet: false,
        }
    }

    async fn query_inner<EP: EndpointDetails + 'static>(
        self,
        url: url::Url,
        req: awc::SendClientRequest,
        quiet: bool,
    ) -> Result<EP::ResponseType> {
        let mut resp = {
            let result = req.await;

            if let Err(err) = result {
                return Result::Err(match err {
                    awc::error::SendRequestError::Url(err) => {
                        log::error!("unexpected problem with {url}: {err}");
                        ErrorCode::InternalError
                    }
                    awc::error::SendRequestError::Connect(err) => match err {
                        awc::error::ConnectError::Timeout => {
                            if !quiet {
                                log::warn!("connecting to {url} timed out");
                            }
                            ErrorCode::PleaseRetry
                        }
                        awc::error::ConnectError::Resolver(err) => {
                            if !quiet {
                                log::warn!("resolving {url}: {err}");
                            }
                            ErrorCode::PleaseRetry
                        }
                        awc::error::ConnectError::Io(err) => {
                            // might happen when the port is closed
                            if !quiet {
                                log::warn!("io error while connecting to {url}: {err}");
                            }
                            ErrorCode::PleaseRetry
                        }
                        awc::error::ConnectError::Disconnected => {
                            // might happen when the contacted server shuts down
                            log::warn!("server disconnected while querying {url}");
                            ErrorCode::PleaseRetry
                        }
                        _ => {
                            log::error!("error connecting to {url}: {err}");
                            ErrorCode::BadRequest
                        }
                    },
                    awc::error::SendRequestError::Send(err) => {
                        log::warn!(
                            "error while sending request to {} {url}: {}",
                            EP::METHOD,
                            err
                        );
                        ErrorCode::PleaseRetry
                    }
                    awc::error::SendRequestError::Response(err) => match err {
                        actix_web::error::ParseError::Timeout => {
                            if !quiet {
                                log::warn!(
                                    "getting response to request to {} {url} timed out",
                                    EP::METHOD
                                );
                            }
                            ErrorCode::PleaseRetry
                        }
                        actix_web::error::ParseError::Io(io_err) => {
                            // this sometimes happens when the request causes the server to exit
                            log::warn!(
                                "error getting response to request to {} {url}: {io_err}",
                                EP::METHOD
                            );
                            ErrorCode::PleaseRetry
                        }
                        actix_web::error::ParseError::Method
                        | actix_web::error::ParseError::Uri(_)
                        | actix_web::error::ParseError::Version
                        | actix_web::error::ParseError::Header
                        | actix_web::error::ParseError::TooLarge
                        | actix_web::error::ParseError::Incomplete
                        | actix_web::error::ParseError::Status
                        | actix_web::error::ParseError::Utf8(_) => {
                            log::error!(
                                "problem parsing response from {} {url}: {err}",
                                EP::METHOD,
                            );
                            ErrorCode::InternalError
                        }
                        err => {
                            log::error!(
                                "unexpected error type while parsing response to request to {} {url}: {err}",
                                EP::METHOD
                            );
                            ErrorCode::InternalError
                        }
                    },
                    awc::error::SendRequestError::Http(err) => {
                        log::error!("HTTP error with request {} {url}: {err}", EP::METHOD,);
                        ErrorCode::InternalError
                    }
                    awc::error::SendRequestError::H2(err) => {
                        log::error!("HTTP/2 error with request {} {url}: {err}", EP::METHOD,);
                        ErrorCode::InternalError
                    }
                    awc::error::SendRequestError::Timeout => {
                        if !quiet {
                            log::warn!("request to {} {url} timed out", EP::METHOD);
                        }
                        ErrorCode::PleaseRetry
                    }
                    awc::error::SendRequestError::TunnelNotSupported => {
                        log::error!("unexpected 'TunnelNotSupported' error");
                        ErrorCode::InternalError
                    }
                    awc::error::SendRequestError::Body(err) => {
                        log::warn!(
                            "problem sending request body to {} {url}: {err}",
                            EP::METHOD
                        );
                        ErrorCode::PleaseRetry
                    }
                    awc::error::SendRequestError::Custom(err, dbg) => {
                        log::error!("unexpected custom error: {err}; {dbg:?}",);
                        ErrorCode::InternalError
                    }
                    err => {
                        log::error!(
                            "unexpected error type while sending request to {} {url}: {err}",
                            EP::METHOD
                        );
                        ErrorCode::InternalError
                    }
                });
            }

            result.unwrap()
        };

        // check statuscode
        let status = resp.status();
        if !status.is_success() {
            let body = resp
                .body()
                .await
                .unwrap_or_else(|_| bytes::Bytes::from_static(b"<failed to load body>"))
                .to_vec();

            if !quiet {
                log::warn!(
                    "{agent}: {method} {url} was not succesfull: {status} {body:.100}",
                    method = EP::METHOD,
                    body = fmt_ext::Bytes(&body),
                    agent = self.inner.agent,
                );
            }

            return Result::Err(match status {
                // Caddy returns 502 Bad Gateway when the service proxied to is (temporarily) down
                StatusCode::BAD_GATEWAY | StatusCode::GATEWAY_TIMEOUT => ErrorCode::PleaseRetry,
                _ => ErrorCode::BadRequest,
            });
        }

        let payload =
            Payload::<<EP::ResponseType as PayloadTrait>::JsonType>::from_client_response(resp)
                .await
                .map_err(|err| {
                    log::error!(
                        "{agent}: {method} {url} failed to deserialize payload: {err:#}",
                        method = EP::METHOD,
                        agent = self.inner.agent,
                    );
                    ErrorCode::InternalError
                })?;

        if !quiet {
            log::debug!(
                "{agent}: {method} {url} returned {payload}",
                agent = self.inner.agent,
                method = EP::METHOD,
            );
        }

        EP::ResponseType::from_payload(payload).map_err(|err| {
            log::error!(
                "{agent}: {method} {url} failed to convert to {typename}: {err:#}",
                typename = std::any::type_name::<EP::ResponseType>(),
                method = EP::METHOD,
                agent = self.inner.agent,
            );
            ErrorCode::InternalError
        })
    }
}
