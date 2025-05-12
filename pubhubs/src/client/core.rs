use std::borrow::{Borrow, Cow};
use std::collections::HashMap;
use std::marker::PhantomData;
use std::rc::Rc;

use crate::api::{ApiResultExt as _, EndpointDetails, ErrorCode, Result};
use crate::misc::fmt_ext;

use awc::error::StatusCode;
use awc::http::header::TryIntoHeaderValue;
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
}

impl<'a, EP, BU, BR, PP, HV> IntoFuture for QuerySetup<EP, BU, BR, PP, HV>
where
    EP: EndpointDetails + 'static,
    BU: Borrow<url::Url>,
    BR: Borrow<EP::RequestType>,
    PP: Borrow<PathParams<'a>>,
    HV: Borrow<http::HeaderValue>,
{
    type Output = Result<EP::ResponseType>;
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
    HV: Borrow<http::HeaderValue>,
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
        }
    }

    pub async fn with_retry(self) -> Result<EP::ResponseType> {
        let borrowed = self.borrow();
        let retry_fut = crate::misc::task::retry(|| async { borrowed.clone().await.retryable() });

        match retry_fut.await {
            Ok(Some(resp)) => Result::Ok(resp),
            Ok(None) => Result::Err(ErrorCode::TemporaryFailure),
            Err(ec) => Result::Err(ec),
        }
    }
}

impl<'a, EP, BU, BR, HV> QuerySetup<EP, BU, BR, PathParams<'a>, HV> {
    /// Sets path parameter `name` in [`EndpointDetails::PATH`] to `value`.
    pub fn path_param(mut self, name: &'static str, value: impl Into<Cow<'a, str>>) -> Self {
        self.path_params.insert(name, value.into());

        self
    }
}

impl<EP, BU, BR, PP> QuerySetup<EP, BU, BR, PP, http::HeaderValue> {
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
    &'a http::HeaderValue,
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
        }
    }
}

impl<EP: EndpointDetails + 'static> BorrowedQuerySetup<'_, EP> {
    fn into_future_impl(
        self,
    ) -> impl std::future::Future<Output = Result<EP::ResponseType>> + 'static + use<EP> {
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
                return futures::future::Either::Left(std::future::ready(Result::Err(
                    ErrorCode::InternalError,
                )));
            }

            let result = self.url.join(&path);
            if result.is_err() {
                log::error!(
                    "Could not join urls {} and {}: {}",
                    self.url,
                    path,
                    result.unwrap_err()
                );
                return futures::future::Either::Left(std::future::ready(Result::Err(
                    ErrorCode::Malconfigured,
                )));
            }
            result.unwrap()
        };

        log::debug!(
            "{}: Querying {} {} {}",
            self.client.inner.agent,
            EP::METHOD,
            &ep_url,
            fmt_ext::Json(&self.request)
        );

        let client_req = {
            let mut client_req = self
                .client
                .inner
                .http_client
                .request(EP::METHOD, ep_url.to_string())
                .content_type(EP::request_content_type());

            if let Some(auth_header) = self.auth_header {
                client_req = client_req.insert_header(("Authorization", auth_header));
            }

            client_req
        };

        let send_client_req = client_req.send_body(EP::serialize_request_type(self.request));

        futures::future::Either::Right(
            self.client
                .clone()
                .query_inner::<EP>(ep_url, send_client_req),
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
    ) -> impl std::future::Future<Output = Result<EP::ResponseType>> + use<EP, BU, BR>
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
            auth_header: None::<http::HeaderValue>,
        }
        .with_retry()
    }

    /// Sends a request to `EP` [endpoint](EndpointDetails) at `server_url`.
    pub fn query<'a, EP: EndpointDetails + 'static>(
        &self,
        server_url: &'a url::Url,
        req: &'a EP::RequestType,
    ) -> QuerySetup<EP, &'a url::Url, &'a EP::RequestType, PathParams<'a>, http::HeaderValue> {
        QuerySetup {
            client: self.clone(),
            url: server_url,
            request: req,
            phantom_ep: PhantomData,
            path_params: HashMap::new(),
            auth_header: None,
        }
    }

    async fn query_inner<EP: EndpointDetails + 'static>(
        self,
        url: url::Url,
        req: awc::SendClientRequest,
    ) -> Result<EP::ResponseType> {
        let mut resp = {
            let result = req.await;

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
                        awc::error::ConnectError::Disconnected => {
                            // might happen when the contacted server shuts down
                            log::warn!("server disconnected while querying {url}");
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
                    awc::error::SendRequestError::Response(err) => match err {
                        actix_web::error::ParseError::Timeout => {
                            log::warn!(
                                "getting response to request to {} {url} timed out",
                                EP::METHOD
                            );
                            ErrorCode::SeveredConnection
                        }
                        actix_web::error::ParseError::Io(io_err) => {
                            // this sometimes happens when the request causes the server to exit
                            log::warn!(
                                "error getting response to request to {} {url}: {io_err}",
                                EP::METHOD
                            );
                            ErrorCode::SeveredConnection
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
                            ErrorCode::InternalClientError
                        }
                        err => {
                            log::error!(
                                "unexpected error type while parsing response to request to {} {url}: {err}",
                                EP::METHOD
                            );
                            ErrorCode::InternalClientError
                        }
                    },
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
                        log::error!(
                            "unexpected error type while sending request to {} {url}: {err}",
                            EP::METHOD
                        );
                        ErrorCode::InternalClientError
                    }
                });
            }

            result.unwrap()
        };

        // check statuscode
        let status = resp.status();
        if !status.is_success() {
            let body = String::from_utf8(
                resp.body()
                    .await
                    .unwrap_or_else(|_| bytes::Bytes::from_static(b"<failed to load body>"))
                    .to_vec(),
            )
            .unwrap_or_else(|_| "<not utf8>".to_string());

            log::warn!(
                "request to {method} {url} was not succesfull: {status} {body:.100}",
                method = EP::METHOD
            );

            return Result::Err(match status {
                // Caddy returns 502 Bad Gateway when the service proxied to is (temporarily) down
                StatusCode::BAD_GATEWAY | StatusCode::GATEWAY_TIMEOUT => {
                    ErrorCode::CouldNotConnectYet
                }
                _ => ErrorCode::BadRequest,
            });
        }

        let response: Result<EP::ResponseType> = {
            let result = resp.json().await;
            if result.is_err() {
                log::error!(
                    "problem parsing response to {} {url} as JSON: {}",
                    EP::METHOD,
                    result.unwrap_err()
                );
                return Result::Err(ErrorCode::InternalClientError);
            }
            result.unwrap()
        };

        log::debug!(
            "{}: {} {} returned {}",
            self.inner.agent,
            EP::METHOD,
            &url,
            fmt_ext::Json(&response)
        );

        response
    }
}
