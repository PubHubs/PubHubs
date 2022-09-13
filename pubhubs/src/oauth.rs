use crate::data::{HubHandle, Hubid};
use expry::{key_str, value, BytecodeVec};
use hairy::hairy_eval_html_custom;
use hyper::header::CONTENT_TYPE;
use hyper::http::HeaderValue;
use hyper::{Body, Request, Response, StatusCode};
use pbkdf2::password_hash::{PasswordHash, PasswordVerifier};
use pbkdf2::Pbkdf2;
use rand::RngCore;
use std::collections::HashMap;
use std::fmt::{Debug, Formatter};

use std::time::{Duration, Instant};

use crate::oauth::AuthCommands::{AuthorizeGrantRequest, CreateAuthRequest, CreateToken, GetId};
use crate::oauth::GrantValue::{Authorized, Requested, Tokenized};
use crate::{DataCommands, GetHub, TranslateFuncs};
use serde_json::json;
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::sync::oneshot;

// 7 days validity for a token.
const TOKEN_DURATION: u64 = 60 * 60 * 24 * 7;

/// A module to use the OIDC identity provider in matrix (Synapse home server is what is used).
/// So this is a combination of web endpoints and internal authorization flow. For now it's a kind of proof of concept using an id/pmp
/// entered in a html form. The next step will be replacing this with a combination of IRMA and encrypted
/// local pseudonyms.
///
/// For us a client is a Hub and a user is a Hub member or a PubHubs member that want to register for
/// the concerned hub.

/// Manager that contains the grants and clients used to authenticate users. Also has the methods to move
/// the user and client through the authentication flow. The web endpoints use this functionality.
pub fn make_auth_manager(mut rx: Receiver<AuthCommands>, db_tx: Sender<DataCommands>) {
    tokio::spawn(async move {
        let mut grants: HashMap<String, GrantValue> = HashMap::new();
        while let Some(cmd) = rx.recv().await {
            handle(&db_tx, &mut grants, cmd).await
        }
    });
}

async fn handle(
    db_tx: &Sender<DataCommands>,
    grants: &mut HashMap<String, GrantValue>,
    cmd: AuthCommands,
) {
    match cmd {
        CreateAuthRequest {
            grant_request,
            resp,
        } => {
            resp.send(create_auth_request(db_tx, grants, &grant_request).await)
                .expect("To use our channel");
        }
        AuthorizeGrantRequest { form, resp } => {
            resp.send(authorize_grant_request(grants, &form))
                .expect("To use our channel");
        }
        CreateToken {
            client_id,
            passphrase,
            request,
            resp,
        } => {
            resp.send(
                create_token(grants, db_tx, client_id.to_string(), &passphrase, &request).await,
            )
            .expect("To use our channel");
        }
        GetId {
            token,
            token_type,
            resp,
        } => {
            resp.send(get_id(grants, &token, &token_type))
                .expect("To use our channel");
        }
    }
}

#[derive(Debug)]
pub enum AuthCommands {
    CreateAuthRequest {
        grant_request: Grant,
        resp: oneshot::Sender<Option<Grant>>,
    },
    AuthorizeGrantRequest {
        form: AcceptForm,
        resp: oneshot::Sender<Option<Grant>>,
    },
    CreateToken {
        client_id: String,
        passphrase: String,
        request: TokenRequest,
        resp: oneshot::Sender<Option<String>>,
    },
    GetId {
        token: String,
        token_type: String,
        resp: oneshot::Sender<Option<String>>,
    },
}

/// Validate an auth request and if valid return the created corresponding Grant. Allowing the caller to ask the resource owner for permission.
async fn create_auth_request(
    db_tx: &Sender<DataCommands>,
    grants: &mut HashMap<String, GrantValue>,
    grant_request: &Grant,
) -> Option<Grant> {
    let (tx, rx) = oneshot::channel();
    db_tx
        .send(GetHub {
            resp: tx,
            handle: HubHandle::Name(grant_request.client_id.clone()),
        })
        .await
        .expect("To use our channel");

    let retval = rx.await;
    if let Ok(Ok(client)) = retval {
        if client.redirection_uri == grant_request.redirect_uri
            && "code" == grant_request.response_type
        {
            let mut saved_request = grant_request.clone();
            saved_request.set_duration();
            saved_request.hubid = Some(client.id);

            grants.insert(
                saved_request.state.clone(),
                Requested(saved_request.clone()),
            );
            Some(saved_request)
        } else {
            log::debug!("create_auth_request: invalid redirection uri ({} != {}) or incorrect response_type ({} != 'code')", grant_request.redirect_uri, client.redirection_uri, grant_request.response_type);
            None
        }
    } else {
        log::debug!(
            "create_auth_request: no hub with client id {} (or faulty response)",
            grant_request.client_id
        );
        None
    }
}

