//! Module to deal with the OAuth 2.0 and OpenID Connect endpoints and flows.
//!
//! NOTE: We attempt to keep this code separate from other PubHubs code
//! in the hope of turning into a library in the future.
//!
//! # Design choices
//!
//! We use the OAuth 2.0  **'code grant'**  flow (see RFC6749, section 4.1)
//! with the `form_post` `response_type` from "OAuth 2.0 Form Post Response Mode",
//! where the authorization code is passed to the `redirect_uri` via POST
//! instead of GET.  OAuth 2.0 clients (i.e. Hubs) must authenticate using
//! a `client_id` and `client_secret` (see section 2.3.1 of RFC6749.)
//!
//! We do not keep any **state**, and therefore cannot enforce the single use of
//! authorization codes (see RFC6749, section 4.1.2, under "code",)
//! but since the authorization code is passed via POST and can only
//! be used someone possessing the correct client credentials, the security
//! implications are minimal.
//!
//! Of OpenID Connect (see "OpenID Connect Core 1.0", OIDCC1.0) we do *not*
//! use the UserInfo endpoint, but instead pass an ID Token (OIDCC1.0, Section 2)
//! via OAuth's Token Endpoint (OIDCC1.0, 3.1.3.6 and RFC6749, Section 5.)
//! Accordingly, we do not return an `access_token` from the Token Endpoint
//! (even though it is REQUIRED by 5.1 of RFC6749.)
//!
//! To prevent having to look up `client_id`s in a database, we attach a
//! hmac to all `client_id`s that authenticates both the client's id, and
//! the `redirect_uri`, see [ClientId] for more info.

use aead::{Aead as _, AeadCore as _, KeyInit as _};
use base64ct::{Base64, Base64Url, Encoding as _};
use chacha20poly1305::XChaCha20Poly1305;
use serde::Deserialize;
use std::borrow::Cow;
use std::str::FromStr as _;
use thiserror::Error; // this module is written like a library - don't use anyhow
                      // for errors returned to the user of the library
use anyhow::Context as _;
use hmac::Mac as _;
use sha2::Digest as _;

/// Creates a new [Oidc] trait object that handles the OAuth 2.0 and
/// OpenID Connect endpoints to the extend that it can, passing
/// the remaining work/choices to the specified [Handler].
pub fn new<H: Handler>(h: H, secret: impl AsRef<[u8]>) -> impl Oidc<H = H> {
    let secret = secret.as_ref();

    OidcImpl::<H> {
        handler: h,
        client_hmac_secret: derive_secret("client-hmac", secret),
        client_password_secret: derive_secret("client-password", secret),
        auth_code_secret: derive_secret("auth-code", secret),
        auth_request_handle_secret: derive_secret("auth-request-handle", secret),
    }
}

/// An Oidc instance, created by [new], handles
/// requests to OpenID connect and OAuth 2.0 endpoints,
/// and passes them on to the specified [Handler].
pub trait Oidc {
    type H: Handler;

    /// Handles the RFC6749 4.1.1 Authorization Request.
    ///
    /// The client asks us to authenticate the present user-agent, and after having done so
    /// have the user-agent POST an auth_code to the client's redirect_uri that can be used
    /// by the client to obtain an id_token from the Token Endpoint.
    fn handle_auth(&self, req: <Self::H as Handler>::Req) -> <Self::H as Handler>::Resp;

    /// Generates an auth_code for the given auth_request_handle (see [Handler::handle_auth]) that
    /// will have the Token Endpoint return the `id_token` created by the `id_token_creator`.
    ///
    /// Fails with Error::InvalidAuthRequestHandle if the auth_request_handle is invalid,
    /// and Error::IdTokenCreation when id_token_creator fails, but passes all
    /// other errors via the UriResponse::Error via the user-agent to the client.
    fn grant_code(
        &self,
        auth_request_handle: String,
        id_token_creator: impl FnOnce(TokenCreationData) -> Result<String, ()>,
    ) -> Result<UriResponse, Error>;

    /// Handles the RFC6749 4.1.3 Access Token Request.
    ///
    /// The client retrieves the id_token of the user using the auth_code it got via
    /// the resource owner's user-agent.
    fn handle_token(&self, req: <Self::H as Handler>::Req) -> <Self::H as Handler>::Resp;
}

/// A [Handler] instance (passed to [new]) returns control to you
/// when needed (to authorize the resource owner, and so on.)
pub trait Handler {
    type Req: for<'s> HttpRequest<'s>;
    type Resp: From<HttpResponse>;

    /// The handle_auth method is called when the details passed to the authorization
    /// endpoint check out as far as this OIDC libary is concerned, and
    /// the application can proceed to authenticate the user by sending
    /// the appropriate response (containing, for example, a page
    /// with an IRMA QR-code.)
    ///
    /// When the user has been authenticated, the handle can be passed to
    /// the grant_auth method of the Oidc instance.
    fn handle_auth(&self, req: Self::Req, auth_request_handle: String) -> Self::Resp;

    /// IsValidClient allows the handler to reject certain clients.
    ///
    /// At this point, the client_id and redirect_uri have already been verified
    /// using an HMAC.
    fn is_valid_client(&self, _client_id: &ClientId, _redirect_uri: &str) -> bool {
        true
    }
}

