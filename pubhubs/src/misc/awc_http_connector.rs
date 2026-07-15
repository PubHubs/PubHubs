//! An [`object_store`] [`osc::HttpConnector`] built on [`awc`], letting the S3 store run without
//! `reqwest` (and hence without `ring`).

use std::pin::Pin;
use std::task::Poll;
use std::time::Duration;

use bytes::Bytes;
use futures_util::StreamExt as _;
use http_body::{Body as _, Frame};
use tokio::sync::mpsc;

use object_store::client as osc;

use crate::misc::stream_ext::{StreamExt as _, SyncStream, Truncated};

/// An [`object_store`] [`osc::HttpConnector`]: a factory that builds one [`awc`]-backed [`osc::HttpClient`]
/// per [`osc::HttpConnector::connect`] call.  Create using [`AwcHttpConnector::new`].
///
/// Reusing `awc` keeps our whole outbound HTTP stack — including the process-wide post-quantum
/// rustls provider (see [`crate::misc::rustls_ext`]) — in one place, and keeps `reqwest` (and
/// transitively `ring`) out of the build.
///
/// object_store calls `connect` once per HTTP client it needs — the main store client and, for
/// non-static credentials, separate credential/metadata clients — each with its own
/// [`osc::ClientOptions`] (e.g. the IMDS metadata client asks for a shorter connect timeout).  We mirror
/// its reqwest connector by building one `awc::Client` per call, configured from that call's options.
#[derive(Clone, Debug, Default)]
pub struct AwcHttpConnector;

impl AwcHttpConnector {
    pub fn new() -> Self {
        Self
    }
}

impl osc::HttpConnector for AwcHttpConnector {
    fn connect(&self, options: &osc::ClientOptions) -> object_store::Result<osc::HttpClient> {
        // We honor only the options in `ConnectorOptions::HONORED_CLIENT_OPTIONS`; every other
        // admin-settable client option is rejected at store construction (see
        // crate::servers::object_store::DefaultObjectStore), so none is silently dropped.
        let mut opts = ConnectorOptions::default();
        for &(key, apply) in ConnectorOptions::HONORED_CLIENT_OPTIONS {
            if let Some(value) = options.get_config_value(&key) {
                opts = apply(opts, key, value)?;
            }
        }

        let allow_http = opts.allow_http;
        let timeout = opts.timeout;
        let connect_timeout = opts.connect_timeout;
        let jobs = opts
            .spawn_worker()
            .map_err(|err| object_store::Error::Generic {
                store: "AwcHttpConnector",
                source: format!("could not spawn the awc-object-store worker thread: {err}").into(),
            })?;

        Ok(osc::HttpClient::new(AwcClient {
            jobs,
            allow_http,
            timeout,
            connect_timeout,
        }))
    }
}

/// The client options [`AwcHttpConnector::connect`](osc::HttpConnector::connect) understands, parsed from [`osc::ClientOptions`].
pub(crate) struct ConnectorOptions {
    /// Whether plaintext HTTP is permitted (enforced in [`AwcClient::call`](osc::HttpService::call)).
    allow_http: bool,

    /// Overall request timeout; `None` means it was explicitly disabled.
    timeout: Option<Duration>,

    /// Connection-establishment timeout; `None` means it was explicitly disabled.
    connect_timeout: Option<Duration>,

    /// Restrict to HTTP/1.1 (no HTTP/2); see [`ConnectorOptions::build_client`].
    http1_only: bool,

    /// `User-Agent` header to send; `None` falls back to awc's default.
    user_agent: Option<String>,
}

impl Default for ConnectorOptions {
    fn default() -> Self {
        Self {
            allow_http: false,
            timeout: None,
            connect_timeout: None,

            // Mirror object_store's `ClientOptions`, whose `http1_only` defaults to true, so the
            // starting point matches even before the option is read.
            http1_only: true,
            user_agent: None,
        }
    }
}

/// How [`AwcHttpConnector::connect`](osc::HttpConnector::connect) folds one honored client
/// option into [`ConnectorOptions`]: given the options parsed so far, return them with this one set.  
type ApplyOption =
    fn(ConnectorOptions, osc::ClientConfigKey, String) -> object_store::Result<ConnectorOptions>;