/// Authorize a grant if valid. Else will return None.
fn authorize_grant_request(
    requests: &mut HashMap<String, GrantValue>,
    form: &AcceptForm,
) -> Option<Grant> {
    match requests.get(form.state.clone().as_str()) {
        Some(Requested(request)) => {
            let grant = request.clone();
            if is_grant_alive(&grant) {
                let authorized_grant = grant.authorize(form.pmp.clone());

                requests.remove(form.state.as_str());
                requests.insert(
                    authorized_grant.auth_code.as_ref().unwrap().to_string(),
                    Authorized(authorized_grant.clone()),
                );
                Some(authorized_grant)
            } else {
                // Remove invalid or denied requests
                requests.remove(form.state.as_str());
                None
            }
        }
        _ => None,
    }
}

async fn create_token(
    grants: &mut HashMap<String, GrantValue>,
    db_tx: &Sender<DataCommands>,
    client_id: String,
    passphrase: &str,
    request: &TokenRequest,
) -> Option<String> {
    let (tx, rx) = oneshot::channel();
    db_tx
        .send(GetHub {
            resp: tx,
            handle: HubHandle::Name(client_id),
        })
        .await
        .expect("To use our channel");

    if let Ok(Ok(client)) = rx.await {
        if Pbkdf2
            .verify_password(
                passphrase.as_bytes(),
                &PasswordHash::new(&client.passphrase).expect("a hash"),
            )
            .is_ok()
            && client.redirection_uri == request.redirect_uri
            && "authorization_code" == request.grant_type
        {
            match grants.get(request.code.as_str()) {
                Some(Authorized(grant)) => {
                    if is_grant_alive(grant) {
                        let tokenized = grant.tokenize();
                        grants.remove(request.code.as_str());
                        let token = tokenized.token.as_ref().unwrap().clone();
                        grants.insert(token.clone(), Tokenized(tokenized));

                        return Some(token);
                    }
                }
                _ => {
                    grants.remove(request.code.as_str());
                }
            }
        }
    }
    None
}

/// Retrieves id corresponding to a token or None if no matching grant is found.
fn get_id(
    grants: &mut HashMap<String, GrantValue>,
    token: &str,
    token_type: &str,
) -> Option<String> {
    if token_type == "Bearer" {
        if let Some(Tokenized(grant)) = grants.get(token) {
            if is_grant_alive(grant) {
                return Some(grant.encrypted_pseudonym.as_ref().unwrap().to_string());
            } else {
                grants.remove(token);
            }
        }
    }
    None
}

pub enum GrantValue {
    Requested(Grant),
    Authorized(Grant),
    Tokenized(Grant),
}

// TODO: check the user can't manipulate oauth
//       by setting one of the internal values
#[derive(serde::Deserialize, Clone)]
pub struct Grant {
    client_id: String,
    hubid: Option<Hubid>,
    redirect_uri: String,
    state: String,
    nonce: String,
    response_type: String,
    auth_code: Option<String>,
    token: Option<String>,
    valid_until: Option<Duration>,
    #[serde(skip)]
    issued: Option<Instant>,
    encrypted_pseudonym: Option<String>,
}

impl Debug for Grant {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Grant")
            .field("client_id", &self.client_id)
            .field("redirect_uri", &self.redirect_uri)
            .field("state", &self.state)
            .field("nonce", &self.nonce)
            .field("auth_code", &self.auth_code)
            .field("token", &self.token)
            .finish()
    }
}

impl Grant {
    fn authorize(&self, id: String) -> Grant {
        let mut new = self.clone();
        new.auth_code = Some(generate_16_byte_random_code_in_bas64());
        new.issued = Some(Instant::now());
        // 10 minutes validity for a authorization code.
        new.valid_until = Some(Duration::from_secs(10 * 60));
        new.encrypted_pseudonym = Some(id);
        new
    }

    fn tokenize(&self) -> Grant {
        let mut new = self.clone();
        new.auth_code = None;
        new.token = Some(generate_16_byte_random_code_in_bas64());
        new.issued = Some(Instant::now());
        new.valid_until = Some(Duration::from_secs(TOKEN_DURATION));
        new
    }

    fn set_duration(&mut self) {
        self.issued = Some(Instant::now());
        // 10 minutes validity for a request.
        self.valid_until = Some(Duration::from_secs(10 * 60));
    }
}

/// The authorization request is received here. See <https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.1>
pub(crate) async fn get_authorize(
    hair: &BytecodeVec,
    grant_request: Option<&str>,
    auth_state: Sender<AuthCommands>,
    _db_tx: &Sender<DataCommands>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    let grant_request: Grant = match serde_urlencoded::from_str(grant_request.unwrap_or("")) {
        Ok(req) => req,
        Err(_err) => {
            let mut resp = Response::new(Body::empty());
            *resp.status_mut() = StatusCode::BAD_REQUEST;
            return resp;
        }
    };

    let (tx, rx) = oneshot::channel();
    auth_state
        .send(CreateAuthRequest {
            grant_request: grant_request.clone(),
            resp: tx,
        })
        .await
        .expect("To use our channel");

    let retval = rx.await;
    if let Ok(Some(saved_request)) = retval {
        let state = grant_request.state.as_str();
        // TODO errors
        let hub_name = saved_request.client_id;
        let hubid = saved_request
            .hubid
            .expect("some hubid to be set by CreateAuthRequest")
            .to_string();
        let prefix = translations.get_prefix();
        let data = value!( {
            "hub": hubid,
            "url": "/oauth2/auth",
            "state": state,
            "hub_name": hub_name,
            "content": "authenticate",
            "url_prefix": prefix
        })
        .to_vec(false);

        let body = hairy_eval_html_custom(hair.to_ref(), data.to_ref(), translations)
            .expect("To render a template");
        Response::new(Body::from(body))
    } else {
        log::debug!("Unknown client exception: {:?}", retval);
        unknown_client(grant_request)
    }
}

