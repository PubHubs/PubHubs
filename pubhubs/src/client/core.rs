use std::rc::Rc;

use crate::misc::fmt_ext;

use crate::api::{ApiResultExt as _, EndpointDetails, ErrorCode, Result};

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

/// Builder for [Client]
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

struct Inner {
    http_client: awc::Client,
    agent: Agent,
}

impl Client {
    pub fn builder() -> Builder {
        Builder::default()
    }

    /// Like [Client::query], but retries the query when it fails with a [crate::api::ErrorInfo::retryable] [ErrorCode].
    ///
    /// When `A` queries `B` and `B` queries `C`, the `B` should, in general, not use
    /// [Client::query_with_retry], but let `A` manage retries.  This prevents `A`'s request from hanging
    /// without any explanation.
    pub async fn query_with_retry<EP: EndpointDetails + 'static>(
        &self,
        server_url: &url::Url,
        req: &EP::RequestType,
    ) -> Result<EP::ResponseType> {
        match crate::misc::task::retry(|| async {
            self.query::<EP>(server_url, req).await.retryable()
        })
        .await
        {
            Ok(Some(resp)) => Result::Ok(resp),
            Ok(None) => Result::Err(ErrorCode::TemporaryFailure),
            Err(ec) => Result::Err(ec),
        }
    }

    /// Sends a request to `EP` [endpoint](EndpointDetails) at `server_url`.
    ///
    /// NOTE: not `async fn` so that we can specify that the resulting future is `'static`,
    /// and so does not borrow `server_url` or `req`.
    pub fn query<EP: EndpointDetails + 'static>(
        &self,
        server_url: &url::Url,
        req: &EP::RequestType,
    ) -> impl std::future::Future<Output = Result<EP::ResponseType>> + 'static {
        // endpoint url
        let ep_url = {
            let result = server_url.join(EP::PATH);
            if result.is_err() {
                log::error!(
                    "Could not join urls {server_url} and {}: {}",
                    EP::PATH,
                    result.unwrap_err()
                );
                return futures::future::Either::Left(async move {
                    Result::Err(ErrorCode::Malconfigured)
                });
            }
            result.unwrap()
        };

        log::debug!(
            "{}: Querying {} {} {}",
            self.inner.agent,
            EP::METHOD,
            &ep_url,
            fmt_ext::Json(&req)
        );

        let client_req = self
            .inner
            .http_client
            .request(EP::METHOD, ep_url.to_string())
            .send_json(&req);

        futures::future::Either::Right(self.clone().query_inner::<EP>(ep_url, client_req))
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
            log::warn!(
                "request to {method} {url} was not succesfull: {status}",
                method = EP::METHOD
            );

            #[expect(clippy::match_single_binding)]
            return Result::Err(match status {
                // Maybe some status codes warrant a retry
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