impl ConnectorOptions {
    /// The client options the awc connector honors, each paired with how it is applied.  This is the
    /// single source of truth for them: `connect` folds exactly these keys,
    /// [`ConnectorOptions::honors_client_config_key`] derives membership from it, and the S3 store
    /// builder rejects every other *transport* client option — those would only configure the built-in
    /// HTTP client we replaced.  (The builder still accepts a non-transport client key it can apply
    /// without the transport — `DefaultContentType`, a request header — see `object_store.rs`.)
    /// Supporting one more transport option is a single entry here.
    const HONORED_CLIENT_OPTIONS: &[(osc::ClientConfigKey, ApplyOption)] = &[
        (osc::ClientConfigKey::AllowHttp, |opts, key, value| {
            Ok(ConnectorOptions {
                allow_http: Self::parse_bool(key, &value)?,
                ..opts
            })
        }),
        (osc::ClientConfigKey::Timeout, |opts, key, value| {
            Ok(ConnectorOptions {
                timeout: Some(Self::parse_duration(key, value)?),
                ..opts
            })
        }),
        (osc::ClientConfigKey::ConnectTimeout, |opts, key, value| {
            Ok(ConnectorOptions {
                connect_timeout: Some(Self::parse_duration(key, value)?),
                ..opts
            })
        }),
        (osc::ClientConfigKey::Http1Only, |opts, key, value| {
            Ok(ConnectorOptions {
                http1_only: Self::parse_bool(key, &value)?,
                ..opts
            })
        }),
        (osc::ClientConfigKey::UserAgent, |opts, _key, value| {
            Ok(ConnectorOptions {
                user_agent: Some(value),
                ..opts
            })
        }),
    ];

    /// Parse bool client option.
    /// C.f. <https://github.com/apache/arrow-rs-object-store/blob/6c5b299d4274219ecd406cc4828b94efe4a14f8d/src/config.rs#L74-L86>
    fn parse_bool(key: osc::ClientConfigKey, value: &str) -> object_store::Result<bool> {
        match value.to_ascii_lowercase().as_str() {
            "1" | "true" | "on" | "yes" | "y" => Ok(true),
            "0" | "false" | "off" | "no" | "n" => Ok(false),
            _ => Err(object_store::Error::Generic {
                store: "AwcHttpConnector",
                source: format!(
                    "could not parse the {key:?} client option ({value:?}) as a boolean"
                )
                .into(),
            }),
        }
    }

    /// Parses a duration client option, rejecting one too large to be a real deadline: each request
    /// turns the timeout into an `Instant::now() + duration` deadline, which overflows (panics) for
    /// absurd values.
    /// C.f. <https://github.com/apache/arrow-rs-object-store/blob/6c5b299d4274219ecd406cc4828b94efe4a14f8d/src/config.rs#L88-L95>
    fn parse_duration(key: osc::ClientConfigKey, value: String) -> object_store::Result<Duration> {
        // A timeout longer than this is never a real deadline; capping it well below the overflow
        // boundary keeps deadline arithmetic safe with enormous margin.
        const MAX: Duration = Duration::from_secs(365 * 24 * 60 * 60); // one year

        let duration =
            humantime::parse_duration(&value).map_err(|err| object_store::Error::Generic {
                store: "AwcHttpConnector",
                source: format!(
                    "could not parse the {key:?} client option ({value:?}) as a duration: {err}"
                )
                .into(),
            })?;

        if duration > MAX {
            return Err(object_store::Error::Generic {
                store: "AwcHttpConnector",
                source: format!(
                    "the {key:?} client option ({value:?}) exceeds the one-year maximum; a timeout \
                     this long is never a real deadline — pick a realistic value"
                )
                .into(),
            });
        }

        Ok(duration)
    }

    /// Whether [`AwcHttpConnector::connect`](osc::HttpConnector::connect) reads `key` back from
    /// [`osc::ClientOptions`] — i.e. whether it is in [`ConnectorOptions::HONORED_CLIENT_OPTIONS`].
    /// The S3 store builder rejects every other client option (see `DefaultObjectStore`).
    pub(crate) fn honors_client_config_key(key: &osc::ClientConfigKey) -> bool {
        Self::HONORED_CLIENT_OPTIONS.iter().any(|(k, _)| k == key)
    }