#[derive(serde::Deserialize, Clone, serde::Serialize)]
pub struct AcceptForm {
    pmp: String,
    state: String,
}

impl Debug for AcceptForm {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AcceptForm")
            .field("state", &self.state)
            .finish()
    }
}

/// The response here will be the authorization response, this will redirect the resource owner back to the client (the hub), with the authorization code.
/// Allowing the client to request a token.
/// See here: <https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2>
pub(crate) async fn post_authorize(
    mut request: Request<Body>,
    auth_state: Sender<AuthCommands>,
) -> Response<Body> {
    let body = String::from_utf8(Vec::from(
        hyper::body::to_bytes(&mut request).await.unwrap().as_ref(),
    ))
    .unwrap();
    let form: AcceptForm = match serde_json::from_str(&body) {
        Ok(form) => form,
        Err(_error) => {
            let mut resp = Response::new(Body::empty());
            *resp.status_mut() = StatusCode::BAD_REQUEST;
            return resp;
        }
    };

    let (tx, rx) = oneshot::channel();
    auth_state
        .send(AuthorizeGrantRequest {
            form: form.clone(),
            resp: tx,
        })
        .await
        .expect("To use our channel");

    if let Ok(Some(authorized_grant)) = rx.await {
        let redirection_parameters = vec![
            ("code", authorized_grant.auth_code.as_ref().unwrap()),
            ("state", &authorized_grant.state),
        ];
        let redirect = format!(
            "{}?{}",
            &authorized_grant.redirect_uri,
            serde_urlencoded::to_string(redirection_parameters).unwrap()
        );
        Response::new(Body::from(redirect))
    } else {
        access_denied(form.state.clone())
    }
}

#[derive(serde::Deserialize, Clone, serde::Serialize, Debug)]
pub struct TokenRequest {
    grant_type: String,
    code: String,
    redirect_uri: String,
}

/// Issue the token as specified in <https://datatracker.ietf.org/doc/html/rfc6749#section-5>
pub(crate) async fn token(
    mut request: Request<Body>,
    auth_state: Sender<AuthCommands>,
) -> Response<Body> {
    let (client_id, passphrase) = process_token_header(&request);

    if client_id.is_none() || passphrase.is_none() {
        return invalid_client();
    }

    let client_id = client_id.unwrap();
    let passphrase = passphrase.unwrap();

    let body = String::from_utf8(Vec::from(
        hyper::body::to_bytes(&mut request).await.unwrap().as_ref(),
    ))
    .unwrap();
    let token_request: TokenRequest = match serde_urlencoded::from_str(&body) {
        Ok(req) => req,
        Err(_error) => {
            let mut resp = Response::new(Body::empty());
            *resp.status_mut() = StatusCode::BAD_REQUEST;
            return resp;
        }
    };

    let (tx, rx) = oneshot::channel();
    auth_state
        .send(CreateToken {
            client_id,
            passphrase,
            request: token_request.clone(),
            resp: tx,
        })
        .await
        .expect("To use our channel");

    match rx.await {
        Ok(Some(token)) => {
            let body = json!({
                "access_token": token,
                "type": "Bearer",
                "expires_in": TOKEN_DURATION,
            })
            .to_string();

            let mut resp = Response::new(Body::from(body));
            resp.headers_mut().insert(
                CONTENT_TYPE,
                HeaderValue::from_str("application/json").unwrap(),
            );
            resp
        }
        _ => invalid_grant(),
    }
}

fn process_token_header(r: &Request<Body>) -> (Option<String>, Option<String>) {
    if let Some(auth) = r.headers().get("authorization") {
        let processed_auth_header: Vec<String> = String::from_utf8(Vec::from(auth.as_bytes()))
            .unwrap()
            .split(' ')
            .map(|x| x.to_string())
            .collect();

        if let Some(auth_type) = processed_auth_header.first() {
            if auth_type != "Basic" {
                return (None, None);
            }
        } else {
            return (None, None);
        }

        if let Some(last) = processed_auth_header.last() {
            if let Ok(decoded) = base64::decode(last) {
                let header_auth: Vec<String> = String::from_utf8(decoded)
                    .unwrap()
                    .split(':')
                    .map(|x| x.to_string())
                    .collect();
                let client_id = header_auth.first();
                let passphrase = header_auth.last();

                if let (Some(a), Some(b)) = (client_id, passphrase) {
                    return (Some(a.clone()), Some(b.clone()));
                }
            }
        }
    }
    (None, None)
}