/// Represents an HTTP request, likely [`hyper::Request<hyper::Body>`]
///
/// NB. We have added a lifetime parameter 's for &self to allow Body to be a reference with
///     &self's lifetime, e.g. &'s[u8] --- no longer needed when generic associated types,
///     see RFC1598, become stable.
pub trait HttpRequest<'s> {
    type Body: std::io::Read;

    fn method(&'s self) -> HttpMethod;
    fn query(&'s self) -> Cow<str>;
    fn body(&'s self) -> Self::Body;
    fn content_type(&'s self) -> Option<ContentType>;
    fn authorization(&'s self) -> Option<Cow<str>>;
}

/// Enumerates the Http methods used here.
#[non_exhaustive]
#[derive(Debug, PartialEq, Clone, Copy)]
pub enum HttpMethod {
    Get,
    Post,
    Other,
}

/// Enumerates tjhe content-types used here.
#[non_exhaustive]
#[derive(Debug, PartialEq, Clone, Copy)]
pub enum ContentType {
    /// application/x-www-form-urlencoded
    UrlEncoded,
    /// application/json
    Json,
    Other,
}

/// [HttpResponse] enumerates the possible HTTP responses generated by an
/// [Oidc] instance.  [`From<HttpResponse>`] is implemented for
/// [`hyper::Response<hyper::Body>`].
#[derive(Debug, PartialEq)]
pub enum HttpResponse {
    /// The method was invalid (not GET for the authorization endpoint or
    /// not POST for the token endpoint.)
    UnsupportedMethod,

    /// The query string of the request could not be parsed or contained
    /// unknown fields, or lacked required fields such as client_id,
    /// response_type, or redirect_uri.
    MalformedQuery,

    /// The client_id contained invalid characters, or did not contain
    /// a '~' (followed by the MAC.)
    MalformedClientId,

    /// The redirect_uri could not be parsed, contained a fragment,
    /// or did not use 'https' as scheme.
    MalformedRedirectUri,

    /// The combination of the client_id and redirect_uri was not
    /// authenticated by the MAC inside the client_id.
    InvalidClientMAC,

    /// Only "form_post" is supported.
    UnsupportedResponseMode,

    /// Could not parse request body, or unknown parameters were supplied
    MalformedRequestBody, // invalid_request

    /// Only "application/x-www-form-urlencoded" is supportede
    UnsupportedContentType, // invalid_request

    /// From RFC6749, section 5.2
    InvalidAuthCode,

    /// Only "authorization_code" is supported.  From RFC6749, section 5.2
    UnsupportedGrantType,

    /// Missing 'Authorization' header
    MissingClientCredentials,

    /// Authorization header is malformed
    MalformedClientCredentials,

    /// The provided credentials were invalid, e.g. incorrect client_id or password.
    InvalidClientCredentials,

    // TODO: organize errors passed directly via HTTP in their own type?
    /// Make the user-agent POST to this URI.
    FormPost(UriResponse),

    IdToken(String),
}

/// Represents the response of the [Oidc] to the client of having the
/// user-agent POST the [UriResponseData] to the specified uri.
#[derive(Debug, PartialEq)]
pub struct UriResponse {
    uri: String,
    data: UriResponseData,
}

/// Represents data passed to the client by POSTing it to its `redirect_uri`.
#[derive(Debug, PartialEq)]
pub enum UriResponseData {
    CodeGrant {
        code: String,
        state: String,
    },
    Error {
        error: UriError,
        state: Option<String>,
    },
}

/// Represents an error to be passed to a client's `redirect_uri`.
#[derive(Debug, PartialEq)]
pub enum UriError {
    UnsupportedResponseType,
    UnsupportedParameter(String),
    InvalidState,
    InvalidNonce,
    InvalidScope,
    UnauthorizedClient,
    ServerError,
}

impl UriError {
    fn error(&self) -> &'static str {
        match self {
            Self::UnsupportedResponseType => "unsupported_response_type",
            Self::UnsupportedParameter(_) => "invalid_request",
            Self::InvalidState => "invalid_request",
            Self::InvalidNonce => "invalid_request",
            Self::InvalidScope => "invalid_scope",
            Self::UnauthorizedClient => "unauthorized_client",
            Self::ServerError => "server_error",
        }
    }

    fn error_description(&self) -> Option<String> {
        match self {
            Self::UnsupportedResponseType => Some("only 'code' response_type is supported".to_string()),
            Self::UnsupportedParameter(param) => Some(format!("parameter '{param}' is not supported")) ,
            Self::InvalidState => Some("'state' parameter must be set, non-empty and printable ascii".to_string()),
            Self::InvalidNonce => Some("'nonce' parameter must be set, non-empty and printable ascii".to_string()),
            Self::InvalidScope => Some("'scope' parameter must be set, include 'oidc', and may contain only printable ascii characters excluding '\"' and '\\'".to_string()),
            Self::UnauthorizedClient => None,
            Self::ServerError => Some("internal server error".to_string()),
        }
    }
}

#[derive(PartialEq, Debug, Clone, PartialOrd, Hash)]
/// Wraps a [String] holding a client's identifier of the form
/// `<bare_id>~<mac>`, where `bare_id` is arbitrary (e.g. `test_hub`)
/// and `mac` is a message authentication code that binds the `bare_id`
/// to a `redirect_uri` using a secret derived from the secret
/// passed to the [Oidc] via [new].
pub struct ClientId {
    data: String,
    tilde_pos: usize,
}

impl std::convert::TryFrom<String> for ClientId {
    type Error = Error;

    fn try_from(s: String) -> Result<Self, Self::Error> {
        let pos = s.rfind('~');
        if pos.is_none() {
            return Err(Error::MalformedClientId);
        }

        if !is_printable_ascii(s.chars()) {
            return Err(Error::MalformedClientId);
        }

        Ok(ClientId {
            tilde_pos: pos.unwrap(), // not none, see above
            data: s,
        })
    }
}

impl std::str::FromStr for ClientId {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::try_from(s.to_owned())
    }
}

impl AsRef<str> for ClientId {
    fn as_ref(&self) -> &str {
        &self.data
    }
}

impl Into<String> for ClientId {
    fn into(self) -> String {
        self.data
    }
}

impl ClientId {
    pub fn bare_id(&self) -> &str {
        &self.data[..self.tilde_pos]
    }

    fn mac(&self) -> &str {
        &self.data[self.tilde_pos + 1..]
    }

    /// check_mac true only if the client id contains an HMAC
    /// that authenticates the client_id and redirect_uri.
    ///
    /// WARNING:  
    ///
    ///  - Not checking the redirect_uri makes your server an open
    ///    redirector, see CWE-601, and e.g. CVE-2020-26877.
    ///  
    ///  - If this function performs some expensive operation, like querying
    ///    a database, this opens the door to a DOS attack.
    ///
    fn check_mac(&self, secret: &[u8], redirect_uri: &str) -> bool {
        let mac = Base64Url::decode_vec(self.mac());
        if mac.is_err() {
            return false;
        }
        let mac = mac.unwrap();
        Self::compute_mac(self.bare_id(), secret, redirect_uri)
            .verify_slice(&mac)
            .is_ok()
    }

    /// Given the client's `bare_id`, the hmac `secret` and the `redirect_uri`,
    /// computes the associated hmac, returned as [hmac::Mac].
    fn compute_mac(bare_id: &str, secret: &[u8], redirect_uri: &str) -> impl hmac::Mac {
        <hmac::Hmac<sha2::Sha256> as hmac::Mac>::new_from_slice(&secret)
            // currently, new_from_slice never returns an error
            .expect("expected no error from 'Hmac::new_from_slice'")
            .chain_update(bare_id)
            .chain_update(b"\0")
            .chain_update(redirect_uri)
    }

    /// Generates a new client id including the hmac from the `bare_id`,
    /// the `redirect_uri` and the hmac `secret`.
    fn new(bare_id: &str, secret: &[u8], redirect_uri: &str) -> ClientId {
        let mac = Base64Url::encode_string(
            &Self::compute_mac(bare_id, secret, redirect_uri)
                .finalize()
                .into_bytes(),
        );

        let mut result = String::with_capacity(bare_id.len() + mac.len() + 1);
        result.push_str(bare_id);
        result.push('~');
        result.push_str(&mac);
        return ClientId {
            data: result,
            tilde_pos: bare_id.len(),
        };
    }

    fn password_mac(client_id: &str, secret: &[u8]) -> impl hmac::Mac {
        <hmac::Hmac<sha2::Sha256> as hmac::Mac>::new_from_slice(secret)
            // currently, new_from_slice never returns an error
            .expect("expected no error from 'Hmac::new_from_slice'")
            .chain_update(client_id)
    }

    /// Computes the password associated with the given `client_id`,
    /// which is the urlsafe base64 encoding of a sha256-hmac
    /// of `client_id`.
    ///
    /// Note:  to check a password, use [check_password] instead, which employs
    /// constant time equality to prevent timing attacks.
    fn password(client_id: impl AsRef<str>, secret: impl AsRef<[u8]>) -> String {
        Base64Url::encode_string(
            &Self::password_mac(client_id.as_ref(), secret.as_ref())
                .finalize()
                .into_bytes(),
        )
    }

    fn check_password(
        client_id: impl AsRef<str>,
        secret: impl AsRef<[u8]>,
        password: impl AsRef<str>,
    ) -> bool {
        let pw = Base64Url::decode_vec(password.as_ref());
        if pw.is_err() {
            return false;
        }
        let pw = pw.unwrap();

        Self::password_mac(client_id.as_ref(), secret.as_ref())
            .verify_slice(&pw)
            .is_ok()
    }
}

/// Error encapsulates all errors returned by this module.
#[derive(Error, Debug, Clone, PartialEq, PartialOrd)]
pub enum Error {
    #[error("invalid/corrupted client id")]
    MalformedClientId,

    #[error("invalid/corrupted auth_request_handle")]
    InvalidAuthRequestHandle,

    #[error("invalid/corrupted auth_code")]
    InvalidAuthCode,

    #[error("invalid scope: illegal character or extra space (' ')")]
    InvalidScope,

    #[error("failed to create id_token")]
    IdTokenCreation,
}

/// OAuth 2.0's RFC6749 calls this "*VSCHAR" in its Appendix A.
#[doc(hidden)]
fn is_printable_ascii(characters: impl IntoIterator<Item = char>) -> bool {
    characters.into_iter().all(|c: char| match c {
        '\x20'..='\x7e' => true,
        _ => false,
    })
}

/// Convenience function that parses the given scope into scope tokens, see RFC6749 sections 3.3
/// and A.4.  The scope tokens are returned in sorted order.
/// Returns Error::InvalidScope when the scope is invalid.
pub fn parse_scope(scope: &str) -> Result<Vec<&str>, Error> {
    let mut res = Vec::<&str>::new();

    for token in scope.split(' ') {
        if token.is_empty() {
            return Err(Error::InvalidScope);
        }

        for c in token.chars() {
            match c {
                '\x21' | '\x23'..='\x5b' | '\x5d'..='\x7e' => continue,
                _ => return Err(Error::InvalidScope), // invalid character
            }
        }

        res.push(token);
    }

    res.sort_by(|x, y| x.cmp(y));

    Ok(res)
}

/// Data extracted from an `auth_request_handle` to be used to create an `id_token`,
/// see [Oidc::grant_code].
#[derive(PartialEq, Debug)]
pub struct TokenCreationData {
    /// must be included in the `id_token` (as the `nonce` field)
    pub nonce: String,

    /// must be included in the `id_token` as the `aud` field
    pub client_id: String,

    /// need not be included in the `id_token`, but may determine the contents of the `id_token`
    pub scope: String,
}

#[doc(hidden)]
struct OidcImpl<H: Handler> {
    handler: H,
    client_hmac_secret: Secret,
    client_password_secret: Secret,
    auth_code_secret: Secret,
    auth_request_handle_secret: Secret,
}

/// Represents the query arguments passed to the authorization endpoint,
/// see RFC6749, section 4.1.1.
#[derive(Deserialize, Debug)]
#[cfg_attr(test, derive(serde::Serialize))]
#[serde(deny_unknown_fields)]
#[doc(hidden)]
struct AuthQuery {
    response_type: String,
    client_id: String,
    redirect_uri: String,

    /// See "OAuth 2.0 Form Post Response Mode".
    #[serde(default)]
    response_mode: Option<String>,

    #[serde(default)]
    scope: Option<String>,

    #[serde(default)]
    state: Option<String>,

    /// See OIDCC1.0, Section 3.1.2.1
    #[serde(default)]
    nonce: Option<String>,

    // The following parameters from OIDCC1.0, 3.1.2.1 are not supported,
    // and included only to give a better error message.
    display: Option<String>,
    prompt: Option<String>,
    max_age: Option<String>,
    ui_locales: Option<String>,
    id_token_hint: Option<String>,
    login_hint: Option<String>,
    acr_values: Option<String>,
}

/// Represents the parameters POSTed to the token endpoint,
/// see RFC6749, section 4.1.3.
#[derive(Deserialize, Debug, Clone)]
#[cfg_attr(test, derive(serde::Serialize))]
#[serde(deny_unknown_fields)]
#[doc(hidden)]
struct TokenQuery {
    grant_type: String,
    code: String,
    client_id: String,
    redirect_uri: String,
}

/// Represents the fields POSTed to redirect_uri
/// by us, and should thus not already be used in the redirect_uri
/// query itself (in case the POST and GET parameters are merged.)
#[derive(Deserialize, Default, PartialEq)]
#[doc(hidden)]
struct RedirectUriSpecialFields {
    code: Option<String>,
    state: Option<String>,
    nonce: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
    error_uri: Option<String>,
}

impl RedirectUriSpecialFields {
    fn empty(&self) -> bool {
        *self == Self::default()
    }
}

impl<H: Handler> Oidc for OidcImpl<H> {
    type H = H;

    fn handle_auth(&self, req: H::Req) -> H::Resp {
        if req.method() != HttpMethod::Get {
            return H::Resp::from(HttpResponse::UnsupportedMethod);
        }

        // parse query
        let query = serde_urlencoded::from_str::<AuthQuery>(req.query().as_ref());
        if let Err(_) = query {
            return H::Resp::from(HttpResponse::MalformedQuery);
        }
        let query = query.unwrap();

        // parse client_id
        let client_id: Result<ClientId, Error> = str::parse(&query.client_id);
        if client_id.is_err() {
            return H::Resp::from(HttpResponse::MalformedClientId);
        }
        let client_id = client_id.unwrap();

        // check MAC in client_id
        if !client_id.check_mac(&self.client_hmac_secret, &query.redirect_uri) {
            return H::Resp::from(HttpResponse::InvalidClientMAC);
        }

        // check redirect_uri
        let parsed_redirect_uri = url::Url::parse(&query.redirect_uri);
        if parsed_redirect_uri.is_err() {
            return H::Resp::from(HttpResponse::MalformedRedirectUri);
        }
        let parsed_redirect_uri = parsed_redirect_uri.unwrap();

        if parsed_redirect_uri.scheme() != "https" || !parsed_redirect_uri.fragment().is_none() {
            return H::Resp::from(HttpResponse::MalformedRedirectUri);
        }

        // check that the query part of the redirect_uri is valid urlencoded
        // and does not contain any parameters we'd use
        if let Some(ruq) = parsed_redirect_uri.query() {
            let ruq: Result<RedirectUriSpecialFields, _> = serde_urlencoded::from_str(ruq);
            if let Err(_) = ruq {
                return H::Resp::from(HttpResponse::MalformedRedirectUri);
            }
            let ruq = ruq.unwrap();

            if !ruq.empty() {
                return H::Resp::from(HttpResponse::MalformedRedirectUri);
            }
        }

        // check response_mode
        if query.response_mode != Some("form_post".to_string()) {
            return H::Resp::from(HttpResponse::UnsupportedResponseMode);
        }

        // NOTE: from here on we can post our errors to the client
        // by redirecting the user-agent.

        let err_resp = |error_type: UriError| -> H::Resp {
            H::Resp::from(HttpResponse::FormPost(UriResponse {
                uri: query.redirect_uri.clone(),
                data: UriResponseData::Error {
                    error: error_type,
                    state: query.state.clone(),
                },
            }))
        };

        // check response_type
        if query.response_type != "code" {
            return err_resp(UriError::UnsupportedResponseType);
        }

        // check state
        if !is_valid_state(&query.state) {
            return err_resp(UriError::InvalidState);
        }

        macro_rules! check_is_none {
            ($param:tt) => {
                if !query.$param.is_none() {
                    return err_resp(UriError::UnsupportedParameter(String::from(stringify!(
                        $param
                    ))));
                }
            };
        }

        check_is_none!(display);
        check_is_none!(prompt);
        check_is_none!(max_age);
        check_is_none!(ui_locales);
        check_is_none!(id_token_hint);
        check_is_none!(login_hint);
        check_is_none!(acr_values);

        // check nonce - OIDCC1.0 3.1.2.{1,2} do not explicitly impose
        // specific restrictions for the nonce, so we'll treat the nonce
        // the same as state
        if !is_valid_state(&query.nonce) {
            return err_resp(UriError::InvalidNonce);
        }

        // check scope - must include 'openid' per 3.1.2.1 of OIDCC1.0
        if query.scope == None {
            return err_resp(UriError::InvalidScope);
        }

        let scope = parse_scope(query.scope.as_ref().unwrap());
        if scope.is_err() {
            return err_resp(UriError::InvalidScope);
        }

        let scope = scope.unwrap();
        if scope.binary_search_by(|x| "oidc".cmp(x)).is_err() {
            return err_resp(UriError::InvalidScope);
        }

        // let handler check that the client is (still) authorized
        if !self
            .handler
            .is_valid_client(&client_id, &query.redirect_uri)
        {
            return err_resp(UriError::UnauthorizedClient);
        }

        // Okay, everything seems to be in order;  hand over control
        // to the handler.
        match (AuthRequestData {
            state: query
                .state
                .clone()
                .expect("is_valid_state to have ensured state is not none"),
            nonce: query
                .nonce
                .expect("is_valid_state to have checked nonce is not none"),
            redirect_uri: query.redirect_uri.clone(),
            scope: query
                .scope
                .expect("parse_scope to have checked scope is not none"),
            client_id: query.client_id,
        }
        .to_handle(&self.auth_request_handle_secret))
        {
            Ok(handle) => return self.handler.handle_auth(req, handle),
            Err(err) => {
                log::error!("failed to create auth_request_handle: {}", err);
                return err_resp(UriError::ServerError);
            }
        }
    }

    fn grant_code(
        &self,
        auth_request_handle: String,
        id_token_creator: impl FnOnce(TokenCreationData) -> Result<String, ()>,
    ) -> Result<UriResponse, Error> {
        let data =
            AuthRequestData::from_handle(auth_request_handle, &self.auth_request_handle_secret)?;

        let id_token = id_token_creator(TokenCreationData {
            nonce: data.nonce,
            client_id: data.client_id.clone(),
            scope: data.scope,
        })
        .map_err(|_| Error::IdTokenCreation)?;

        let code = AuthCodeData { id_token }.to_code(&self.auth_code_secret, data.client_id);

        if let Err(err) = code {
            log::error!("failed to create auth_code: {}", err);

            return Ok(UriResponse {
                uri: data.redirect_uri,
                data: UriResponseData::Error {
                    error: UriError::ServerError,
                    state: Some(data.state),
                },
            });
        }

        let code = code.unwrap();

        Ok(UriResponse {
            uri: data.redirect_uri,
            data: UriResponseData::CodeGrant {
                state: data.state,
                code,
            },
        })
    }

    fn handle_token(&self, req: H::Req) -> H::Resp {
        if req.method() != HttpMethod::Post {
            return H::Resp::from(HttpResponse::UnsupportedMethod);
        }

        if req.content_type() != Some(ContentType::UrlEncoded) {
            return H::Resp::from(HttpResponse::UnsupportedContentType);
        }

        // parse body
        let query: Result<TokenQuery, _> = serde_urlencoded::from_reader(req.body());
        if query.is_err() {
            return H::Resp::from(HttpResponse::MalformedRequestBody);
        }
        let query = query.unwrap();

        // check grant_type
        if query.grant_type != "authorization_code".to_string() {
            return H::Resp::from(HttpResponse::UnsupportedGrantType);
        }

        // check credentials
        let auth = req.authorization();
        if auth.is_none() {
            return H::Resp::from(HttpResponse::MissingClientCredentials);
        }
        let auth = auth.unwrap();

        let creds = basic_auth::Credentials::from_str(&auth);
        if creds.is_err() {
            return H::Resp::from(HttpResponse::MalformedClientCredentials);
        }
        let creds = creds.unwrap();

        if creds.userid != query.client_id {
            return H::Resp::from(HttpResponse::InvalidClientCredentials);
        }

        if !ClientId::check_password(creds.userid, self.client_password_secret, creds.password) {
            return H::Resp::from(HttpResponse::InvalidClientCredentials);
        }

        let acd = AuthCodeData::from_code(query.code, &self.auth_code_secret, &query.client_id);
        if acd.is_err() {
            return H::Resp::from(HttpResponse::InvalidAuthCode);
        }
        let acd = acd.unwrap();

        // parse client_id
        let client_id: Result<ClientId, Error> = str::parse(&query.client_id);
        if client_id.is_err() {
            // should not happen, though, as client_id was already checked by the auth endpoint
            return H::Resp::from(HttpResponse::MalformedClientId);
        }
        let client_id = client_id.unwrap();

        // check the redirect_uri is correct
        if !client_id.check_mac(&self.client_hmac_secret, &query.redirect_uri) {
            return H::Resp::from(HttpResponse::InvalidClientMAC);
        }

        // NB.  We do not need to check the redirect uri, as it has already been
        //      checked by the auth endpoint.

        return H::Resp::from(HttpResponse::IdToken(acd.id_token));
    }
}

/// Holds the data sealed in an `auth_request_handle`.
#[doc(hidden)]
#[derive(serde::Serialize, serde::Deserialize, PartialEq, Debug)]
struct AuthRequestData {
    state: String,
    nonce: String,
    redirect_uri: String,
    scope: String,
    client_id: String,
}

impl AuthRequestData {
    #[doc(hidden)]
    fn to_handle(&self, key: &chacha20poly1305::Key) -> anyhow::Result<String> {
        seal(&self, key, b"")
    }

    #[doc(hidden)]
    fn from_handle(handle: impl AsRef<str>, key: &chacha20poly1305::Key) -> Result<Self, Error> {
        unseal(handle, key, b"").map_err(|_| Error::InvalidAuthRequestHandle)
    }
}

/// Holds the data sealed in an `auth_code`.
#[doc(hidden)]
#[derive(serde::Serialize, serde::Deserialize, PartialEq, Debug, Clone)]
struct AuthCodeData {
    id_token: String,
}

impl AuthCodeData {
    #[doc(hidden)]
    fn to_code(
        &self,
        key: &chacha20poly1305::Key,
        client_id: impl AsRef<str>,
    ) -> anyhow::Result<String> {
        seal(&self, key, client_id.as_ref().as_bytes())
    }

    #[doc(hidden)]
    fn from_code(
        code: impl AsRef<str>,
        key: &chacha20poly1305::Key,
        client_id: impl AsRef<str>,
    ) -> Result<Self, Error> {
        unseal(code, key, client_id.as_ref().as_bytes()).map_err(|_| Error::InvalidAuthCode)
    }
}

/// Singleton failure type for internal use
#[doc(hidden)]
#[derive(Debug, Error, PartialEq)]
enum Failure {
    #[error("failure")]
    Failure,
}

/// Encodes and encrypts the given obj with additional associated data (or b"" if none)
/// and returns it as urlsafe base64 string.  Use [unseal] to revert.
#[doc(hidden)]
fn seal<T: serde::Serialize>(
    obj: &T,
    key: &chacha20poly1305::Key,
    aad: impl AsRef<[u8]>,
) -> anyhow::Result<String> {
    let plaintext = rmp_serde::to_vec(obj).context("serializing")?;

    let nonce = XChaCha20Poly1305::generate_nonce(&mut aead::OsRng);
    let ciphertext = XChaCha20Poly1305::new(key)
        .encrypt(
            &nonce,
            aead::Payload {
                msg: plaintext.as_slice(),
                aad: aad.as_ref(),
            },
        )
        .map_err(|e| anyhow::anyhow!(e))
        .context("encrypting")?;

    let mut buf = Vec::with_capacity(nonce.len() + ciphertext.len());
    buf.extend_from_slice(&nonce);
    buf.extend_from_slice(&ciphertext);

    Ok(Base64Url::encode_string(&buf))
}

/// Reverse of the [seal] operation.
#[doc(hidden)]
fn unseal<T: serde::de::DeserializeOwned>(
    envelope: impl AsRef<str>,
    key: &chacha20poly1305::Key,
    aad: impl AsRef<[u8]>,
) -> Result<T, Failure> {
    let buf = Base64Url::decode_vec(envelope.as_ref()).map_err(|_| Failure::Failure)?;

    #[allow(dead_code)] // buf[..NONCE_LEN] is not considered usage - a bug?
    const NONCE_LEN: usize = chacha20poly1305::XNonce::LENGTH;

    if buf.len() < NONCE_LEN {
        return Err(Failure::Failure);
    }

    let plaintext = XChaCha20Poly1305::new(key)
        .decrypt(
            (&buf[..NONCE_LEN]).into(),
            aead::Payload {
                msg: &buf[NONCE_LEN..],
                aad: aad.as_ref(),
            },
        )
        .map_err(|_| Failure::Failure)?;

    rmp_serde::from_slice(&plaintext).map_err(|_| Failure::Failure)
}

/// trait to extract the length from a GenericArray
#[doc(hidden)]
trait GenericArrayExt {
    const LENGTH: usize;
}

impl<T, U: generic_array::ArrayLength<T>> GenericArrayExt for generic_array::GenericArray<T, U> {
    const LENGTH: usize = <U as typenum::marker_traits::Unsigned>::USIZE;
}

/// Type to hold secrets for internal use- basically an [u8, 32], i.e., an 'u256'
#[doc(hidden)]
type Secret = generic_array::GenericArray<u8, typenum::consts::U32>;

#[doc(hidden)]
fn derive_secret(concerns: &str, secret: &[u8]) -> Secret {
    sha2::Sha256::new()
        .chain_update(concerns.as_bytes())
        .chain_update(b"\0")
        .chain_update(secret)
        .finalize()
}

#[doc(hidden)]
fn is_valid_state(s: &Option<String>) -> bool {
    if s.is_none() {
        return false;
    }

    let s: &String = s.as_ref().unwrap();

    // see A.5 of RFC6749
    if !is_printable_ascii(s.chars()) {
        return false;
    }
    if s.is_empty() {
        return false;
    }
    true
}

/// Module for parsing Basic authorization headers such as:
///
///   Authorization: Basic czZCaGRSa3F0Mzo3RmpmcDBaQnIxS3REUmJuZlZkbUl3
///
/// See section 2 of RFC2617.
#[doc(hidden)]
mod basic_auth {
    use super::*;

    #[derive(Debug, PartialEq, Clone)]
    pub(crate) struct Credentials {
        pub userid: String,
        pub password: String,
    }

    #[derive(Error, Debug, Clone, PartialEq)]
    pub(crate) enum Error {
        #[error("does not start with 'Basic'")]
        MissingBasic,

        #[error("whitespace missing between Basic and remainder")]
        MissingWhitespace,

        #[error("invalid base64")]
        InvalidBase64,

        #[error("invalid utf8")]
        InvalidUtf8,

        #[error("missing ':' between userid and password")]
        MissingColon,
    }

    impl std::str::FromStr for Credentials {
        type Err = Error;

        fn from_str(s: &str) -> Result<Self, Error> {
            const BASIC: &str = "Basic";

            let s = s.trim_start(); // remove whitespace from start
            if !s.starts_with(BASIC) {
                return Err(Error::MissingBasic);
            }

            let s = &s[BASIC.len()..];

            // check that the remainder starts with some whitespace
            if !s
                .chars()
                .next()
                .ok_or_else(|| Error::MissingWhitespace)?
                .is_whitespace()
            {
                return Err(Error::MissingWhitespace);
            }

            // remove whitespace
            let s = s.trim();

            // decode base64
            let s = Base64::decode_vec(s).map_err(|_| Error::InvalidBase64)?;
            let s = std::str::from_utf8(&s).map_err(|_| Error::InvalidUtf8)?;

            // userid are not allowed to contain an ':'
            let pos = s.find(':').ok_or_else(|| Error::MissingColon)?;

            return Ok(Credentials {
                userid: s[..pos].to_owned(),
                password: s[pos + 1..].to_owned(),
            });
        }
    }

    impl std::fmt::Display for Credentials {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(
                f,
                "Basic {}",
                Base64::encode_string(format!("{}:{}", self.userid, self.password).as_bytes())
            )
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn from_str() {
            assert_eq!(
                Credentials::from_str(" Basic  czZCaGRSa3F0Mzo3RmpmcDBaQnIxS3REUmJuZlZkbUl3 "),
                Ok(Credentials {
                    userid: "s6BhdRkqt3".to_owned(),
                    password: "7Fjfp0ZBr1KtDRbnfVdmIw".to_owned(),
                }),
            );
        }

        #[test]
        fn to_string() {
            let c = Credentials {
                userid: "user".to_string(),
                password: "pw".to_string(),
            };

            assert_eq!(c, Credentials::from_str(&c.to_string()).unwrap());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_id_from_str() {
        for r in vec![
            ClientId::from_str("asd"), // no tilde
            ClientId::from_str("~\0"), // invalid character
        ] {
            assert_eq!(r, Err(Error::MalformedClientId));
        }

        let c = ClientId::from_str("foo~bar").expect("expected no error");
        assert_eq!(
            c,
            ClientId {
                data: "foo~bar".to_owned(),
                tilde_pos: 3,
            },
        );

        assert_eq!(c.bare_id(), "foo");
        assert_eq!(c.mac(), "bar");

        // corner cases
        let c = ClientId::from_str("~").expect("expected no error");

        assert_eq!(c.bare_id(), "");
        assert_eq!(c.mac(), "");

        let c = ClientId::from_str("~~").expect("expected no error");

        assert_eq!(c.bare_id(), "~");
        assert_eq!(c.mac(), "");
    }

    #[test]
    fn client_id_mac() {
        // !/usr/bin/env python3
        // import hmac, base64, hashlib
        // a = hmac.new(b"secret", msg=b"foo\0uri",digestmod=hashlib.sha256).digest()
        // print(base64.urlsafe_b64encode(a))
        let cs = "foo~xMSH1zzz7OzoQbIUBkS2i-HTg__7XI4Z0t31WiIfkMU=";

        let id = "foo";
        let secret = "secret".as_bytes();
        let uri = "uri";

        assert_eq!(cs, ClientId::new(id, secret, uri).as_ref());

        let c = ClientId::from_str(cs).expect("expected no error");

        assert!(c.check_mac(secret, uri));
        assert!(!c.check_mac("5ecret".as_bytes(), uri));
        assert!(!c.check_mac(secret, "ur1"));

        // a prefix of the correct mac is not enough:
        assert!(
            !ClientId::from_str("foo~xMSH1zzz7OzoQbIUBkS2i-HTg__7XI4Z0t31WiIfkM")
                .expect("expected no error")
                .check_mac(secret, uri)
        );

        // invalid base 64 causes the mac to be invalid
        let c = ClientId::from_str("foo~not base 64!").expect("expected no error");
        assert!(!c.check_mac(secret, uri));
    }

    #[test]
    fn client_id_password() {
        // !/usr/bin/env python3
        // import hmac, base64, hashlib
        // a = hmac.new(b"secret", msg=b"foo",digestmod=hashlib.sha256).digest()
        // print(base64.urlsafe_b64encode(a))
        let pw = "dzukRpPHVT1u4g9h6l0nV6mk9KRNKEGuTpW1LkzWLbQ=";
        assert_eq!(pw, ClientId::password("foo", "secret"));
        assert!(ClientId::check_password("foo", "secret", &pw));
        assert_ne!(pw, ClientId::password("foo1", "secret"));
        assert_ne!(pw, ClientId::password("foo", "secret1"));
        assert!(!ClientId::check_password("foo1", "secret", &pw));
        assert!(!ClientId::check_password("foo", "secret1", &pw));
    }

    /// HttpRequest implementation used for testing
    #[derive(Debug, Clone, PartialEq)]
    struct MockHttpRequest {
        query: String,
        method: HttpMethod,
        body: String,
        content_type: Option<ContentType>,
        authorization: Option<String>,
    }

    impl<'s> HttpRequest<'s> for MockHttpRequest {
        type Body = &'s [u8];

        fn query(&'s self) -> Cow<str> {
            Cow::Borrowed(&self.query)
        }

        fn method(&'s self) -> HttpMethod {
            self.method
        }

        fn body(&'s self) -> &[u8] {
            self.body.as_bytes()
        }

        fn content_type(&'s self) -> Option<ContentType> {
            self.content_type
        }

        fn authorization(&'s self) -> Option<Cow<str>> {
            match self.authorization {
                None => None,
                Some(ref s) => Some(Cow::Borrowed(s.as_str())),
            }
        }
    }

    /// HttpResponse used for testing
    #[derive(Debug, PartialEq)]
    enum MockHttpResponse {
        FromOidc(HttpResponse),
        HandleAuthPage(String),
    }

    impl From<HttpResponse> for MockHttpResponse {
        fn from(r: HttpResponse) -> Self {
            MockHttpResponse::FromOidc(r)
        }
    }

    /// Handler used for testing
    struct MockHandler {}

    impl Handler for MockHandler {
        type Req = MockHttpRequest;
        type Resp = MockHttpResponse;

        fn handle_auth(
            &self,
            _req: MockHttpRequest,
            auth_request_handle: String,
        ) -> MockHttpResponse {
            MockHttpResponse::HandleAuthPage(auth_request_handle)
        }

        fn is_valid_client(&self, client_id: &ClientId, _redirect_uri: &str) -> bool {
            !client_id.bare_id().starts_with("invalid_client")
        }
    }

    #[test]
    fn handle_auth() {
        let secret = "secret".as_bytes();
        let client_hmac_secret = super::derive_secret("client-hmac", secret);
        let auth_request_handle_secret = super::derive_secret("auth-request-handle", secret);

        let oidc = new(MockHandler {}, secret);

        let handle_auth = |query: &str| {
            oidc.handle_auth(MockHttpRequest {
                query: query.to_owned(),
                authorization: None,
                content_type: None,
                body: "".to_string(),
                method: HttpMethod::Get,
            })
        };

        // TODO:  test invalid authorizatzion, content_type, body, and method

        let query1 = "response_type=code&redirect_uri=uri&client_id=foo";

        for query in vec![
            "",
            "unknown_field=123",
            &(query1.to_owned() + "&response_type=code"),
        ] {
            assert_eq!(
                handle_auth(query),
                MockHttpResponse::FromOidc(HttpResponse::MalformedQuery)
            );
        }

        assert_eq!(
            handle_auth(query1),
            MockHttpResponse::FromOidc(HttpResponse::MalformedClientId)
        );

        assert_eq!(
            handle_auth("response_type=code&redirect_uri=uri&client_id=foo~"),
            MockHttpResponse::FromOidc(HttpResponse::InvalidClientMAC)
        );

        let create_query = |bare_client_id: &str,
                            redirect_uri: &str,
                            response_mode: Option<&str>,
                            scope: Option<&str>,
                            state: Option<&str>,
                            nonce: Option<&str>,
                            response_type: &str| {
            serde_urlencoded::to_string(AuthQuery {
                response_type: response_type.to_string(),
                client_id: ClientId::new(bare_client_id, &client_hmac_secret, redirect_uri).into(),
                redirect_uri: redirect_uri.to_string(),
                response_mode: response_mode.map(|a| a.to_string()),
                scope: scope.map(|a| a.to_string()),
                state: state.map(|a| a.to_string()),
                nonce: nonce.map(|a| a.to_string()),
                display: None,
                prompt: None,
                max_age: None,
                ui_locales: None,
                id_token_hint: None,
                login_hint: None,
                acr_values: None,
            })
            .unwrap()
        };

        let create_query_from_uri = |uri: &str| {
            create_query(
                "foo",
                uri,
                Some("form_post"),
                Some("oidc"),
                Some("state"),
                Some("nonce"),
                "code",
            )
        };

        for uri in vec![
            "",
            "http://no-https.com",
            "https://example.com/#with-fragment",
            "https://valid.com/?error=using-special-field",
            "https://valid.com/?error_description=using-special-field",
            "https://valid.com/?error_uri=using-special-field",
            "https://valid.com/?code=using-special-field",
            "https://valid.com/?state=using-special-field",
        ] {
            assert_eq!(
                handle_auth(&create_query_from_uri(uri)),
                MockHttpResponse::FromOidc(HttpResponse::MalformedRedirectUri)
            );
        }

        if let MockHttpResponse::HandleAuthPage(h) = handle_auth(&create_query_from_uri(
            "https://valid.com?valid_parameter=something",
        )) {
            let ard = AuthRequestData::from_handle(h, &auth_request_handle_secret).unwrap();

            assert_eq!(ard.state, "state");
            assert_eq!(ard.nonce, "nonce");
            assert_eq!(
                ard.redirect_uri,
                "https://valid.com?valid_parameter=something"
            );
            assert_eq!(ard.scope, "oidc");
            assert_eq!(ClientId::from_str(&ard.client_id).unwrap().bare_id(), "foo");
        } else {
            assert!(false);
        }

        for param in vec![
            "display",
            "prompt",
            "max_age",
            "ui_locales",
            "id_token_hint",
            "login_hint",
            "acr_values",
        ] {
            assert_eq!(
                handle_auth(
                    &(create_query_from_uri("https://valid.com?valid_parameter=something",)
                        + "&"
                        + param
                        + "=something")
                ),
                MockHttpResponse::FromOidc(HttpResponse::FormPost(UriResponse {
                    uri: "https://valid.com?valid_parameter=something".to_string(),
                    data: UriResponseData::Error {
                        error: UriError::UnsupportedParameter(param.to_string()),
                        state: Some("state".to_string()),
                    },
                }))
            );
        }

        // only response_mode="form_post" is accepted
        for rm in vec![None, Some("query"), Some("fragment"), Some("web_message")] {
            assert_eq!(
                handle_auth(&create_query(
                    "foo",
                    "https://valid.com?valid_parameter=something",
                    rm,
                    Some("oidc"),
                    Some("state"),
                    Some("nonce"),
                    "code",
                )),
                MockHttpResponse::FromOidc(HttpResponse::UnsupportedResponseMode)
            );
        }

        for rt in vec!["", "id_token", "token"] {
            assert_eq!(
                handle_auth(&create_query(
                    "foo",
                    "https://valid.com?valid_parameter=something",
                    Some("form_post"),
                    Some("oidc"),
                    Some("state"),
                    Some("nonce"),
                    rt,
                )),
                MockHttpResponse::FromOidc(HttpResponse::FormPost(UriResponse {
                    uri: "https://valid.com?valid_parameter=something".to_string(),
                    data: UriResponseData::Error {
                        error: UriError::UnsupportedResponseType,
                        state: Some("state".to_string()),
                    },
                })),
            );
        }

        for s in vec![None, Some(""), Some("\0")] {
            assert_eq!(
                handle_auth(&create_query(
                    "foo",
                    "https://valid.com?valid_parameter=something",
                    Some("form_post"),
                    Some("oidc"),
                    s,
                    Some("nonce"),
                    "code",
                )),
                MockHttpResponse::FromOidc(HttpResponse::FormPost(UriResponse {
                    uri: "https://valid.com?valid_parameter=something".to_string(),
                    data: UriResponseData::Error {
                        error: UriError::InvalidState,
                        state: s.map(|s| s.to_string())
                    },
                }))
            );
        }

        for n in vec![None, Some(""), Some("\0")] {
            assert_eq!(
                handle_auth(&create_query(
                    "foo",
                    "https://valid.com?valid_parameter=something",
                    Some("form_post"),
                    Some("oidc"),
                    Some("state"),
                    n,
                    "code",
                )),
                MockHttpResponse::FromOidc(HttpResponse::FormPost(UriResponse {
                    uri: "https://valid.com?valid_parameter=something".to_string(),
                    data: UriResponseData::Error {
                        error: UriError::InvalidNonce,
                        state: Some("state".to_string())
                    },
                }))
            );
        }

        for s in vec![
            None,
            Some(""),
            Some("invalid character \0"),
            Some("another invalid character '"),
            Some("no-oidc"),
        ] {
            assert_eq!(
                handle_auth(&create_query(
                    "foo",
                    "https://valid.com?valid_parameter=something",
                    Some("form_post"),
                    s,
                    Some("state"),
                    Some("nonce"),
                    "code",
                )),
                MockHttpResponse::FromOidc(HttpResponse::FormPost(UriResponse {
                    uri: "https://valid.com?valid_parameter=something".to_string(),
                    data: UriResponseData::Error {
                        error: UriError::InvalidScope,
                        state: Some("state".to_string()),
                    },
                }))
            );
        }

        // NB: our mock handler rejects clients with id starting with invalid_client
        assert_eq!(
            handle_auth(&create_query(
                "invalid_client",
                "https://valid.com?valid_parameter=something",
                Some("form_post"),
                Some("oidc"),
                Some("state"),
                Some("nonce"),
                "code",
            )),
            MockHttpResponse::FromOidc(HttpResponse::FormPost(UriResponse {
                uri: "https://valid.com?valid_parameter=something".to_string(),
                data: UriResponseData::Error {
                    error: UriError::UnauthorizedClient,
                    state: Some("state".to_string()),
                },
            }))
        );
    }

    #[test]
    fn chacha20poly1305_lengths() {
        assert_eq!(chacha20poly1305::Key::LENGTH, 32);
        assert_eq!(chacha20poly1305::XNonce::LENGTH, 24);
        assert_eq!(chacha20poly1305::Tag::LENGTH, 16);
    }

    #[test]
    fn auth_request_data() {
        let key = XChaCha20Poly1305::generate_key(&mut aead::OsRng);
        let data = AuthRequestData {
            state: "state".to_string(),
            nonce: "nonce".to_string(),
            redirect_uri: "http://example.com".to_string(),
            scope: "scope".to_string(),
            client_id: "foo".to_string(),
        };

        let handle = data.to_handle(&key).unwrap();
        assert_eq!(Ok(data), AuthRequestData::from_handle(&handle, &key));
        assert_eq!(
            Err(Error::InvalidAuthRequestHandle),
            AuthRequestData::from_handle(
                &handle,
                &XChaCha20Poly1305::generate_key(&mut aead::OsRng),
            )
        );
        assert_eq!(
            Err(Error::InvalidAuthRequestHandle),
            AuthRequestData::from_handle("", &key)
        );
        assert_eq!(
            Err(Error::InvalidAuthRequestHandle),
            AuthRequestData::from_handle("not base64", &key)
        );
    }

    #[test]
    fn derive_secret() {
        assert_eq!(
            Base64Url::encode_string(&super::derive_secret("sauce", "secret".as_bytes())),
            // #!/usr/bin/env python3
            // import hashlib, base64
            // base64.urlsafe_b64encode( hashlib.sha256(b"sauce\0secret").digest())
            "Elu83iqLSCgBQYov_V5HPye-s_cKYc7IifxDrUMv57g="
        );
    }

    #[test]
    fn grant_code() {
        let secret = "secret".as_bytes();
        let auth_code_secret = super::derive_secret("auth-code", secret);
        let auth_request_handle_secret = super::derive_secret("auth-request-handle", secret);

        let oidc = new(MockHandler {}, secret);

        // invalid_auth_handle results in error
        assert_eq!(
            oidc.grant_code("".to_string(), |_| Ok("".to_string())),
            Err(Error::InvalidAuthRequestHandle)
        );

        let handle = AuthRequestData {
            state: "state".to_string(),
            nonce: "nonce".to_string(),
            redirect_uri: "uri".to_string(),
            scope: "scope".to_string(),
            client_id: "foo".to_string(),
        }
        .to_handle(&auth_request_handle_secret)
        .unwrap();

        // error in creation of id_token result in error
        assert_eq!(
            oidc.grant_code(handle.clone(), |_| Err(())),
            Err(Error::IdTokenCreation)
        );

        // correct inputs lead to the correct outputs
        if let Ok(UriResponse {
            uri,
            data: UriResponseData::CodeGrant { code, state },
        }) = oidc.grant_code(handle, |tcd| {
            assert_eq!(
                tcd,
                TokenCreationData {
                    nonce: "nonce".to_string(),
                    client_id: "foo".to_string(),
                    scope: "scope".to_string(),
                },
            );

            Ok("id_token".to_string())
        }) {
            assert_eq!(uri, "uri".to_string());
            assert_eq!(state, "state".to_string());

            let acd = AuthCodeData::from_code(code.clone(), &auth_code_secret, "foo").unwrap();

            assert_eq!(
                acd,
                AuthCodeData {
                    id_token: "id_token".to_string(),
                },
            );

            // cannot decode auth_code with other client_id
            assert_eq!(
                AuthCodeData::from_code(code, &auth_code_secret, "bar"),
                Err(Error::InvalidAuthCode)
            );
        } else {
            assert!(false);
        }
    }

    #[test]
    fn handle_token() {
        const secret: &[u8] = "secret".as_bytes();
        // MARK

        #[derive(Clone)]
        struct S {
            auth_code_secret: Secret,
            client_hmac_secret: Secret,
            client_password_secret: Secret,
            redirect_uri: String,
            client_bare_id: String,
            client_id: Option<ClientId>,
            acd: AuthCodeData,
            credentials: basic_auth::Credentials,
            query: TokenQuery,
            req: MockHttpRequest,
        }

        impl S {
            fn set_client_id(&mut self) {
                self.client_id = Some(ClientId::new(
                    &self.client_bare_id,
                    &self.client_hmac_secret,
                    &self.redirect_uri,
                ));
            }

            fn set_credentials(&mut self) {
                self.credentials = basic_auth::Credentials {
                    userid: self.client_id.as_ref().unwrap().as_ref().to_owned(),
                    password: ClientId::password(
                        self.client_id.as_ref().unwrap().as_ref(),
                        &self.client_password_secret,
                    ),
                }
            }

            fn set_query(&mut self) {
                self.query.code = self
                    .acd
                    .to_code(&self.auth_code_secret, &self.client_id.as_ref().unwrap())
                    .unwrap();
                self.query.client_id = self.client_id.as_ref().unwrap().as_ref().to_owned();
                self.query.redirect_uri = self.redirect_uri.clone();
            }

            fn set_request(&mut self) {
                self.req.authorization = Some(self.credentials.to_string());
                self.req.body = serde_urlencoded::to_string(&self.query).unwrap();
            }

            fn handle_token(&self, oidc: &impl Oidc<H = MockHandler>) -> HttpResponse {
                match oidc.handle_token(self.req.clone()) {
                    MockHttpResponse::FromOidc(result) => result,
                    _ => panic!("expected FromOidc"),
                }
            }
        }

        let oidc = new(MockHandler {}, secret);

        let mut s = S {
            auth_code_secret: super::derive_secret("auth-code", secret),
            client_hmac_secret: super::derive_secret("client-hmac", secret),
            client_password_secret: super::derive_secret("client-password", secret),
            redirect_uri: "https://example.com".to_string(),
            client_bare_id: "foo".to_string(),
            client_id: None, // set by set_client_id
            acd: AuthCodeData {
                id_token: "id_token".to_string(),
            },
            credentials: basic_auth::Credentials {
                userid: "".to_string(),   // set by set_credentials
                password: "".to_string(), // idem
            },
            query: TokenQuery {
                grant_type: "authorization_code".to_string(),
                code: "".to_string(),         // set by set_query
                client_id: "".to_string(),    // idem
                redirect_uri: "".to_string(), // idem
            },
            req: MockHttpRequest {
                query: "".to_string(),
                authorization: None, // set by set_request
                content_type: Some(ContentType::UrlEncoded),
                body: "".to_string(), // set by set_request
                method: HttpMethod::Post,
            },
        };

        s.set_client_id();
        s.set_credentials();
        s.set_query();
        s.set_request();

        // first test the happy flow
        assert_eq!(
            s.handle_token(&oidc),
            HttpResponse::IdToken("id_token".to_string())
        );

        // wrong method
        {
            let mut s = s.clone();
            s.req.method = HttpMethod::Get;
            assert_eq!(s.handle_token(&oidc), HttpResponse::UnsupportedMethod)
        }

        // wrong content type
        {
            let mut s = s.clone();
            s.req.content_type = None;
            assert_eq!(s.handle_token(&oidc), HttpResponse::UnsupportedContentType)
        }

        // invalid body
        {
            let mut s = s.clone();
            s.req.body = "".to_string();
            assert_eq!(s.handle_token(&oidc), HttpResponse::MalformedRequestBody)
        }

        // invalid grant type
        {
            let mut s = s.clone();
            s.query.grant_type = "invalid".to_string();
            s.set_request();
            assert_eq!(s.handle_token(&oidc), HttpResponse::UnsupportedGrantType)
        }

        // authorization problems
        {
            // missing authorization
            let mut s = s.clone();
            s.req.authorization = None;
            assert_eq!(
                s.handle_token(&oidc),
                HttpResponse::MissingClientCredentials
            );

            // wrong userid
            s.client_bare_id = "not_foo".to_string();
            s.set_client_id();
            s.set_credentials();
            // We don't do "s.set_query();" so query still holds "foo~..." as client_id.
            s.set_request();
            assert_eq!(
                s.handle_token(&oidc),
                HttpResponse::InvalidClientCredentials
            );
        }

        {
            // wrong password
            let mut s = s.clone();
            s.credentials.password = "gibberish".to_string();
            s.set_request();
            assert_eq!(
                s.handle_token(&oidc),
                HttpResponse::InvalidClientCredentials
            );
        }

        {
            // invalid client mac
            let mut s = s.clone();

            s.client_id = Some(ClientId::from_str("some~thing invalid").unwrap());
            s.set_credentials();
            s.set_query();
            s.set_request();
            assert_eq!(s.handle_token(&oidc), HttpResponse::InvalidClientMAC);
        }

        {
            // auth code signed by wrong key
            let mut s = s.clone();

            s.auth_code_secret = Secret::default();
            s.set_query();
            s.set_request();
            assert_eq!(s.handle_token(&oidc), HttpResponse::InvalidAuthCode);
        }

        {
            // auth code destined for other client
            let mut s = s.clone();

            let old_client_id = s.query.client_id.clone();

            s.client_bare_id = "not foo".to_string();
            s.set_client_id();
            s.set_query();
            s.query.client_id = old_client_id;
            s.set_request();

            assert_eq!(s.handle_token(&oidc), HttpResponse::InvalidAuthCode);
        }

        {
            // invalid redirect_uri
            let mut s = s.clone();

            s.query.redirect_uri = "something invalid".to_string();
            s.set_request();

            assert_eq!(s.handle_token(&oidc), HttpResponse::InvalidClientMAC);
        }
    }
}