    /// Spawns a worker thread — a current-thread runtime + `LocalSet` owning one `awc::Client` built
    /// from these options — and returns the channel that feeds it, or the error if the thread could
    /// not be spawned.  The worker thread stops when the channel is closed/dropped.
    ///
    /// `awc::Client` is `!Send`, but [`osc::HttpService`] must be `Send + Sync`: awc drives connections
    /// with [`tokio::task::spawn_local`] (so it needs a `LocalSet`) and its futures can't be awaited
    /// inside the `Send` future [`osc::HttpService::call`] returns.  We run our own thread rather than
    /// the caller's runtime because object_store does not promise the caller is on a `LocalSet`.  The
    /// thread exits once the returned sender and every clone are dropped (i.e. when the owning object
    /// store is).
    ///
    /// The runtime is built here, on the caller's thread (a `Runtime` is `Send`), then moved into the
    /// worker — so a failed runtime build surfaces as a construction-time error rather than letting
    /// every later request fail opaquely with [`Error::WorkerStopped`].  The `awc::Client` is still
    /// built on the worker thread, since it is `!Send`; that build is effectively infallible here (the
    /// process-wide rustls provider is installed in `main` before any store is constructed).
    fn spawn_worker(self) -> std::io::Result<mpsc::UnboundedSender<Job>> {
        let (jobs, mut requests) = mpsc::unbounded_channel::<Job>();
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()?;
        std::thread::Builder::new()
            .name("awc-object-store".to_owned())
            .spawn(move || {
                tokio::task::LocalSet::new().block_on(&runtime, async move {
                    let client = self.build_client();

                    while let Some(job) = requests.recv().await {
                        tokio::task::spawn_local(job.serve(client.clone()));
                    }
                });
            })?;
        Ok(jobs)
    }

    /// Builds the worker's `awc::Client` from these options: the `user_agent` and `http1_only`.  The
    /// request and connect timeouts are *not* applied here — awc's own timeouts don't match reqwest's
    /// semantics (its request timeout bounds only the response head, and its connect timeout is two
    /// per-phase budgets that can sum to ~2× the configured value).  Instead [`Job::serve`] enforces
    /// both as single wall-clock deadlines per request, started when the request is initiated (see
    /// [`Job::deadline`] and [`Job::connect_deadline`]), matching reqwest.  We therefore disable awc's
    /// built-in response timeout so its default cannot also fire.
    ///
    /// When `http1_only` is set (object_store defaults it to true, since HTTP/2 multiplexes onto a
    /// single TCP connection, which is slower for bulk object transfers) we restrict the client to
    /// HTTP/1.1.  This goes through `Connector::max_http_version`, which rebuilds the TLS config
    /// advertising only `http/1.1` in ALPN — still via `ClientConfig::builder()`, so it keeps the
    /// process-wide post-quantum rustls provider (see [`crate::misc::rustls_ext`]); swapping the
    /// connector in does not drop post-quantum key exchange.
    fn build_client(&self) -> awc::Client {
        let max_http_version = match self.http1_only {
            true => awc::http::Version::HTTP_11,
            false => awc::http::Version::HTTP_2,
        };
        let connector = awc::Connector::new().max_http_version(max_http_version);

        // The request and connect timeouts are enforced per-request as wall-clock deadlines in
        // [`Job::serve`], not here (see this method's doc).  Disable awc's built-in response timeout so
        // its default cannot fire on top of ours.
        let builder = awc::ClientBuilder::new()
            .connector(connector)
            .disable_timeout();

        // object_store's reqwest connector always sends a User-Agent: the admin-configured one, or its
        // own `object_store/<version>` default.  That default lives in a const object_store applies
        // only when building its own reqwest client — it is not carried in the `ClientOptions` we are
        // handed — so we substitute our own `pubhubs/<version>` rather than send none.
        let user_agent =
            self.user_agent
                .clone()
                .unwrap_or_else(|| match crate::servers::version::version() {
                    Some(version) => format!("{}/{}", env!("CARGO_PKG_NAME"), version),
                    // No known version (e.g. built outside a git checkout): send the bare name rather
                    // than a useless `pubhubs/n/a`.
                    None => env!("CARGO_PKG_NAME").to_owned(),
                });

        let builder = builder.add_default_header((awc::http::header::USER_AGENT, user_agent));
        builder.finish()
    }
}

/// The [`osc::HttpService`] used to implement [`AwcHttpConnector::connect`](osc::HttpConnector::connect).
#[derive(Clone, Debug)]
struct AwcClient {
    jobs: mpsc::UnboundedSender<Job>,

    /// Whether plaintext HTTP is permitted.
    allow_http: bool,

    /// Whole-request timeout, turned into each [`Job::deadline`]; `None` if disabled.
    timeout: Option<Duration>,