/// Retrieves the user info corresponding to a token. On the current matrix home server configuration this is just an id.
/// In the end this will be the encrypted local pseudonym.
pub(crate) async fn user_info(
    r: Request<Body>,
    auth_state: Sender<AuthCommands>,
) -> Response<Body> {
    let (token_type_option, token_option) = process_user_info_header(r);

    if let (None, None) = (&token_type_option, &token_option) {
        return unauthorized_client_user_info();
    }
    let (tx, rx) = oneshot::channel();
    auth_state
        .send(GetId {
            token: token_option.unwrap(),
            token_type: token_type_option.unwrap(),
            resp: tx,
        })
        .await
        .expect("To use our channel");

    match rx.await {
        Ok(Some(id)) => {
            let body = json!({
                "id": id,
            })
            .to_string();

            let mut resp = Response::new(Body::from(body));
            resp.headers_mut().insert(
                CONTENT_TYPE,
                HeaderValue::from_str("application/json").unwrap(),
            );
            resp
        }
        _ => unauthorized_client_user_info(),
    }
}

fn process_user_info_header(r: Request<Body>) -> (Option<String>, Option<String>) {
    if let Some(auth) = r.headers().get("authorization") {
        let processed_auth_header: Vec<String> = auth
            .to_str()
            .unwrap()
            .split(' ')
            .map(|x| x.to_string())
            .collect();

        let token_type = processed_auth_header.first();
        let token = processed_auth_header.last();
        if let (Some(a), Some(b)) = (token_type, token) {
            return (Some(a.clone()), Some(b.clone()));
        }
    }
    (None, None)
}

fn unknown_client(grant_request: Grant) -> Response<Body> {
    oauth_error(
        "invalid_request",
        "unknown client",
        grant_request.state.as_str(),
    )
}

fn access_denied(state: String) -> Response<Body> {
    oauth_error(
        "access_denied",
        "no permission given to access resources",
        state.as_str(),
    )
}

fn oauth_error(error: &str, error_description: &str, state: &str) -> Response<Body> {
    let body = serde_urlencoded::to_string(vec![
        ("error", error),
        ("error_description", error_description),
        ("state", state),
    ])
    .unwrap();

    let mut resp = Response::new(Body::from(body));
    *resp.status_mut() = StatusCode::UNAUTHORIZED;
    resp.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_str("application/x-www-form-urlencoded").unwrap(),
    );
    resp
}

fn unauthorized_client_user_info() -> Response<Body> {
    let body = serde_urlencoded::to_string(vec![
        ("error", "access_denied"),
        (
            "error_description",
            "Please authorize using the authorization header using a Bearer token.",
        ),
    ])
    .unwrap();
    let mut resp = Response::new(Body::from(body));
    resp.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_str("application/x-www-form-urlencoded").unwrap(),
    );
    *resp.status_mut() = StatusCode::UNAUTHORIZED;
    resp
}

fn invalid_grant() -> Response<Body> {
    let body = serde_urlencoded::to_string(vec![
        ("error", "invalid_grant"),
        ("error_description", "This grant was not valid"),
    ])
    .unwrap();
    let mut resp = Response::new(Body::from(body));
    resp.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_str("application/x-www-form-urlencoded").unwrap(),
    );
    *resp.status_mut() = StatusCode::UNAUTHORIZED;
    resp
}

fn invalid_client() -> Response<Body> {
    let body = serde_urlencoded::to_string(vec![
        ("error", "invalid_client"),
        (
            "error_description",
            "This client was not valid, please use an authorization header with basic authentication",
        ),
    ]).unwrap();
    let mut resp = Response::new(Body::from(body));
    resp.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_str("application/x-www-form-urlencoded").unwrap(),
    );
    *resp.status_mut() = StatusCode::UNAUTHORIZED;
    resp
}

fn is_grant_alive(grant: &Grant) -> bool {
    if let (Some(issued), Some(duration)) = (grant.issued, grant.valid_until) {
        Instant::now().duration_since(issued) <= duration
    } else {
        false
    }
}

fn generate_16_byte_random_code_in_bas64() -> String {
    let mut rng = rand::thread_rng();
    let mut rand_array: [u8; 16] = [0; 16];
    rng.fill_bytes(&mut rand_array);
    base64::encode(rand_array)
}

#[cfg(test)]
#[allow(unused_must_use)]
mod tests {
    use super::*;
    use crate::data::{make_in_memory_database_manager, Hubid};
    use crate::DataCommands::CreateHub;
    use hairy::hairy_compile_html;
    use hyper::header::AUTHORIZATION;

    use regex::Regex;
    use serde_json::Value;
    use std::fs::read_to_string;
    use tokio::sync::{mpsc, oneshot};