    /// Connect-phase timeout, turned into each [`Job::connect_deadline`]; `None` if disabled.
    connect_timeout: Option<Duration>,
}

#[async_trait::async_trait]
impl osc::HttpService for AwcClient {
    async fn call(&self, request: osc::HttpRequest) -> Result<osc::HttpResponse, osc::HttpError> {
        if !self.allow_http && request.uri().scheme() == Some(&http::uri::Scheme::HTTP) {
            return Err(Error::HttpNotAllowed(request.uri().clone()).into());
        }

        // Start the timeout clocks now, at request initiation, so they also cover the time the job
        // waits in the channel for the worker — like reqwest, whose timeout spans the whole operation.
        let now = tokio::time::Instant::now();
        let deadline = self.timeout.map(|t| now + t);

        // The connect phase is part of the whole request, so its deadline can't outlast the request
        // deadline; clamp it here so `serve` can use it directly as the head bound without re-deriving
        // the minimum.
        let connect_deadline = match (self.connect_timeout.map(|t| now + t), deadline) {
            (Some(connect), Some(deadline)) => Some(connect.min(deadline)),
            (connect_deadline, _) => connect_deadline,
        };

        let (respond_to, response) = tokio::sync::oneshot::channel();

        self.jobs
            .send(Job {
                request,
                respond_to,
                deadline,
                connect_deadline,
            })
            .map_err(|_| Error::WorkerStopped)?;

        response.await.map_err(|_| Error::WorkerStopped)?
    }
}

/// A request for the worker thread, with a channel for the response head.
struct Job {
    request: osc::HttpRequest,
    respond_to: tokio::sync::oneshot::Sender<Result<osc::HttpResponse, osc::HttpError>>,

    /// Whole-request deadline (connect + head + body), or `None` if no request timeout is set.
    /// Computed at request initiation in [`AwcClient::call`](osc::HttpService::call).
    deadline: Option<tokio::time::Instant>,

    /// Deadline for receiving the response head — connect *and* head, since awc's `send_body` bundles
    /// them into one future with no "connected" hook to split them.  `None` if no connect timeout is
    /// set, and otherwise clamped to not exceed [`Job::deadline`] (the connect phase is part of the
    /// whole request).  Computed at request initiation in [`AwcClient::call`](osc::HttpService::call).
    connect_deadline: Option<tokio::time::Instant>,
}

impl Job {
    /// Relays this request and answers the caller with the response head, whose body streams off the
    /// worker thread over a [`SyncStream`].  [`Job::connect_deadline`] bounds receiving the head and
    /// [`Job::deadline`] bounds the whole request, including each body read.
    async fn serve(self, client: awc::Client) {
        let Job {
            request,
            respond_to,
            deadline,
            connect_deadline,
        } = self;

        let (parts, body) = request.into_parts();

        // Producing the response head is fallible; do it in one block so a failure has a single exit.
        let prepared = async {
            let request = Self::build_request(&client, &parts)?;

            let send = request.send_body(RequestBody(body));
            let mut response = match connect_deadline.or(deadline) {
                Some(at) => tokio::time::timeout_at(at, send)
                    .await
                    .map_err(|_elapsed| Error::HeadTimeout)?
                    .map_err(Error::from)?,
                None => send.await.map_err(Error::from)?,
            };

            // S3 frames every response with Content-Length, never Transfer-Encoding (and RFC 9112 §6.1
            // makes the two mutually exclusive).  So Transfer-Encoding here means an intermediary
            // re-framed the body as chunked, in which case awc decodes by the transfer coding and ignores
            // Content-Length — leaving the length bookkeeping below working off a stale length.  Reject it
            // loudly rather than silently mis-frame.
            if response
                .headers()
                .contains_key(awc::http::header::TRANSFER_ENCODING)
            {
                return Err(Error::UnexpectedTransferEncoding.into());
            }

            // awc reports a Content-Length body cut short by a premature close as a clean end, not an
            // error (its decoder inherits tokio_util's default `decode_eof`).  So we remember the
            // promised length and check it ourselves once the stream ends; otherwise object_store would
            // accept a short object.
            //
            // A bodiless response carries no message body even when it advertises a Content-Length
            // (which then describes the resource, not bytes it will send), so we must not mistake its
            // (correct) empty body for truncation.  The bodiless subset an S3 client meets (RFC 9112
            // §6.3): any response to a HEAD request (HeadObject, bucket-exists checks), 304 Not Modified
            // (a conditional GetObject, which may echo the object's Content-Length), and 204 No Content
            // (DeleteObject).  The rule's other cases don't arise: S3's 100 Continue is consumed by awc
            // before the final response reaches us, and S3 clients never issue CONNECT.
            let expected_len = if parts.method == http::Method::HEAD
                || matches!(response.status().as_u16(), 204 | 304)
            {
                None
            } else {
                // The Content-Length the response declared, if any.
                response
                    .headers()
                    .get(awc::http::header::CONTENT_LENGTH)
                    .and_then(|value| value.to_str().ok())
                    .and_then(|value| value.parse::<u64>().ok())
            };

            // Translate the awc response head (the `http` 0.2 crate) into an object_store one
            // (`http` 1.x); its body is filled in below.
            let mut builder = http::Response::builder().status(response.status().as_u16());
            for (name, value) in response.headers() {
                builder = builder.header(name.as_str(), value.as_bytes());
            }

            // `awc::ClientResponse` is `!Send`, so we read the body here on the worker thread — bounding
            // each read and checking the promised length — and relay the chunks over a `SyncStream` to
            // the `Send` body object_store reads.  If this worker is torn down mid-stream the relay
            // yields [`Truncated`], which `ResponseBody` turns into a retryable error rather than let
            // object_store accept a silently short body.
            let source = async_stream::stream! {
                let mut received: u64 = 0;
                loop {
                    // Bound the body by the whole-request deadline: awc's timeouts don't cover the
                    // body, so without this a stalled (or trickling) body would tie up the worker past
                    // the configured timeout.  A lapse is retryable, so object_store can retry the
                    // (idempotent) request.
                    let next = match deadline {
                        Some(at) => match tokio::time::timeout_at(at, response.next()).await {
                            Ok(next) => next,
                            Err(_elapsed) => {
                                yield Err(Error::ReadTimeout);
                                return;
                            }
                        },
                        None => response.next().await,
                    };
                    match next {
                        Some(Ok(bytes)) => {
                            received += bytes.len() as u64;
                            yield Ok(bytes);
                        }
                        // awc surfaced a body error; forward it (object_store retries body errors).
                        Some(Err(err)) => {
                            yield Err(Error::ResponseBody(err.to_string()));
                            return;
                        }
                        None => break, // awc's response stream ended
                    }
                }

                if let Some(expected) = expected_len {
                    // `expected_len` is set only for a Content-Length–framed body (bodiless responses and
                    // Transfer-Encoding ones are excluded above), and awc's length decoder stops at the
                    // declared length, so `received` can fall short but never exceed it.  Were that ever
                    // untrue, awc would have handed object_store an over-long body; fail loudly instead.
                    assert!(
                        received <= expected,
                        "awc yielded {received} body bytes, exceeding the Content-Length of {expected}"
                    );
                    // A short Content-Length means a premature close, which object_store should retry rather
                    // than accept as a complete (but short) object.
                    if received < expected {
                        yield Err(Error::IncompleteBody { expected, received });
                    }
                }
            };

            // Queue at most this many response-body chunks ahead of a slow reader before the worker
            // blocks (backpressure), so a lagging consumer can't make the worker buffer the whole
            // object in memory.
            //
            // A bodiless response (HEAD, 204, 304 — frequent for an S3 store) still sets up this
            // channel and pump task only to relay zero bytes.  We don't special-case it: a bodiless
            // status bounds the *length check*, not what awc actually yields, so the uniform relay
            // faithfully forwards whatever frames arrive, at the cost of one wasted channel per such
            // response.
            let chunks = source.sync(std::num::NonZero::new(16).unwrap());

            // `head` is the whole `http::Response`, but only its head has arrived: the body is the
            // `SyncStream` object_store drains lazily off the worker, so building it reads no body bytes.
            let head = builder
                .body(osc::HttpResponseBody::new(ResponseBody { chunks }))
                .map_err(Error::Response)?;
            Ok::<_, osc::HttpError>(head)
        }
        .await;

        // The head is ready (or failed); hand it back over the oneshot.  The body's frames are read and
        // relayed in the background by the pump `source.sync` spawned, which outlives this `serve` call.
        match prepared {
            Ok(head) => {
                if respond_to.send(Ok(head)).is_err() {
                    log::debug!(
                        "object store: caller went away before the response head of {} {}",
                        parts.method,
                        parts.uri
                    );
                }
            }
            Err(err) => {
                let _ = respond_to.send(Err(err));
            }
        }
    }