    #[tokio::test]
    async fn test_happy_flow_works() {
        // Use preconfigured constants and dependencies
        let grants = HashMap::new();
        let (_hubid, client_id, passphrase, redirect_uri, hair, auth_state, db_tx) =
            get_config(grants).await;

        // Make the first request, users will be redirected here through the client.
        let query_input = query_input_for_get_request(client_id, redirect_uri);
        let query = serde_urlencoded::to_string(query_input).unwrap();

        let mut translations = TranslateFuncs::default();

        let resp = get_authorize(
            &hair,
            Some(&query),
            auth_state.clone(),
            &db_tx,
            &mut translations,
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK);

        // Make the request that the user will send to authorize the client. In the current set-up the user will choose a pmp.
        // This will change.
        let pmp = "some_chosen_name";
        let accept_form = AcceptForm {
            pmp: pmp.to_string(),
            state: "state".to_string(),
        };

        let post_request = Request::new(Body::from(serde_json::to_string(&accept_form).unwrap()));

        let post_resp = post_authorize(post_request, auth_state.clone()).await;

        assert_eq!(post_resp.status(), StatusCode::OK);
        let redirect = get_string_body(post_resp).await;

        let expected_redirect =
            Regex::new(format!("^{}\\?code={}&state={}$", redirect_uri, ".+", "state").as_str())
                .unwrap();
        assert!(expected_redirect.is_match(&redirect));

        let start = redirect.find("code=").unwrap() + "code=".len();
        let end = redirect.find('&').unwrap();

        let authorization_code_url_safe =
            String::from_utf8(Vec::from(redirect[start..end].as_bytes())).unwrap();
        let deserialized = serde_urlencoded::from_str::<Vec<(String, String)>>(
            format!("a={}", authorization_code_url_safe).as_str(),
        )
        .unwrap();
        let (_, authorization_code) = deserialized.first().unwrap();
        // The next request will be from the client using the authorization code from the redirect url.
        let token_request = TokenRequest {
            grant_type: "authorization_code".to_string(),
            code: authorization_code.to_string(),
            redirect_uri: redirect_uri.to_string(),
        };

        let token_body = serde_urlencoded::to_string(&token_request).unwrap();

        let encoded = base64::encode(format!("{}:{}", client_id, passphrase));

        let mut token_http_request = Request::new(Body::from(token_body));
        token_http_request.headers_mut().insert(
            AUTHORIZATION,
            HeaderValue::from_str(format!("Basic {}", encoded).as_str()).unwrap(),
        );

        let token_response = token(token_http_request, auth_state.clone()).await;

        assert_eq!(token_response.status(), StatusCode::OK);

        let deserialized_body = deserialize_json_body(token_response).await;

        assert_eq!(
            (
                deserialized_body["type"].as_str().unwrap(),
                deserialized_body["expires_in"].as_u64().unwrap()
            ),
            ("Bearer", TOKEN_DURATION)
        );

        let access_token = deserialized_body["access_token"].as_str().unwrap();

        // See if we can get the user id back using our new token.
        let mut user_info_http_request = Request::new(Body::empty());
        user_info_http_request.headers_mut().insert(
            AUTHORIZATION,
            HeaderValue::from_str(format!("Bearer {}", access_token).as_str()).unwrap(),
        );

        let user_info_response = user_info(user_info_http_request, auth_state.clone()).await;

        assert_eq!(user_info_response.status(), StatusCode::OK);

        let user_info = deserialize_json_body(user_info_response).await;

        assert_eq!(user_info["id"].as_str().unwrap(), pmp);
    }

    async fn deserialize_json_body(response: Response<Body>) -> Value {
        let string_body = get_string_body(response).await;

        let deserialized_body: Value = serde_json::from_str(string_body.as_str()).unwrap();
        deserialized_body
    }

    // get auth testing
    #[tokio::test]
    async fn test_get_auth_validates_missing_properties() {
        let grants = HashMap::new();
        let (_hubid, _client_id, _passphrase, _redirect_uri, hair, auth_state, db_tx) =
            get_config(grants).await;
        let mut translations = TranslateFuncs::default();
        let resp = get_authorize(
            &hair,
            Some(""),
            auth_state.clone(),
            &db_tx,
            &mut translations,
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST)
    }

    #[tokio::test]
    async fn test_get_auth_validates_missing_properties_response_type() {
        test_missing_param("response_type").await;
    }

    #[tokio::test]
    async fn test_get_auth_validates_missing_properties_nonce() {
        test_missing_param("nonce").await;
    }

    #[tokio::test]
    async fn test_get_auth_validates_missing_properties_state() {
        test_missing_param("state").await;
    }

    #[tokio::test]
    async fn test_get_auth_validates_missing_properties_redirect_uri() {
        test_missing_param("redirect_uri").await;
    }

    #[tokio::test]
    async fn test_get_auth_validates_missing_properties_client_id() {
        test_missing_param("client_id").await;
    }

    #[tokio::test]
    async fn test_get_auth_validates_response_type() {
        let grants = HashMap::new();
        let (_hubid, client_id, _passphrase, redirect_uri, hair, auth_state, db_tx) =
            get_config(grants).await;
        let mut query_input = filter_query_params(client_id, redirect_uri, "response_type");
        query_input.push(("response_type", "not_code".to_string()));
        verify_validation_get_request(&hair, auth_state.clone(), query_input, &db_tx).await
    }