    /// Translates an object_store request (the `http` 1.x crate) into an awc one (the `http` 0.2
    /// crate), through the version-agnostic byte/string forms of the method and headers.
    fn build_request(
        client: &awc::Client,
        parts: &http::request::Parts,
    ) -> Result<awc::ClientRequest, Error> {
        let method = awc::http::Method::from_bytes(parts.method.as_str().as_bytes())
            .map_err(|_| Error::Method(parts.method.clone()))?;

        let mut request = client.request(method, parts.uri.to_string());

        // Copy object_store's (SigV4-signed) headers verbatim.  We don't special-case Content-Length:
        // actix-http derives Content-Length/Transfer-Encoding from the body it sends, replacing any we
        // set, so the framing always matches the signed body bytes.
        for (name, value) in &parts.headers {
            let header_name = awc::http::header::HeaderName::from_bytes(name.as_str().as_bytes())
                .map_err(|_| Error::HeaderName(name.clone()))?;
            let header_value = awc::http::header::HeaderValue::from_bytes(value.as_bytes())
                .map_err(|_| Error::HeaderValue(name.clone()))?;
            request = request.append_header((header_name, header_value));
        }

        Ok(request)
    }
}

/// Something that went wrong relaying a request through [`awc`].
#[derive(Debug, thiserror::Error)]
enum Error {
    #[error("the awc worker thread has stopped")]
    WorkerStopped,

    #[error("awc rejected the request method {0:?}")]
    Method(http::Method),

    #[error("awc rejected the request header name {0:?}")]
    HeaderName(http::HeaderName),

    #[error("awc rejected the value of request header {0:?}")]
    HeaderValue(http::HeaderName),

    #[error(
        "refusing a plaintext HTTP request to {0}; set the object store's allow_http option to permit it"
    )]
    HttpNotAllowed(http::Uri),

    // A transport error from awc, pre-classified into the object_store kind that decides
    // retryability (see `classify_send_error`).  awc's `SendRequestError` is `!Sync` (it can hold a
    // `Box<dyn Debug>`) and `HttpError::new` wants `Send + Sync`, so we keep only its message.
    #[error("sending the request failed: {message}")]
    Transport {
        kind: osc::HttpErrorKind,
        message: String,
    },

    #[error("reading the response body failed: {0}")]
    ResponseBody(String),

    /// The remote under-delivered: awc ended the stream cleanly but fewer bytes arrived than the
    /// response's Content-Length (a premature close awc reports as a clean EOF).
    #[error("the response body was {received} bytes but its Content-Length was {expected}")]
    IncompleteBody { expected: u64, received: u64 },

    #[error(
        "the response used Transfer-Encoding, which S3's use of Content-Length precludes.  (Perhaps a proxy is to blame?)"
    )]
    UnexpectedTransferEncoding,

    #[error("reading the response body timed out")]
    ReadTimeout,

    #[error("establishing the connection or receiving the response head timed out")]
    HeadTimeout,

    #[error("assembling the response failed: {0}")]
    Response(#[from] http::Error),
}

impl From<awc::error::SendRequestError> for Error {
    /// Wraps an awc send error, classifying it into the object_store [`osc::HttpErrorKind`] up front (the
    /// error itself is `!Sync` and can't be carried, so we keep only its message).
    fn from(err: awc::error::SendRequestError) -> Self {
        Error::Transport {
            kind: Self::classify_send_error(&err),
            message: err.to_string(),
        }
    }
}

impl From<Error> for osc::HttpError {
    fn from(err: Error) -> Self {
        // object_store uses the kind to decide whether to retry.
        let kind = match &err {
            Error::Transport { kind, .. } => *kind,

            // awc reported a Content-Length short read as a clean end.  Interrupted is retried for
            // idempotent requests (and object_store's body-retry retries it regardless of kind).
            //
            Error::IncompleteBody { .. } => osc::HttpErrorKind::Interrupted,

            // A connect/head or body read that we timed out; retried for idempotent requests.
            Error::ReadTimeout | Error::HeadTimeout => osc::HttpErrorKind::Timeout,

            // Reading/decoding the response failed, or it was framed in a way S3 never uses;
            // re-sending can't help (a proxy will keep re-framing), so object_store does not retry this.
            Error::ResponseBody(_) | Error::Response(_) | Error::UnexpectedTransferEncoding => {
                osc::HttpErrorKind::Decode
            }

            // Construction or infrastructure failures: re-sending the identical request can't help
            // (a forbidden plaintext request, an un-translatable method/header, or a dead worker), so
            // we mark them non-retryable rather than let object_store spin on them.
            Error::HttpNotAllowed(_)
            | Error::WorkerStopped
            | Error::Method(_)
            | Error::HeaderName(_)
            | Error::HeaderValue(_) => osc::HttpErrorKind::Unknown,
        };
        osc::HttpError::new(kind, err)
    }
}

impl Error {
    /// Maps an awc transport error to the object_store [`osc::HttpErrorKind`] that best describes it.
    /// object_store's retry loop — not this function — then decides retryability from that kind: it
    /// retries `Connect`/`Request` unconditionally, `Timeout`/`Interrupted` only for idempotent
    /// requests, and never `Decode`/`Unknown`
    /// (<https://github.com/apache/arrow-rs-object-store/blob/6c5b299d4274219ecd406cc4828b94efe4a14f8d/src/client/retry.rs#L394-L399>).
    /// We pick each kind so that decision matches what object_store's own reqwest connector
    /// (`HttpError::reqwest`) would produce for the equivalent failure.
    fn classify_send_error(err: &awc::error::SendRequestError) -> osc::HttpErrorKind {
        use awc::error::SendRequestError;
        match err {
            // The connection was never established (DNS/TCP/TLS failure, or a connect/handshake
            // timeout): the request was not sent, so it is always safe to retry.
            SendRequestError::Connect(_) => osc::HttpErrorKind::Connect,

            // Our overall request timeout (`ClientBuilder::timeout`) elapsed: the request may have
            // reached the server, so object_store retries only when it is idempotent.
            SendRequestError::Timeout => osc::HttpErrorKind::Timeout,

            // An I/O error while writing the request to the socket: refine by the OS error kind,
            // exactly as the reqwest connector does for its hyper/io sources.
            SendRequestError::Send(io) => Self::classify_io_error(io),

            // The request body failed mid-send, or an HTTP/2 stream was reset: the request was partly
            // in flight, so retry only when idempotent.
            SendRequestError::Body(_) | SendRequestError::H2(_) => osc::HttpErrorKind::Interrupted,

            // Receiving the response head failed.  awc lumps transport failures here — a premature
            // close, a socket I/O error, or a read timeout *while receiving the head* — in with a
            // genuinely malformed head; `classify_parse_error` splits them so the transport ones stay
            // retryable (as reqwest classifies them) and only a real parse failure is a decode error.
            SendRequestError::Response(parse_err) => Self::classify_parse_error(parse_err),

            // A bad URL, an un-buildable request, or an unsupported tunnel: retrying can't help.
            // `SendRequestError` is `#[non_exhaustive]`, so `Custom` and any future variants land here.
            _ => osc::HttpErrorKind::Unknown,
        }
    }

    /// Maps a response-head [`ParseError`](actix_http::error::ParseError) to the object_store kind.
    /// awc surfaces a connection lost *while the head is being received* as a `ParseError` rather than
    /// a `Send`/`Connect` error, so we treat those transport variants as retryable (matching reqwest)
    /// and only a structurally invalid head as a non-retryable decode error.
    fn classify_parse_error(err: &actix_http::error::ParseError) -> osc::HttpErrorKind {
        use actix_http::error::ParseError;
        match err {
            // The stream reached EOF before the head was complete — the peer closed mid-response.
            ParseError::Incomplete => osc::HttpErrorKind::Interrupted,

            // A timeout waiting for the head to arrive.
            ParseError::Timeout => osc::HttpErrorKind::Timeout,

            // A socket I/O error: refine by its kind, exactly as a `Send` error is.
            ParseError::Io(io) => Self::classify_io_error(io),

            // A structurally invalid head (bad status line, header, version, oversized, non-UTF-8, …):
            // resending won't help.  `ParseError` is `#[non_exhaustive]`, so unknown future variants —
            // most likely new parse failures — are treated as decode errors too.
            _ => osc::HttpErrorKind::Decode,
        }
    }