    #[tokio::test]
    async fn test_get_auth_validates_client() {
        let grants = HashMap::new();
        let (_hubid, _client_id, _passphrase, redirect_uri, hair, auth_state, db_tx) =
            get_config(grants).await;
        let query_input = query_input_for_get_request("not-a-valid-client-id", redirect_uri);
        // expect error for unknown hub
        verify_validation_get_request(&hair, auth_state.clone(), query_input, &db_tx).await
    }

    #[tokio::test]
    async fn test_get_auth_validates_redirect_uri() {
        let grants = HashMap::new();
        let (_hubid, client_id, _passphrase, _redirect_uri, hair, auth_state, db_tx) =
            get_config(grants).await;
        let query_input = query_input_for_get_request(client_id, "unknown_redirect_uri");
        verify_validation_get_request(&hair, auth_state.clone(), query_input, &db_tx).await
    }

    async fn verify_validation_get_request(
        hair: &BytecodeVec,
        auth_state: Sender<AuthCommands>,
        query_input: Vec<(&str, String)>,
        db_tx: &Sender<DataCommands>,
    ) {
        let query = serde_urlencoded::to_string(query_input).unwrap();
        let mut translations = TranslateFuncs::default();
        let result = get_authorize(
            hair,
            Some(query.as_str()),
            auth_state,
            db_tx,
            &mut translations,
        )
        .await;

        assert_eq!(result.status(), StatusCode::UNAUTHORIZED);
        let body = get_string_body(result).await;
        let test = unknown_client_response();
        assert_eq!(body, test)
    }

    // post auth testing
    #[tokio::test]
    async fn test_post_auth_only_uses_known_state() {
        let grants = HashMap::new();
        let (_hubid, client_id, _passphrase, redirect_uri, _hb, auth_state, _db_tx) =
            get_config(grants).await;

        add_authorization_request(client_id, redirect_uri, &auth_state).await;

        let pmp = "some_chosen_name";
        let accept_form = AcceptForm {
            pmp: pmp.to_string(),
            state: "not_state".to_string(),
        };

        let post_req = Request::new(Body::from(serde_json::to_string(&accept_form).unwrap()));

        let post_resp = post_authorize(post_req, auth_state.clone()).await;

        assert_eq!(post_resp.status(), StatusCode::UNAUTHORIZED);
        let body = get_string_body(post_resp).await;
        let test = access_denied_response("not_state");
        assert_eq!(body, test)
    }

    // token testing
    #[tokio::test]
    async fn test_token_only_uses_known_authorization_code() {
        let grants = HashMap::new();
        let (_hubid, client_id, passphrase, redirect_uri, _hb, auth_state, _db_tx) =
            get_config(grants).await;

        add_authorization_request(client_id, redirect_uri, &auth_state).await;
        let _authorization_code = add_authorization(&auth_state, "pmp").await;

        let token_request = TokenRequest {
            grant_type: "authorization_code".to_string(),
            code: "not_authorization_code".to_string(),
            redirect_uri: redirect_uri.to_string(),
        };

        let encoded = base64::encode(format!("{}:{}", client_id, passphrase));

        let mut token_http_request = Request::new(Body::from(
            serde_urlencoded::to_string(&token_request).unwrap(),
        ));
        token_http_request.headers_mut().insert(
            AUTHORIZATION,
            HeaderValue::from_str(format!("Basic {}", encoded).as_str()).unwrap(),
        );

        let token_response = token(token_http_request, auth_state.clone()).await;

        assert_eq!(token_response.status(), StatusCode::UNAUTHORIZED);
        let body = get_string_body(token_response).await;
        let test = invalid_grant_response();
        assert_eq!(body, test)
    }

    #[tokio::test]
    async fn test_token_only_uses_the_passphrase() {
        let grants = HashMap::new();
        let (_hubid, client_id, _passphrase, redirect_uri, _hb, auth_state, _db_tx) =
            get_config(grants).await;

        add_authorization_request(client_id, redirect_uri, &auth_state).await;
        let authorization_code = add_authorization(&auth_state, "pmp").await.unwrap();

        let token_request = TokenRequest {
            grant_type: "authorization_code".to_string(),
            code: authorization_code,
            redirect_uri: redirect_uri.to_string(),
        };

        let encoded = base64::encode(format!("{}:{}", client_id, "not_the_passphrase"));

        let mut token_http_request = Request::new(Body::from(
            serde_urlencoded::to_string(&token_request).unwrap(),
        ));
        token_http_request.headers_mut().insert(
            AUTHORIZATION,
            HeaderValue::from_str(format!("Basic {}", encoded).as_str()).unwrap(),
        );

        let token_response = token(token_http_request, auth_state.clone()).await;

        assert_eq!(token_response.status(), StatusCode::UNAUTHORIZED);
        let body = get_string_body(token_response).await;
        let test = invalid_grant_response();
        assert_eq!(body, test)
    }