    /// Maps an I/O error by matching `std::io::Error::kind()`, the same conversion object_store's
    /// reqwest connector applies when it finds a `std::io::Error` in the error source chain
    /// (`HttpError::reqwest`):
    /// <https://github.com/apache/arrow-rs-object-store/blob/6c5b299d4274219ecd406cc4828b94efe4a14f8d/src/client/http/connection.rs#L122-L132>
    fn classify_io_error(err: &std::io::Error) -> osc::HttpErrorKind {
        use std::io::ErrorKind;
        match err.kind() {
            ErrorKind::TimedOut => osc::HttpErrorKind::Timeout,
            ErrorKind::ConnectionAborted
            | ErrorKind::ConnectionReset
            | ErrorKind::BrokenPipe
            | ErrorKind::UnexpectedEof => osc::HttpErrorKind::Interrupted,
            _ => osc::HttpErrorKind::Unknown,
        }
    }
}

/// Adapts object_store's request body to an awc [`awc::body::MessageBody`].
///
/// object_store already holds the whole body in memory (it hashed it for the SigV4 signature), so
/// this does not buffer; reporting the known length lets actix-http set a Content-Length matching
/// the signed bytes instead of chunking.
struct RequestBody(osc::HttpRequestBody);

impl awc::body::MessageBody for RequestBody {
    type Error = osc::HttpError;

    fn size(&self) -> awc::body::BodySize {
        awc::body::BodySize::Sized(self.0.content_length() as u64)
    }

    fn poll_next(
        self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> Poll<Option<Result<Bytes, osc::HttpError>>> {
        match Pin::new(&mut self.get_mut().0).poll_frame(cx) {
            // object_store request bodies are in-memory `Bytes`/`PutPayload`, so they only ever
            // yield data frames (never trailers) and `into_data` cannot fail.
            Poll::Ready(Some(Ok(frame))) => Poll::Ready(Some(Ok(frame
                .into_data()
                .expect("object_store request body yielded a non-data frame")))),
            Poll::Ready(Some(Err(err))) => Poll::Ready(Some(Err(err))),
            Poll::Ready(None) => Poll::Ready(None),
            Poll::Pending => Poll::Pending,
        }
    }
}

/// The response body object_store reads: it maps the [`SyncStream`] that relays awc's body chunks off
/// the worker thread into `http_body` data frames.  A [`Truncated`] relay — the worker was torn down
/// before the body finished — becomes a retryable error, so object_store never accepts a silently
/// short body as complete.
struct ResponseBody {
    chunks: SyncStream<Result<Result<Bytes, Error>, Truncated>>,
}

impl http_body::Body for ResponseBody {
    type Data = Bytes;
    type Error = osc::HttpError;

    fn poll_frame(
        self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> Poll<Option<Result<Frame<Bytes>, osc::HttpError>>> {
        let chunk = std::task::ready!(self.get_mut().chunks.poll_next_unpin(cx));

        Poll::Ready(match chunk {
            Some(Ok(Ok(bytes))) => Some(Ok(Frame::data(bytes))),

            // An awc body error (or our timeout/length error), already an `osc::HttpError`-convertible.
            Some(Ok(Err(err))) => Some(Err(err.into())),

            // The relay was cut short (worker torn down mid-stream); retryable, not a clean EOF.
            Some(Err(Truncated)) => Some(Err(osc::HttpError::new(
                osc::HttpErrorKind::Interrupted,
                Truncated,
            ))),

            None => None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_http::error::ParseError;
    use awc::error::SendRequestError;

    /// A connection lost *while the response head is being received* reaches us as
    /// `SendRequestError::Response(ParseError::…)`.  Those transport failures must stay retryable
    /// (matching reqwest); only a structurally invalid head is a non-retryable decode error.
    #[test]
    fn response_head_transport_failures_stay_retryable() {
        use osc::HttpErrorKind::{Decode, Interrupted, Timeout};
        use std::io::ErrorKind;

        let cases = [
            // the peer closed before the head was complete
            ("incomplete", ParseError::Incomplete, Interrupted),
            // timed out waiting for the head
            ("head timeout", ParseError::Timeout, Timeout),
            // a socket error is refined by its io kind, exactly as a `Send` error is
            (
                "io reset",
                ParseError::Io(ErrorKind::ConnectionReset.into()),
                Interrupted,
            ),
            (
                "io timeout",
                ParseError::Io(ErrorKind::TimedOut.into()),
                Timeout,
            ),
            // a structurally invalid head: resending can't help
            ("bad status", ParseError::Status, Decode),
            ("oversized head", ParseError::TooLarge, Decode),
        ];

        for (label, parse_err, expected) in cases {
            let kind = Error::classify_send_error(&SendRequestError::Response(parse_err));
            assert_eq!(kind, expected, "{label}");
        }
    }
}