    #[tokio::test]
    async fn test_token_only_uses_the_basic_authentication_type() {
        let grants = HashMap::new();
        let (_hubid, client_id, passphrase, redirect_uri, _hb, auth_state, _db_tx) =
            get_config(grants).await;

        add_authorization_request(client_id, redirect_uri, &auth_state).await;
        let authorization_code = add_authorization(&auth_state, "pmp").await.unwrap();

        let token_request = TokenRequest {
            grant_type: "authorization_code".to_string(),
            code: authorization_code,
            redirect_uri: redirect_uri.to_string(),
        };

        let encoded = base64::encode(format!("{}:{}", client_id, passphrase));

        let mut token_http_request =
            Request::new(Body::from(serde_json::to_string(&token_request).unwrap()));
        token_http_request.headers_mut().insert(
            AUTHORIZATION,
            HeaderValue::from_str(format!("Bearer {}", encoded).as_str()).unwrap(),
        );

        let token_response = token(token_http_request, auth_state.clone()).await;

        assert_eq!(token_response.status(), StatusCode::UNAUTHORIZED);
        let body = get_string_body(token_response).await;
        let test = invalid_authentication_type_response();
        assert_eq!(body, test)
    }

    // user info testing
    #[tokio::test]
    async fn test_user_info_only_uses_the_bearer_authentication_type() {
        let grants = HashMap::new();
        let (_hubid, client_id, _passphrase, redirect_uri, _hb, auth_state, _db_tx) =
            get_config(grants).await;

        add_authorization_request(client_id, redirect_uri, &auth_state).await;
        let authorization_code = add_authorization(&auth_state, "pmp").await.unwrap();
        let access_token =
            add_token(client_id, &auth_state, &authorization_code, redirect_uri).await;

        let mut user_info_http_request = Request::new(Body::empty());
        user_info_http_request.headers_mut().insert(
            AUTHORIZATION,
            HeaderValue::from_str(format!("Basic {}", access_token).as_str()).unwrap(),
        );

        let user_info_response = user_info(user_info_http_request, auth_state.clone()).await;

        assert_eq!(user_info_response.status(), StatusCode::UNAUTHORIZED);
        let body = get_string_body(user_info_response).await;
        let test = invalid_authentication_type_bearer_response();
        assert_eq!(body, test)
    }

    #[tokio::test]
    async fn test_user_info_only_uses_the_correct_token() {
        let grants = HashMap::new();
        let (_hubid, client_id, _passphrase, redirect_uri, _hb, auth_state, _db_tx) =
            get_config(grants).await;

        add_authorization_request(client_id, redirect_uri, &auth_state).await;
        let authorization_code = add_authorization(&auth_state, "pmp").await.unwrap();
        let _access_token =
            add_token(client_id, &auth_state, &authorization_code, redirect_uri).await;

        let mut user_info_http_request = Request::new(Body::empty());
        user_info_http_request.headers_mut().insert(
            AUTHORIZATION,
            HeaderValue::from_str(format!("Bearer {}", "not_the_access_token").as_str()).unwrap(),
        );

        let user_info_response = user_info(user_info_http_request, auth_state.clone()).await;

        assert_eq!(user_info_response.status(), StatusCode::UNAUTHORIZED);
        let body = get_string_body(user_info_response).await;
        let test = invalid_authentication_type_bearer_response();
        assert_eq!(body, test)
    }

    async fn add_authorization_request(
        client_id: &str,
        redirect_uri: &str,
        auth_state: &Sender<AuthCommands>,
    ) {
        let (tx, rx) = oneshot::channel();
        auth_state
            .send(CreateAuthRequest {
                grant_request: Grant {
                    client_id: client_id.to_owned(),
                    hubid: None,
                    redirect_uri: redirect_uri.to_string(),
                    state: "state".to_string(),
                    nonce: "1".to_string(),
                    response_type: "code".to_string(),
                    auth_code: None,
                    token: None,
                    valid_until: None,
                    issued: None,
                    encrypted_pseudonym: None,
                },
                resp: tx,
            })
            .await;
        rx.await.unwrap();
    }

    /// Authorizes grant and returns the key if it was a valid request or none if not grant_request could be created.
    async fn add_authorization(auth_state: &Sender<AuthCommands>, pmp: &str) -> Option<String> {
        let accept_form = AcceptForm {
            pmp: pmp.to_string(),
            state: "state".to_string(),
        };

        let (tx, rx) = oneshot::channel();

        auth_state
            .send(AuthorizeGrantRequest {
                form: accept_form,
                resp: tx,
            })
            .await;

        match rx.await.unwrap() {
            None => None,
            Some(grant) => Some(grant.auth_code.as_ref().unwrap().to_string()),
        }
    }

    async fn add_token(
        client_id: &str,
        auth_state: &Sender<AuthCommands>,
        code: &str,
        redirect_uri: &str,
    ) -> String {
        let token_request = TokenRequest {
            grant_type: "authorization_code".to_string(),
            code: code.to_string(),
            redirect_uri: redirect_uri.to_string(),
        };
        let (tx, rx) = oneshot::channel();

        auth_state
            .send(CreateToken {
                client_id: client_id.to_owned(),
                passphrase: "eh".to_string(),
                request: token_request,
                resp: tx,
            })
            .await;

        rx.await.unwrap().unwrap()
    }

    fn query_input_for_get_request(
        client_id: &str,
        redirect_uri: &str,
    ) -> Vec<(&'static str, String)> {
        let query_input = vec![
            ("client_id", client_id.to_string()),
            ("redirect_uri", redirect_uri.to_string()),
            ("state", "state".to_string()),
            ("nonce", "nonce".to_string()),
            ("response_type", "code".to_string()),
        ];
        query_input
    }

    fn filter_query_params<'a>(
        client_id: &str,
        redirect_uri: &'a str,
        filter: &'a str,
    ) -> Vec<(&'a str, String)> {
        let query_input: Vec<(&str, String)> = query_input_for_get_request(client_id, redirect_uri)
            .iter()
            .filter(|(a, _b)| *a != filter)
            .cloned()
            .collect();
        query_input
    }

    fn unknown_client_response() -> String {
        serde_urlencoded::to_string(vec![
            ("error", "invalid_request"),
            ("error_description", "unknown client"),
            ("state", "state"),
        ])
        .unwrap()
    }
    //
    fn invalid_grant_response() -> String {
        serde_urlencoded::to_string(vec![
            ("error", "invalid_grant"),
            ("error_description", "This grant was not valid"),
        ])
        .unwrap()
    }

    fn invalid_authentication_type_response() -> String {
        serde_urlencoded::to_string(vec![
                ("error", "invalid_client"),
                ("error_description", "This client was not valid, please use an authorization header with basic authentication"),
            ])
                .unwrap()
    }

    fn invalid_authentication_type_bearer_response() -> String {
        serde_urlencoded::to_string(vec![
            ("error", "access_denied"),
            (
                "error_description",
                "Please authorize using the authorization header using a Bearer token.",
            ),
        ])
        .unwrap()
    }

    fn access_denied_response(state: &str) -> String {
        serde_urlencoded::to_string(vec![
            ("error", "access_denied"),
            (
                "error_description",
                "no permission given to access resources",
            ),
            ("state", state),
        ])
        .unwrap()
    }

    async fn test_missing_param(param: &str) {
        let grants = HashMap::new();
        let (_hubid, client_id, _passphrase, redirect_uri, hair, auth_state, db_tx) =
            get_config(grants).await;
        let query_input = filter_query_params(client_id, redirect_uri, param);
        let query = serde_urlencoded::to_string(query_input).unwrap();
        let mut translations = TranslateFuncs::default();
        let resp = get_authorize(
            &hair,
            Some(query.as_str()),
            auth_state.clone(),
            &db_tx,
            &mut translations,
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST)
    }
    //

    pub fn make_test_auth_manager(
        mut rx: Receiver<AuthCommands>,
        db_tx: Sender<DataCommands>,
        _grants: HashMap<String, GrantValue>,
    ) {
        tokio::spawn(async move {
            let mut grants: HashMap<String, GrantValue> = HashMap::new();
            while let Some(cmd) = rx.recv().await {
                handle(&db_tx, &mut grants, cmd).await
            }
        });
    }

    async fn get_config(
        grants: HashMap<String, GrantValue>,
    ) -> (
        Hubid,
        &'static str,
        &'static str,
        &'static str,
        BytecodeVec,
        Sender<AuthCommands>,
        Sender<DataCommands>,
    ) {
        // Hair for templating templates
        let hair_tmpl = read_to_string("static/templates_hair/hair.html").expect("Templates");
        let hair = hairy_compile_html(hair_tmpl.as_str(), "main.tmpl", None, 0)
            .expect("A correct template");

        // Our authentication state to keep track of authorized applications and the grants users allow.
        let (db_tx, db_rx) = mpsc::channel(1_000);
        make_in_memory_database_manager(db_rx);
        let (resp_tx, resp_rx) = oneshot::channel();
        db_tx
            .send(CreateHub {
                name: "eh".to_string(),
                description: "eh".to_string(),
                redirection_uri: "redirect_uri".to_string(),
                passphrase: "eh".to_string(),
                resp: resp_tx,
            })
            .await
            .unwrap();

        let hubid: Hubid = resp_rx
            .await
            .expect("To create a hub")
            .expect("To create a hub");

        let (tx, rx) = mpsc::channel(1_000);

        make_test_auth_manager(rx, db_tx.clone(), grants);

        // Put it all together
        (
            hubid,
            "eh",
            "eh",
            "redirect_uri",
            hair,
            tx.clone(),
            db_tx.clone(),
        )
    }

    async fn get_string_body(mut resp: Response<Body>) -> String {
        String::from_utf8(Vec::from(
            hyper::body::to_bytes(&mut resp).await.unwrap().as_ref(),
        ))
        .unwrap()
    }
}
