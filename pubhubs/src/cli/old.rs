use actix_web::http::header::{CONTENT_TYPE, LOCATION};
use actix_web::{App, HttpRequest, HttpResponse, HttpResponseBuilder, HttpServer, Responder};

use std::fmt::{Debug, Formatter};

use std::fs::read_to_string;

use std::str::FromStr;

use actix_web::web::{self, Data, Form, Path};

use anyhow::{bail, Context, Result};
use env_logger::Env;

use log::{error, info, warn};
use serde::{Deserialize, Serialize};

use tokio::sync::oneshot;

use expry::{key_str, value, BytecodeVec};
use http::{header, HeaderValue};
use prometheus::{Encoder, TextEncoder};
use tokio::sync::mpsc::Sender;

use uuid::Uuid;

use crate::context::Main;
use crate::data::User;
use crate::elgamal::Encoding as _;
use crate::error::{AnyhowExt, TranslatedError};
use crate::hairy_ext::hairy_eval_html_translations;
use crate::middleware;
use crate::middleware::{metrics_auth, metrics_middleware};
use crate::oidc::http::actix_support::CompleteRequest;
use crate::oidc::AuthenticAuthRequestHandle;
use crate::{
    cookie::{
        policy_cookie::accepted_policy, HttpRequestCookieExt as _, HttpResponseBuilderExt as _,
    },
    data::{
        DataCommands::{self, AllHubs, CreateHub, GetHub, GetUserById},
        Hub, HubHandle, Hubid,
    },
    oidc::Oidc as _,
    policy::{full_policy, policy, policy_accept},
    translate::Translations,
    yivi::{disclosed_ph_id, login, next_session, register, SessionDataWithImage},
    yivi_proxy::{yivi_proxy, yivi_proxy_stream},
};

// Limit to 10KB
const PAYLOAD_MAX_SIZE: usize = 10 * 1024;

#[derive(Deserialize, Serialize)]
struct HubForm {
    name: String,
    description: String,
    oidc_redirect_uri: String,
    client_uri: String,
}

impl Debug for HubForm {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("HubForm")
            .field("name", &self.name)
            .field("description", &self.description)
            .field("oidc_redirect_uri", &self.oidc_redirect_uri)
            .field("client_uri", &self.client_uri)
            .finish()
    }
}

#[derive(Debug, Deserialize, Serialize)]
struct HubFormUpdate {
    name: String,
    description: String,
    oidc_redirect_uri: String,
    client_uri: String,
}

async fn index(req: HttpRequest) -> Result<HttpResponse, TranslatedError> {
    Ok(HttpResponse::Ok()
        .body(read_to_string("static/templates_hair/front.html").into_translated_error(&req)?))
}

async fn get_hubs<'a>(
    context: Data<Main>,
    request: HttpRequest,
    translations: Translations,
) -> HttpResponse {
    let (resp_tx, resp_rx) = oneshot::channel();
    context
        .db_tx
        .send(AllHubs { resp: resp_tx })
        .await
        .expect("To use our channel");

    match resp_rx.await {
        Ok(Ok(hubs)) => {
            let hubs = &hubs[..];
            let data = value!({
                "hubs": hubs,
                "content": "hubs_tmpl"
            })
            .to_vec(false);

            //TODO return result, let it bubble up
            HttpResponse::Ok().body(
                hairy_eval_html_translations(context.hair.to_ref(), data.to_ref(), translations)
                    .expect("Expected to render a template"),
            )
        }
        error => internal_server_error(
            "Could not get hubs",
            &context.hair,
            &format!("Someone looked for all hubs and got this error {:?}", error,),
            &request,
            translations,
        ),
    }
}

async fn add_hub(
    context: Data<Main>,
    request: HttpRequest,
    hub: Form<HubForm>,
    translations: Translations,
) -> HttpResponse {
    let (resp_tx, resp_rx) = oneshot::channel();
    context
        .db_tx
        .send(CreateHub {
            name: (hub.name).to_string(),
            description: (hub.description).to_string(),
            oidc_redirect_uri: (hub.oidc_redirect_uri).to_string(),
            client_uri: (hub.client_uri).to_string(),
            resp: resp_tx,
        })
        .await
        .expect("To use our channel");

    match resp_rx.await {
        Ok(Ok(_)) => HttpResponse::Found()
            .insert_header((LOCATION, format!("{}/admin/hubs", translations.prefix())))
            .finish(),
        error => internal_server_error(
            "Could not create hub",
            &context.hair,
            &format!(
                "Someone tried to add a hub with parameters {:?} and got this error {:?}",
                hub, error,
            ),
            &request,
            translations,
        ),
    }
}

async fn get_hub_details(
    id: Path<String>,
    context: Data<Main>,
    request: HttpRequest,
    translations: Translations,
) -> HttpResponse {
    let (tx, rx) = oneshot::channel();
    let id = id.into_inner();
    match Hubid::from_str(&id) {
        Ok(id) => {
            context
                .db_tx
                .send(DataCommands::GetHub {
                    resp: tx,
                    handle: HubHandle::Id(id),
                })
                .await
                .expect("To use our channel");
            match rx.await {
                Ok(Ok(hub)) => {
                    match request.uri().query() {
                        Some("secret") => {
                            let body = context.pep.make_local_decryption_key(
                                &hub,
                            ).unwrap() // TODO: replace this unwrap
                            .to_hex();
                            HttpResponse::Ok().body(body)
                        },
                        _ => render_hub(&context, &hub, translations)
                    }
                },
                error =>
                    internal_server_error(
                        "Could get hub details",
                        &context.hair,
                        &format!(
                            "Someone tried to get details of a hub with parameters {:} and got this error {:?}",
                            id, error,
                        ),
                        &request,translations
                    ),
            }
        }
        Err(err) => bad_request(
            "not an id",
            &context.hair,
            &format!(
                "Someone looked for hub with id {} and got this error {:?}",
                id, err,
            ),
            &request,
            //TODO
            translations,
        ),
    }
}

async fn get_hubid(
    name: Path<String>,
    context: Data<Main>,
    request: HttpRequest,
    translations: Translations,
) -> HttpResponse {
    let (tx, rx) = oneshot::channel();
    let name = name.into_inner();
    context
        .db_tx
        .send(DataCommands::GetHubid {
            resp: tx,
            name: name.to_owned(),
        })
        .await
        .expect("To use our channel");
    match rx.await {
        Ok(Ok(Some(hubid))) => HttpResponse::Ok().body(hubid.to_string()),
        Ok(Ok(None)) => HttpResponse::NotFound().body(format!("there is no hub named {}", name)),
        error => internal_server_error(
            "Could not get hubid",
            &context.hair,
            &format!(
                "Someone tried to get the id of a hub named {:} with but got this error {:?}",
                name, error,
            ),
            &request,
            translations,
        ),
    }
}

fn render_hub(context: &Data<Main>, hub: &Hub, translations: Translations) -> HttpResponse {
    let id = hub.id.to_string();
    let decryption_id = hub.decryption_id.to_string();

    let crate::oidc::ClientCredentials {
        client_id: oidc_client_id,
        password: oidc_client_password,
    } = hub.oidc_credentials(&context.oidc);
    let oidc_client_id: String = oidc_client_id.into();

    let key = context
        .pep
        .make_local_decryption_key(hub)
        .expect("To make a decryption key")
        .to_hex();
    let data = value!({
        "id": id,
        "oidc_client_id": oidc_client_id,
        "oidc_client_password": oidc_client_password,
        "decryption_id": decryption_id,
        "name": hub.name,
        "description": hub.description,
        "oidc_redirect_uri": hub.oidc_redirect_uri,
        "client_uri": hub.client_uri,
        "key": key,
        "content": "hub"
    })
    .to_vec(false);
    HttpResponse::Ok().body(
        hairy_eval_html_translations(context.hair.to_ref(), data.to_ref(), translations).unwrap(),
    )
}

async fn update_hub(
    id: Path<String>,
    context: Data<Main>,
    request: HttpRequest,
    translations: Translations,
    hub_form: Form<HubFormUpdate>,
) -> HttpResponse {
    let (tx, rx) = oneshot::channel();
    let id = id.into_inner();

    match Hubid::from_str(&id) {
        Ok(id) => {
            context
                .db_tx
                .send(DataCommands::UpdateHub {
                    resp: tx,
                    id,
                    name: hub_form.name.clone(),
                    description: hub_form.description.clone(),
                    oidc_redirect_uri: hub_form.oidc_redirect_uri.clone(),
                    client_uri: hub_form.client_uri.clone(),
                })
                .await
                .expect("To use our channel");
            match rx.await  {
                Ok(Ok(hub)) => render_hub(&context, &hub, translations),
                error => internal_server_error(
                    "Could not update hub",
                    &context.hair,
                    &format!(
                        "Someone tried to update hub with id {} and parameters {:?} and got this error {:?}",
                        id, hub_form, error,
                    ),
                    &request,translations
                ),
            }
        }
        Err(err) => bad_request(
            "not an id",
            &context.hair,
            &format!(
                "Someone tried to update hub with id {} and got this error {:?}",
                id, err,
            ),
            &request,
            translations,
        ),
    }
}

async fn get_users(
    context: Data<Main>,
    request: HttpRequest,
    translations: Translations,
) -> HttpResponse {
    let (resp_tx, resp_rx) = oneshot::channel();
    context
        .db_tx
        .send(DataCommands::AllUsers { resp: resp_tx })
        .await
        .expect("To use our channel");

    match resp_rx.await {
        Ok(Ok(users)) => {
            let data = value!({
                "users": users,
                "content": "users_tmpl"
            })
            .to_vec(false);

            HttpResponse::Ok().body(
                hairy_eval_html_translations(context.hair.to_ref(), data.to_ref(), translations)
                    .expect("Expected to render a template"),
            )
        }
        error => internal_server_error(
            "Could not list users",
            &context.hair,
            &format!(
                "Someone tried to get all users and got this error {:?}",
                error,
            ),
            &request,
            translations,
        ),
    }
}

//TODO callers to errorresponse to bubble
pub fn internal_server_error(
    message: &str,
    hair: &BytecodeVec,
    internal_message: &str,
    request: &HttpRequest,
    translations: Translations,
) -> HttpResponse {
    let code = Uuid::new_v4();
    error!(
        "Something went wrong: {:?} gave it user code {} and showed them the message {:?}. The origin was this request: {:?}",
        internal_message, code, message, request
    );
    let code = code.to_string();
    let data = value!({
        "content": "error",
        "error_message": message,
        "code": code,
    })
    .to_vec(false);
    HttpResponse::InternalServerError().body(
        hairy_eval_html_translations(hair.to_ref(), data.to_ref(), translations)
            .expect("Expected to render a template"),
    )
}

pub fn bad_request(
    message: &str,
    hair: &BytecodeVec,
    internal_message: &str,
    request: &HttpRequest,
    translations: Translations,
) -> HttpResponse {
    let code = Uuid::new_v4();
    error!(
        "Someone made a bad request: {} gave it user code {} and showed them the message {}. The origin was this request: {:?}",
        internal_message, code, message, request
    );
    let code = code.to_string();
    let data = value!({
        "content": "error",
        "error_message": message,
        "code": code,
    })
    .to_vec(false);
    HttpResponse::BadRequest().body(
        hairy_eval_html_translations(hair.to_ref(), data.to_ref(), translations)
            .expect("To render a template"),
    )
}

async fn yivi_start(
    request: HttpRequest,
    translations: Translations,
    context: Data<Main>,
) -> HttpResponse {
    let yivi_host = &context.yivi.requestor_api_url;
    let yivi_requestor = &context.yivi.requestor;
    let yivi_requestor_hmac_key = &context.yivi.requestor_hmac_key;
    let pubhubs_url_for_yivi_app = &context.url.for_yivi_app.as_str();
    let hair = &context.hair;

    match login(
        yivi_host,
        yivi_requestor,
        yivi_requestor_hmac_key,
        pubhubs_url_for_yivi_app,
    )
    .await
    {
        Ok(session) => yivi_response(&session),
        Err(error) => internal_server_error(
            "We're having some trouble with Yivi",
            hair,
            &format!(
                "Someone tried to start an Yivi session with {} as requestor {} and got this error {:?}",
                yivi_host,
                yivi_requestor,
                error,
            ),
            &request,
            translations,
        ),
    }
}

async fn yivi_register(
    context: Data<Main>,
    translations: Translations,
    request: HttpRequest,
) -> HttpResponse {
    let yivi_host = &context.yivi.requestor_api_url;
    let yivi_requestor = &context.yivi.requestor;
    let yivi_requestor_hmac_key = &context.yivi.requestor_hmac_key;
    let pubhubs_url_for_yivi_app = &context.url.for_yivi_app.as_str();
    let hair = &context.hair;

    match register(
        yivi_host,
        yivi_requestor,
        yivi_requestor_hmac_key,
        pubhubs_url_for_yivi_app,
    )
    .await
    {
        Ok(session) => yivi_response(&session),
        Err(error) => internal_server_error(
            "We're having some trouble with Yivi",
            hair,
            &format!(
                "Someone tried to start an Yivi sessions and got this error {:?}",
                error,
            ),
            &request,
            translations,
        ),
    }
}

fn yivi_response(session: &SessionDataWithImage) -> HttpResponse {
    let body = serde_json::to_string(&session).expect("To be able to serialize the session");
    HttpResponse::Ok()
        .insert_header((CONTENT_TYPE, "application/json"))
        .body(body)
}

#[derive(Deserialize, Serialize)]
struct YiviFinishParams {
    yivi_token: String,
    oidc_auth_request_handle: Option<String>,
}

/// Non-API endpoint that retrieves the result of the Yivi session with given `token`, and either
///  - redirects the user to the oauth redirect_uri (via POST using an auto-submitting form)
///    when the Yivi sessions was part of an oauth flow, or
///  - 303-redirects the user to their profile page otherwise.
async fn yivi_finish_and_redirect(
    request: HttpRequest,
    context: Data<Main>,
    params: actix_web::web::Form<YiviFinishParams>,
) -> Result<HttpResponse, TranslatedError> {
    yivi_finish_and_redirect_anyhow(context, params)
        .await
        .into_translated_error(&request)
}

async fn yivi_finish_and_redirect_anyhow(
    context: Data<Main>,
    params: actix_web::web::Form<YiviFinishParams>,
) -> Result<HttpResponse, anyhow::Error> {
    anyhow::ensure!(
        params
            .yivi_token
            .chars()
            .all(|c| char::is_ascii_alphanumeric(&c)),
        // Yivi session tokens are always ascii alphanumeric:
        // https://github.com/privacybydesign/irmago/blob/0b3390be045b38b904358bceace229a413824b0b/internal/common/common.go#L34
        "invalid yivi_token - not ascii alphanumeric"
    );

    let user = disclosed_ph_id(
        &context.yivi.requestor_api_url,
        &params.yivi_token,
        context.as_ref(),
    )
    .await?;

    let id = user.external_id;

    // retrieve user
    let user = {
        let (user_tx, user_rx) = oneshot::channel();
        context
            .db_tx
            .send(GetUserById {
                resp: user_tx,
                id: id.clone(),
            })
            .await?;

        // NB: can't use  Option<>::unwrap_or_else  with async.
        match user_rx.await? {
            Ok(user) => user,
            _ => bail!("No such user, {id}"),
        }
    };

    let mut resp_with_cookie = HttpResponse::Ok();
    resp_with_cookie.add_session_cookies(
        user.external_id.clone(),
        &context.cookie_secret,
        context.hotfixes.no_secure_cookies,
        context.hotfixes.no_http_only_cookies,
    )?;

    if params.oidc_auth_request_handle.is_none() {
        // GET-redirect user to the account page
        resp_with_cookie.status(http::StatusCode::SEE_OTHER);
        resp_with_cookie.insert_header((
            http::header::LOCATION,
            format!("/client"),
        ));
        return Ok(resp_with_cookie.finish());
    }

    // Create oidc auth_code and have the user POST it to the redirect_uri,
    // but first check that the auth_request_handle is valid.
    let authentic_auth_request_handle = context
        .oidc
        .open_auth_request_handle(params.oidc_auth_request_handle.as_ref().unwrap())?;

    oidc_response_from_oidc_handle(
        authentic_auth_request_handle,
        context,
        &user,
        resp_with_cookie,
    )
    .await
}

async fn oidc_response_from_oidc_handle(
    authentic_auth_request_handle: AuthenticAuthRequestHandle,
    context: Data<Main>,
    user: &User,
    resp_with_cookie: HttpResponseBuilder,
) -> Result<HttpResponse, anyhow::Error> {
    // Retrieve hub
    let hub = {
        let (tx, rx) = oneshot::channel();
        context
            .db_tx
            .send(GetHub {
                resp: tx,
                handle: HubHandle::Name(
                    crate::oidc::ClientId::from_str(authentic_auth_request_handle.client_id())?
                        .bare_id()
                        .to_string(),
                ),
            })
            .await
            .expect("to use our channel");

        rx.await.expect("expected to use our channel")?
    };

    // create auth_code containing an id_token containing the encrypted local pseudonym
    context
        .oidc
        .grant_code(
            authentic_auth_request_handle,
            |tcd: crate::oidc::TokenCreationData| -> Result<String, ()> {
                let pseudonym = context
                    .pep
                    .convert_to_local_pseudonym(
                        crate::elgamal::Triple::from_hex(&user.pseudonym).ok_or_else(|| {
                            log::warn!("error while parsing user pseudonym");
                        })?,
                        &hub,
                    )
                    .map_err(|e| {
                        log::warn!("error while translating pseudonym: {}", e);
                    })?;

                crate::jwt::sign(
                    // id_token claims, see Section 2 of OpenID Connect Core 1.0
                    &serde_json::json!({
                        "iss": context.url.for_hub.as_str(),
                        "sub": pseudonym.to_hex(),
                        "aud": tcd.client_id,
                        "exp": crate::jwt::get_current_timestamp() + 10*60*60,
                        "iat": crate::jwt::get_current_timestamp(),
                        "nonce": tcd.nonce,
                    }),
                    &context.id_token_key,
                )
                .map_err(|e| {
                    log::warn!("error while signing id_token: {}", e);
                })
            },
        )?
        .into_actix_builder(resp_with_cookie)
        // into_actix_builder puts a CSP header not allowing the request to be embedded.
        // This is correct. However for our global client we might need to embed.
        .map(|mut res| {
            let headers = res.headers_mut();
            let allowed = if context.allowed_embedding_contexts.is_empty() {
                HeaderValue::from_static("frame-ancestors none;")
            } else {
                let list = &context.allowed_embedding_contexts.join(" ");
                match HeaderValue::from_str(format!("frame-ancestors {list};").as_str()) {
                    Ok(x) => x,
                    Err(_) => HeaderValue::from_static("frame-ancestors none;"),
                }
            };
            headers.insert(header::CONTENT_SECURITY_POLICY, allowed);
            res
        })
}

async fn get_account(
    req: HttpRequest,
    id: Path<String>,
    context: Data<Main>,
    translations: Translations,
) -> HttpResponse {
    let cookie_secret = &context.cookie_secret;
    let hair = &context.hair;
    let db_tx = &context.db_tx;
    let id = id.into_inner();
    if req.assert_user_id(cookie_secret, id.clone()).is_ok() {
        let (user_tx, user_rx) = oneshot::channel();
        db_tx
            .send(GetUserById {
                resp: user_tx,
                id: id.clone(),
            })
            .await
            .expect("To use our channel");
        match user_rx.await {
            Ok(Ok(user)) => {

                let global_client_uri : &str = context.global_client_uri();

                let data = value!({
                        "email": user.email,
                        "telephone": user.telephone,
                        "global_client_uri": global_client_uri,
                        "content": "user",
                    }).to_vec(false);
                HttpResponse::Ok().body(hairy_eval_html_translations(hair.to_ref(), data.to_ref(), translations).unwrap())
            },
            Ok(Err(error)) =>
                internal_server_error(
                    "Could not locate user",
                    hair,
                    &format!(
                        "Someone tried to get an account page with a valid cookie with id: '{}' and got this error {:?}",
                        id, error,
                    ),
                    &req,
                    translations
                ),
                Err(error) =>
                internal_server_error(
                    "Could not locate user",
                    hair,
                    &format!(
                        "Someone tried to get an account page with a valid cookie with id: '{}' and got this error {:?}",
                        id, error,
                    ),
                    &req, translations
                ),

        }
    } else {
        HttpResponse::Found()
            .insert_header((LOCATION, format!("{}/login", translations.prefix())))
            .finish()
    }
}

async fn account_login(
    req: HttpRequest,
    context: Data<Main>,
    translations: Translations,
) -> Result<HttpResponse, TranslatedError> {
    let user_id = req
        .user_id_from_cookies(&context.cookie_secret)
        .into_translated_error(&req)?;

    match user_id {
        None => {
            let prefix = translations.prefix().to_string();
            let data = value!( {
                "content": "authenticate",
                "url_prefix": prefix
            })
            .to_vec(false);
            Ok(HttpResponse::Ok().body(
                hairy_eval_html_translations(context.hair.to_ref(), data.to_ref(), translations)
                    .expect("To render a template"),
            ))
        }
        Some(id) => Ok(HttpResponse::Found()
            .insert_header((
                LOCATION,
                format!("{}/account/{}", translations.prefix(), id),
            ))
            .finish()),
    }
}

async fn account_logout(translations: Translations) -> impl Responder {
    HttpResponse::Found()
        .insert_header((LOCATION, format!("{}/login", translations.prefix())))
        .remove_session_cookies() // logout
        .finish()
}

#[derive(Deserialize, Serialize)]
struct RegisterParams {
    oidc_handle: String,
    hub_name: String,
}

async fn register_account(
    req: HttpRequest,
    context: Data<Main>,
    params: Option<Form<RegisterParams>>,
    translations: Translations,
) -> HttpResponse {
    if !accepted_policy(&req) {
        let resp = HttpResponse::Found()
            .insert_header((
                LOCATION,
                format!(
                    "{}/policy?{}",
                    translations.prefix(),
                    req.uri().query().unwrap_or("")
                ),
            ))
            .finish();
        return resp;
    }

    let (oidc_handle, hub_name) = params.map_or_else(Default::default, |params| {
        (params.oidc_handle.clone(), params.hub_name.clone())
    });

    let prefix = translations.prefix().to_string();
    let data = value!( {
        "register": true,
        "oidc_auth_request_handle": oidc_handle,
        "hub_name": hub_name,
        "content": "authenticate",
        "url_prefix": prefix
    })
    .to_vec(false);

    HttpResponse::Ok().body(
        hairy_eval_html_translations(context.hair.to_ref(), data.to_ref(), translations)
            .expect("To render a template"),
    )
}

async fn not_found() -> impl Responder {
    HttpResponse::NotFound().body("Not found!")
}

async fn metrics(context: Data<Main>) -> HttpResponse {
    let encoder = TextEncoder::new();
    let metric_families = context.registry.gather();

    let mut buffer = vec![];
    encoder.encode(&metric_families, &mut buffer).unwrap();

    HttpResponse::Ok().body(buffer)
}

async fn handle_oidc_token(
    req: crate::oidc::http::actix_support::CompleteRequest,
    context: Data<Main>,
) -> HttpResponse {
    context.oidc.handle_token(req).expect("did not expect token endpoint to return an Err - it returns its errors to the oauth client")
}

pub async fn handle_oidc_authorize(
    req: crate::oidc::http::actix_support::CompleteRequest,
    context: Data<Main>,
    translations: Translations,
) -> Result<HttpResponse, TranslatedError> {
    let inner_req = req.request.clone(); // HttpRequests are cheaply cloneable

    // In general we expected users to be logged into PH central when logging in to a hub.
    // In that case we recognize the cookie and create an auth request handle. While this is
    // inefficient, it prevents code duplication.
    if let Some(id) = req
        .request
        // NOTE: We must use the `SameSite=None` `PHAccount.CrossSite` cookie here because the user
        // was sent to this authorization endpoint from another site.
        .user_id_from_cookies_cross_site(&context.cookie_secret)
        .unwrap()
    {
        let extra = CompleteRequest {
            request: inner_req.clone(),
            payload: req.payload.clone(),
        };
        return match context.oidc.issue_auth_request_handle(extra) {
            // Create oidc auth_code and have the user POST it to the redirect_uri,
            Ok((_, handle, _)) => {
                let authentic_auth_request_handle = context
                    .oidc
                    .open_auth_request_handle(handle)
                    .into_translated_error(&inner_req)?;

                match get_user_by_id_wrap(&context.db_tx, id, &req.request, &context, translations)
                    .await
                {
                    Ok(user) => oidc_response_from_oidc_handle(
                        authentic_auth_request_handle,
                        context,
                        &user,
                        HttpResponse::Ok(),
                    )
                    .await
                    .into_translated_error(&inner_req),

                    Err(resp) => Ok(resp),
                }
            }
            Err(resp) => resp.into_translated_error(&inner_req),
        };
    }

    // Not yet logged in, send user on with the Yivi login flow.
    context
        .oidc
        .handle_auth(req, crate::oidc_handler::AD { translations })
        .into_translated_error(&inner_req)
}

async fn get_user_by_id_wrap(
    db_tx: &Sender<DataCommands>,
    id: String,
    req: &HttpRequest,
    context: &Main,
    translations: Translations,
) -> Result<User, HttpResponse> {
    let hair = &context.hair;
    let (user_tx, user_rx) = oneshot::channel();
    let error = match db_tx
        .send(GetUserById {
            resp: user_tx,
            id: id.clone(),
        })
        .await
    {
        Ok(_) => match user_rx.await {
            Ok(Ok(res)) => {
                return Ok(res);
            }
            Err(error) => format!("{error}"),
            Ok(Err(error)) => format!("{error}"),
        },
        Err(error) => format!("{error}"),
    };
    Err(internal_server_error(
        "Could not locate user",
        hair,
        &format!(
            "Someone tried to get a redirect to a hub page with a valid cookie with id: '{}' and got this error {:?}",
            id, error,
        ),
        req,
        translations
    ))
}

#[tokio::main]
pub async fn main() -> Result<()> {
    env_logger::Builder::from_env(Env::default().default_filter_or("info")).init();
    info!("Starting PubHubs!");

    let context = crate::context::Main::create(
        crate::config::File::from_env().context("failed to load configuration file")?,
    )
    .await
    .context("failed to initialize")?;

    let context = Data::from(context);

    let bind_to = context.bind_to.clone();

    let connection_check_nonce = context.connection_check_nonce.clone();
    let urls = context.url.clone();

    info!("binding to {}:{}", bind_to.0, bind_to.1);
    let server_fut = HttpServer::new(move || {
        let context = context.clone();
        App::new()
            .configure(move |cfg| create_app(cfg, context))
            .wrap_fn(metrics_middleware)
            .wrap_fn(middleware::hotfix_middleware)
    })
    .bind(bind_to.clone())?
    .run();

    futures::try_join!(
        // run server
        async move { server_fut.await.context("failed to run server") },
        // and also check that the server is reachable via the url(s) specified in the config
        check_connections(urls, connection_check_nonce),
    )?;
    Ok(())
}

async fn check_connections(urls: crate::context::Urls, nonce: String) -> Result<()> {
    // Remove repetitions from [urls.for_browser, urls.for_yivi_app];
    // we do not check urls.for_hub, because this might be something like http://host.docker.internal
    let urlset: std::collections::HashSet<&url::Url> = [&urls.for_browser, &urls.for_yivi_app]
        .into_iter()
        .collect();
    // Put into a Vec of length 2, filling empty spots with None.
    let mut urls: Vec<Option<&url::Url>> = urlset.into_iter().map(Into::into).collect();
    urls.resize_with(2, Default::default);

    futures::try_join!(
        check_connection_abortable(urls[0], &nonce),
        check_connection_abortable(urls[1], &nonce),
    )?;
    Ok(())
}

/// Checks `url` returns `nonce`, provided url is not None.  Retries a few times upon failure.  Aborts on ctrl+c.
async fn check_connection_abortable(url: Option<&url::Url>, nonce: &str) -> Result<()> {
    if url.is_none() {
        return Ok(());
    }

    let url = url.unwrap().as_str().to_owned() + "_connection_check";

    let (abort_handle, abort_registration) = futures::future::AbortHandle::new_pair();

    futures::try_join!(
        async {
            futures::future::Abortable::new(check_connection(&url, nonce), abort_registration)
                .await
                .unwrap_or_else(|_| {
                    log::warn!("aborted connection check of {}", url);
                    Ok(())
                })
        },
        async {
            tokio::signal::ctrl_c()
                .await
                .context("waiting for ctrl+c")?;
            abort_handle.abort();
            Ok(())
        }
    )
    .map(|_| ())
}

async fn check_connection(url: &str, nonce: &str) -> Result<()> {
    // awc works only in such single-threaded context
    tokio::task::LocalSet::new()
        .run_until(async move {
            info!("checking that you are reachable via {} ...", url);
            for n in 0..10 {
                match check_connection_once(url, nonce).await {
                    Ok(_) => return Ok(()),
                    Err(e) => warn!("try nr. {} failed:  {}", n, e),
                };

                tokio::time::sleep(tokio::time::Duration::from_millis(2_u64.pow(n) * 100)).await;
            }

            #[cfg(debug_assertions)]
            error!("When running PubHubs as a developer, we often need to configure some urls to use the system, \
            we check reachability for two of them: 'urls.for_browser' and 'urls.for_yivi_app'. The browser url is what you can use on your local system to access the \
            platform via the browser. The yivi app is the url your phone needs to connect via the yivi app with the PubHubs central platform. By default change these settings \
            in 'default.yaml'. \
            In a real situation these will all be the same url, and can be configured under a single 'url' key,\
             but as a developer it's much harder to configure that way.");

            Err(anyhow::anyhow!("Could not connect to self via {}. This check is to see if users can reach PubHubs, since they need to be able to reach the server on the provided url. \
            Configure it in the file specified in 'PUBHUBS_CONFIG'.", url))

        })
        .await
}

async fn check_connection_once(url: &str, nonce: &str) -> Result<()> {
    let client = awc::Client::default();
    let mut resp = client
        .get(url)
        // awc cannot deal with the deflate content-encoding produced by the iLab proxy - not sure who's at
        // fault, but we circumvent this problem by setting Accept-Encoding to "identity".
        .insert_header((
            http::header::ACCEPT_ENCODING,
            awc::http::header::ContentEncoding::Identity,
        ))
        .send()
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string() /* e is not Send */))?;

    let status = resp.status();
    anyhow::ensure!(status.is_success(), "{} returned status {}", url, status);

    let bytes = resp.body().await?;
    let result = String::from_utf8(bytes.to_vec())?;

    anyhow::ensure!(result == nonce, "{} did not return {}; we probably connected to another pubhubs instance, or to something else entirely", url, nonce);

    info!(" ✓ got correct response from {}", url);
    Ok(())
}

fn config_actix_files(
    files: actix_files::Files,
    conf: &crate::config::StaticFiles,
) -> actix_files::Files {
    let mut files = files
        .use_etag(!conf.dont_use_etag)
        .use_last_modified(conf.use_last_modified)
        .prefer_utf8(!conf.dont_prefer_utf8);

    if conf.disable_content_disposition {
        files = files.disable_content_disposition();
    }

    files
}

// cfg: &mut web::ServiceConfig
fn create_app(cfg: &mut web::ServiceConfig, context: Data<Main>) {
    let static_files_conf = context.static_files_conf.clone();

    cfg.app_data(context)
        .service(config_actix_files(
            actix_files::Files::new("/css", "./static/assets/css"),
            &static_files_conf,
        ))
        .service(config_actix_files(
            actix_files::Files::new("/fonts", "./static/assets/fonts"),
            &static_files_conf,
        ))
        .service(config_actix_files(
            actix_files::Files::new("/images", "./static/assets/images"),
            &static_files_conf,
        ))
        .service(config_actix_files(
            actix_files::Files::new("/js", "./static/assets/js"),
            &static_files_conf,
        ))
        .service(config_actix_files(
            actix_files::Files::new("/client", "./static/assets/client").index_file("index.html"),
            &static_files_conf,
        ))
        // routes below map be prefixed with a language prefix "/nl", "/en", etc., which
        // will be stripped by the translation middleware
        .service(
            web::scope("/metrics")
                .wrap_fn(metrics_auth)
                .route("", web::get().to(metrics)),
        )
        .route(
            "/.well-known/openid-configuration",
            web::get().to(|context: Data<Main>| async move {
                actix_web::HttpResponse::Ok()
                    .content_type(actix_web::http::header::ContentType::json())
                    .body(context.well_known_openid_configuration.clone())
            }),
        )
        .route(
            "/.well-known/jwks.json",
            web::get().to(|context: Data<Main>| async move {
                actix_web::HttpResponse::Ok()
                    .content_type(actix_web::http::header::ContentType::json())
                    .body(context.well_known_jwks_json.clone())
            }),
        )
        .route(
            "/_connection_check",
            web::get().to(|context: Data<Main>| async move {
                actix_web::HttpResponse::Ok().body(context.connection_check_nonce.clone())
            }),
        )
        .service(
            web::scope("")
                .wrap_fn(middleware::translate)
                .route("/", web::get().to(index))
                .route("/policy", web::get().to(policy))
                .route("/full_policy", web::get().to(full_policy))
                .route("/policy_accept", web::get().to(policy_accept))
                .service(
                    web::scope("admin")
                        .wrap(middleware::Auth {})
                        .route("/hubs", web::get().to(get_hubs))
                        .route("/hubs/{id}", web::post().to(update_hub))
                        .route("/hubs", web::post().to(add_hub))
                        .route("/hubs/{id}", web::get().to(get_hub_details))
                        .route("/users", web::get().to(get_users))
                        .route("/hubid/{name}", web::get().to(get_hubid)),
                )
                .service(
                    // when changing these endpoints, please also update
                    //   .well-known/openid-configuration
                    web::scope("oidc")
                        // shows user-agent page with Yivi QR code or uses cookie to authenticate
                        .route("/auth", web::get().to(handle_oidc_authorize))
                        // Hub retrieves id_token from here
                        .route("/token", web::post().to(handle_oidc_token)),
                )
                .service(
                    web::scope("yivi")
                        .route("/session/{token}/statusevents", web::to(yivi_proxy_stream))
                        .route("/{tail:.*}", web::to(yivi_proxy)),
                )
                .service(
                    web::scope("yivi-endpoint")
                        .route("/", web::post().to(next_session))
                        .route("/start", web::get().to(yivi_start))
                        .route("/register", web::get().to(yivi_register))
                        .route(
                            "/finish-and-redirect",
                            web::post().to(yivi_finish_and_redirect),
                        ),
                )
                .service(
                    web::scope("bar")
                        // get and put the state of the side bar used to switch
                        // between hubs
                        .route("/state", web::get().to(crate::bar::get_state))
                        .route("/state", web::put().to(crate::bar::put_state))
                        .route("/hubs", web::get().to(crate::bar::get_hubs)),
                )
                .route("/register", web::get().to(register_account))
                .route("/register", web::post().to(register_account))
                .route("/account/{id}", web::get().to(get_account))
                .route("/login", web::get().to(account_login))
                .route("/logout", web::get().to(account_logout))
                .default_service(web::route().to(not_found))
                .configure(|cfg| {
                    cfg.app_data(web::PayloadConfig::new(PAYLOAD_MAX_SIZE));
                }),
        );
}

#[allow(unused_must_use)]
#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::{Policy, User};
    use actix_web::body::MessageBody;
    use actix_web::dev::Service;
    use actix_web::http::StatusCode;
    use actix_web::test;
    use actix_web::test::TestRequest;
    use actix_web::FromRequest as _;
    use http::header::{AUTHORIZATION, SET_COOKIE};
    use hyper::header::COOKIE;
    use hyper::service::{make_service_fn, service_fn};
    use hyper::{Body, Request, Response, Server};
    use std::collections::HashMap;
    use std::convert::Infallible;
    use std::net::SocketAddr;
    use std::ops::DerefMut;
    use std::sync::mpsc::{channel, Receiver};
    use std::sync::{Arc, Mutex};

    use crate::data::DataCommands::{CreateUser, GetUser};
    use crate::data::HubHandle::Id;
    use crate::misc::serde_ext::bytes_wrapper::B64;
    use crate::yivi::{
        Attribute, SessionData, SessionPointer, SessionResult, SessionType,
        SessionType::Disclosing, Status, MAIL, MOBILE_NO, PUB_HUBS_ID,
    };
    use regex::Regex;

    #[actix_web::test]
    async fn test_index() {
        let response = index(test::TestRequest::default().to_http_request())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body =
            String::from_utf8(response.into_body().try_into_bytes().unwrap().to_vec()).unwrap();

        let re = Regex::new(r"Pubhubs gaat van start</h2>").unwrap();
        assert!(re.is_match(&body));
    }

    #[actix_web::test]
    async fn test_hubs_ok() {
        let context = create_test_context().await.unwrap();
        let name = "test_name";
        create_hub(name, &context).await;

        let request = test::TestRequest::default().to_http_request();
        let response = get_hubs(Data::from(context), request, Translations::NONE).await;
        assert_eq!(response.status(), StatusCode::OK);

        let body = body_to_string(response).await;

        let re = Regex::new(format!("<td>{}</td>", name).as_str()).unwrap();
        assert!(re.is_match(&body))
    }

    #[actix_web::test]
    async fn test_hubs_error() {
        let context = create_test_context().await.unwrap();
        let name = "test_name";
        create_hub(name, &context).await;

        // Close the database actor
        context.db_tx.send(DataCommands::Terminate {}).await;

        let request = test::TestRequest::default().to_http_request();
        let response = get_hubs(Data::from(context), request, Translations::NONE).await;
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let body = body_to_string(response).await;

        let re = Regex::new("<p>Could not get hubs</p>").unwrap();
        assert!(re.is_match(&body))
    }

    #[actix_web::test]
    async fn create_hub_ok() {
        let context = create_test_context().await.unwrap();
        let hub = HubForm {
            name: "test_hub".to_string(),
            description: "test description".to_string(),
            oidc_redirect_uri: "/test_redirect".to_string(),
            client_uri: "/client".to_string(),
        };

        let request = test::TestRequest::default().to_http_request();
        let response = add_hub(Data::from(context), request, Form(hub), Translations::NONE).await;
        assert_eq!(response.status(), StatusCode::FOUND);
        assert_eq!(response.headers().get(LOCATION).unwrap(), "/admin/hubs");
    }

    #[actix_web::test]
    async fn test_hub_details() {
        let context = create_test_context().await.unwrap();
        let name = "test_name";
        let hubid = create_hub(name, &context).await;

        let request = test::TestRequest::default().to_http_request();
        let response = get_hub_details(
            hubid.to_string().into(),
            Data::from(context),
            request,
            Translations::NONE,
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);

        let body = body_to_string(response).await;
        let regex_specialch = Regex::new(r#"[\n\r]"#).unwrap();
        let body = regex_specialch.replace_all(&body, "");
        let comp: String = format!(r#"Hub id:.*{}<"#, hubid.as_str());
        let re = Regex::new(&comp).unwrap();
        assert!(re.is_match(&body))
    }

    #[actix_web::test]
    async fn test_hub_details_error() {
        let context = create_test_context().await.unwrap();
        let _name = "test_name";

        let request = test::TestRequest::default().to_http_request();
        let response = get_hub_details(
            "notanid".to_string().into(),
            Data::from(context),
            request,
            Translations::NONE,
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = body_to_string(response).await;

        let re = Regex::new("<p>not an id</p>").unwrap();
        assert!(re.is_match(&body))
    }

    #[actix_web::test]
    async fn test_update_hub_details() {
        let context = create_test_context().await.unwrap();
        let name = "test_name";
        let hubid = create_hub(name, &context).await;

        let hub = HubFormUpdate {
            name: "test_name_updated".to_string(),
            description: "test description".to_string(),
            oidc_redirect_uri: "http://synapse.example.com".to_string(),
            client_uri: "http://client.example.com".to_string(),
        };

        let request = test::TestRequest::default().to_http_request();
        let response = update_hub(
            hubid.to_string().into(),
            Data::from(context),
            request,
            Translations::NONE,
            Form(hub),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);

        let body = body_to_string(response).await;
        // To negate element style that places \n or \r in different OS
        let regex_specialch = Regex::new(r#"[\n\r\t]"#).unwrap();
        let body = regex_specialch.replace_all(&body, "");
        let re = Regex::new(r#"input.+test_name_updated.+test description.+required"#).unwrap();
        assert!(re.is_match(&body))
    }

    #[actix_web::test]
    async fn test_update_hub_details_error() {
        let context = create_test_context().await.unwrap();
        let name = "test_name";
        let hubid = create_hub(name, &context).await;

        let hub = HubFormUpdate {
            name: "test_name_updated".to_string(),
            description: "test description".to_string(),
            oidc_redirect_uri: "http://synapse.example.com".to_string(),
            client_uri: "http://client.example.com".to_string(),
        };

        // Close the database actor
        context.db_tx.send(DataCommands::Terminate {}).await;

        let request = test::TestRequest::default().to_http_request();
        let response = update_hub(
            hubid.to_string().into(),
            Data::from(context),
            request,
            Translations::NONE,
            Form(hub),
        )
        .await;
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let body = body_to_string(response).await;
        let re = Regex::new("<p>Could not update hub</p>").unwrap();
        assert!(re.is_match(&body))
    }

    #[actix_web::test]
    async fn test_users_ok() {
        let context = create_test_context().await.unwrap();
        let email = "test_email";
        let email2 = "different_test_email";
        create_user(email, &context).await;
        create_user(email2, &context).await;

        let request = test::TestRequest::default().to_http_request();
        let response = get_users(Data::from(context), request, Translations::NONE).await;
        assert_eq!(response.status(), StatusCode::OK);

        let body = body_to_string(response).await;

        let re = Regex::new(format!("<td>{}</td>", email).as_str()).unwrap();
        assert!(re.is_match(&body));
        let re2 = Regex::new(format!("<td>{}</td>", email2).as_str()).unwrap();
        assert!(re2.is_match(&body))
    }

    #[actix_web::test]
    async fn test_users_error() {
        let context = create_test_context().await.unwrap();

        // Close the database actor
        context.db_tx.send(DataCommands::Terminate {}).await;

        let request = test::TestRequest::default().to_http_request();
        let response = get_users(Data::from(context), request, Translations::NONE).await;
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let body = body_to_string(response).await;
        let re = Regex::new("<p>Could not list users</p>".to_string().as_str()).unwrap();
        assert!(re.is_match(&body));
    }

    async fn start_fake_server(port: u16, user_id: Option<Receiver<String>>) {
        let port_bound = std::sync::Arc::new(tokio::sync::Notify::new());
        let user_id = Arc::new(Mutex::new(user_id));

        {
            let port_bound = port_bound.clone();

            tokio::spawn(async move {
                // We'll bind to 127.0.0.1:<port>
                let addr = SocketAddr::from(([127, 0, 0, 1], port));

                let make_service = make_service_fn(move |_conn| {
                    let user_id = user_id.clone();
                    let service = service_fn(move |req| handle_test(req, user_id.clone()));

                    async move { Ok::<_, Infallible>(service) }
                });

                let server = Server::bind(&addr).serve(make_service);

                port_bound.notify_one();

                if let Err(e) = server.await {
                    eprintln!("server error: {}", e);
                }
            });
        }

        port_bound.notified().await;
    }

    const TEST_TELEPHONE: &str = "test_telephone";

    const TEST_EMAIL: &str = "testemail";

    const NEW_TEST_TELEPHONE: &str = "new_test_telephone";

    const NEW_TEST_EMAIL: &str = "new_testemail";

    async fn handle_test(
        req: Request<Body>,
        user_id: Arc<Mutex<Option<Receiver<String>>>>,
    ) -> Result<Response<Body>, Infallible> {
        let endpoint = req.uri().path().to_string();
        let endpoint = endpoint.as_str();
        let user_id = match user_id.lock().unwrap().deref_mut() {
            None => "1".to_string(),
            Some(rx) => rx.recv().unwrap_or("1".to_string()),
        };
        match endpoint {
            "/test1/session" => {
                let resp_data = SessionData {
                    session_ptr: SessionPointer {
                        u: "http://test_u/test_token/session".to_string(),
                        irmaqr: SessionType::Disclosing,
                    },
                    token: "test_token".to_string(),
                };
                let resp_body = serde_json::to_string(&resp_data).unwrap();
                Ok(Response::new(Body::from(resp_body)))
            }
            "/test1/session/token/result" => make_response(vec![(&user_id, PUB_HUBS_ID)], None),
            "/test2/session/token/result" => make_response(
                vec![(NEW_TEST_EMAIL, MAIL), (NEW_TEST_TELEPHONE, MOBILE_NO)],
                Some("new_disclose".to_string()),
            ),
            "/test2/session/new_disclose/result" => {
                make_response(vec![(&user_id, PUB_HUBS_ID)], None)
            }
            _ => panic!("Got a request I can't test"),
        }
    }

    fn make_response(
        attrs: Vec<(&str, &str)>,
        next_session: Option<String>,
    ) -> Result<Response<Body>, Infallible> {
        let attrs = attrs
            .into_iter()
            .map(|(x, y)| Attribute {
                raw_value: x.to_string(),
                status: "".to_string(),
                id: y.to_string(),
            })
            .collect();
        let resp_data = &SessionResult {
            disclosed: Some(vec![attrs]),
            status: Status::DONE,
            session_type: SessionType::Disclosing,
            proof_status: None,
            next_session,
            error: None,
        };
        let resp_body = serde_json::to_string(&resp_data).unwrap();
        Ok(Response::new(Body::from(resp_body)))
    }

    #[actix_web::test]
    async fn test_yivi_register() {
        let context = create_test_context_with(|mut f| {
            f.yivi.requestor_api_url = "http://localhost:4001/test1".to_string();
            f
        })
        .await
        .unwrap();
        let request = test::TestRequest::default().to_http_request();
        start_fake_server(4001, None).await;

        let resp = yivi_register(Data::from(context), Translations::NONE, request).await;

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_to_string(resp).await;
        let session = serde_json::from_str::<SessionDataWithImage>(&body);
        assert!(session.is_ok());
        assert_eq!(session.unwrap().session_ptr.irmaqr, Disclosing);
    }

    #[actix_web::test]
    async fn test_register_account_redirects_if_policy_not_accepted() {
        let context = create_test_context().await.unwrap();
        let request = test::TestRequest::default().to_http_request();
        let response =
            register_account(request, Data::from(context), None, Translations::NONE).await;

        assert_eq!(response.status(), StatusCode::FOUND);
        assert_eq!(
            response
                .headers()
                .get("Location")
                .unwrap()
                .to_str()
                .unwrap(),
            "/policy?"
        );
    }

    #[actix_web::test]
    async fn test_register_account() {
        let context = create_test_context().await.unwrap();
        let request = test::TestRequest::default()
            .insert_header((COOKIE, "AcceptedPolicy=1"))
            .to_http_request();

        let response =
            register_account(request, Data::from(context), None, Translations::NONE).await;

        let body = body_to_string(response).await;

        assert!(body.contains("let oidc_handle = "));
        assert!(body.contains("let register = true"));
        assert!(body.contains("let url_prefix = \"\""));
        assert!(body.contains("yiviLogin(url_prefix, register, oidc_handle);"));
    }

    // TODO: add test for register_account with RegisterParams not None

    #[actix_web::test]
    async fn test_account_login() {
        let context = create_test_context().await.unwrap();
        let request = test::TestRequest::default().to_http_request();
        let response = account_login(request, Data::from(context), Translations::NONE)
            .await
            .unwrap();

        let body = body_to_string(response).await;
        //To negate element style that places \n or \r in different OS
        let regex_specialch = Regex::new(r"[\n\r]").unwrap();
        let body = regex_specialch.replace_all(&body, "");
        assert!(body.contains("let oidc_handle = null"));
        assert!(body.contains("let register = false"));
        assert!(body.contains("let url_prefix = \"\""));
        assert!(body.contains("yiviLogin(url_prefix, register, oidc_handle);"));
        let re = Regex::new(r#"<button.+Registreren.+button>"#).unwrap();
        assert!(re.is_match(&body));

        let context = create_test_context().await.unwrap();
        let request = test::TestRequest::default().to_http_request();
        let response = account_login(
            request,
            Data::from(context),
            Translations::new("en".to_string(), HashMap::new()),
        )
        .await
        .unwrap();

        let body = body_to_string(response).await;
        // To negate styles because block elements from html
        let regex_specialch = Regex::new(r"[\n\r]").unwrap();
        let body = regex_specialch.replace_all(&body, "");
        println!("{}", body);
        assert!(body.contains("let oidc_handle = null"));
        assert!(body.contains("let register = false"));
        assert!(body.contains("let url_prefix = \"/en\""));
        assert!(body.contains("yiviLogin(url_prefix, register, oidc_handle);"));
        let re = Regex::new(r#"<button.+Registreren.+button>"#).unwrap();
        assert!(re.is_match(&body));
    }

    #[actix_web::test]
    async fn test_no_cookie_hub_login() {
        let oidc_secret: B64 = serde_bytes::ByteBuf::from(b"verysecret".to_vec()).into();
        let context = create_test_context_with(|mut f| {
            f.oidc_secret = Some(oidc_secret);
            f
        })
        .await
        .unwrap();

        let hub_id = create_hub("hub", &context).await;
        let (s, r) = oneshot::channel();
        context
            .db_tx
            .send(GetHub {
                resp: s,
                handle: Id(hub_id),
            })
            .await
            .unwrap();
        let hub = r.await.unwrap().unwrap();

        let crate::oidc::ClientCredentials {
            client_id: oidc_client_id,
            password: _oidc_client_password,
        } = hub.oidc_credentials(&context.oidc);
        let oidc_client_id: String = oidc_client_id.into();
        let ru = hub.oidc_redirect_uri;

        let test_request = TestRequest::default();
        let test_request = test_request.uri(format!("http://smth.example?client_id={oidc_client_id}&response_mode=form_post&response_type=code&redirect_uri={ru}&state=state&nonce=nonce&scope=openid").as_str());
        let (request, mut payload) = test_request.to_http_parts();

        let request = CompleteRequest::from_request(&request, &mut payload)
            .await
            .unwrap();
        let response = handle_oidc_authorize(request, Data::from(context), Translations::NONE)
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = body_to_string(response).await;
        assert!(&body.contains("<title>PubHubs</title>"));
        assert!(!&body.contains("error"));
    }

    #[actix_web::test]
    async fn test_cookie_skips_hub_login() {
        let secret = "very secret";
        let oidc_secret: B64 = serde_bytes::ByteBuf::from(b"verysecret".to_vec()).into();
        let context = create_test_context_with(|mut f| {
            f.cookie_secret = Some(secret.to_string());
            f.oidc_secret = Some(oidc_secret);
            f
        })
        .await
        .unwrap();

        let hub_id = create_hub("hub", &context).await;
        let (s, r) = oneshot::channel();
        context
            .db_tx
            .send(GetHub {
                resp: s,
                handle: Id(hub_id),
            })
            .await
            .unwrap();
        let hub = r.await.unwrap().unwrap();

        let crate::oidc::ClientCredentials {
            client_id: oidc_client_id,
            password: _oidc_client_password,
        } = hub.oidc_credentials(&context.oidc);
        let oidc_client_id: String = oidc_client_id.into();
        let ru = hub.oidc_redirect_uri;

        let user = create_user("email", &context).await;

        let test_request = test::TestRequest::default()
            .add_session_cookies(user, secret, false, false)
            .unwrap();
        let test_request = test_request.uri(format!("http://smth.example?client_id={oidc_client_id}&response_mode=form_post&response_type=code&redirect_uri={ru}&state=state&nonce=nonce&scope=openid").as_str());
        let (request, mut payload) = test_request.to_http_parts();

        let request = CompleteRequest::from_request(&request, &mut payload)
            .await
            .unwrap();
        let response = handle_oidc_authorize(request, Data::from(context), Translations::NONE)
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = body_to_string(response).await;
        assert!(&body.contains("<title>Form redirection...</title>"));
        assert!(!&body.contains("error"));
    }

    #[actix_web::test]
    async fn test_get_account() {
        let secret = "very secret";
        let context = create_test_context_with(|mut f| {
            f.cookie_secret = Some(secret.to_string());
            f
        })
        .await
        .unwrap();
        let email = "email@test.com";
        let user_id = create_user(email, &context).await;
        let request = test::TestRequest::default()
            .add_session_cookies(user_id.clone(), secret, false, false)
            .unwrap();

        let response = get_account(
            request.to_http_request(),
            user_id.to_string().into(),
            Data::from(context),
            Translations::NONE,
        )
        .await;

        assert_eq!(response.status(), StatusCode::OK);
        let body = body_to_string(response).await;
        assert!(body.contains(format!("<p>{}</p>", email).as_str()));
        assert!(body.contains(" <p>test_telephone</p>"));
    }

    #[actix_web::test]
    async fn test_no_access_to_admin() {
        let context = create_test_context().await.unwrap();
        let email = "email@test.com";
        let user_id = create_user(email, &context).await;
        let secret = "very secret";

        let app = test::init_service(
            App::new().configure(move |cfg| create_app(cfg, Data::from(context))),
        )
        .await;
        let req = test::TestRequest::get()
            .uri("/admin/hubs")
            .add_session_cookies(user_id, secret, false, false)
            .unwrap()
            .to_request();

        let response = app.call(req).await;
        match response {
            Ok(_) => {
                assert!(false)
            }
            Err(forbidden) => {
                let resp = forbidden.error_response();
                assert_eq!(resp.status(), StatusCode::FORBIDDEN);
                assert_eq!(body_to_string(resp).await, "Forbidden");
            }
        }
    }

    #[actix_web::test]
    async fn test_bar_hubs() {
        let context = create_test_context().await.unwrap();

        let context_clone = context.clone();
        let app = test::init_service(
            App::new().configure(move |cfg| create_app(cfg, Data::from(context_clone))),
        )
        .await;

        create_hub("hub1", &context).await;

        // OK when GETting /bar/hubs
        let resp = app
            .call(test::TestRequest::get().uri("/bar/hubs").to_request())
            .await
            .unwrap();
        assert_eq!(resp.status(), http::StatusCode::OK);
        assert_eq!(
            resp.headers().get("Content-Type").unwrap(),
            "application/json"
        );
        let result: serde_json::Value =
            serde_json::from_slice(&actix_web::test::read_body(resp).await).unwrap();
        assert_eq!(
            result,
            serde_json::json!([{
                "name": "hub1",
                "description": "test_description",
                "client_uri": "/client",
                "server_uri": "https://somehub/test_redirect",
            }])
        );
    }

    #[actix_web::test]
    async fn test_bar_state() {
        let context = create_test_context().await.unwrap();
        let user_id = create_user("email@example.com", &context).await;

        let context_clone = context.clone();
        let app = test::init_service(
            App::new().configure(move |cfg| create_app(cfg, Data::from(context_clone))),
        )
        .await;

        // FORBIDDEN when GETting /bar/state with invalid cookie
        assert_eq!(
            app.call(
                test::TestRequest::get()
                    .uri("/bar/state")
                    .add_session_cookies(user_id.clone(), "not the cookie secret", false, false)
                    .unwrap()
                    .to_request(),
            )
            .await
            .unwrap()
            .status(),
            http::StatusCode::FORBIDDEN
        );

        // FORBIDDEN when GETting /bar/state with no cookie
        assert_eq!(
            app.call(test::TestRequest::get().uri("/bar/state").to_request(),)
                .await
                .unwrap()
                .status(),
            http::StatusCode::FORBIDDEN
        );

        // OK when GETting /bar/state with valid cookie
        let resp = app
            .call(
                test::TestRequest::get()
                    .uri("/bar/state")
                    .add_session_cookies(user_id.clone(), &context.cookie_secret, false, false)
                    .unwrap()
                    .to_request(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), http::StatusCode::OK);
        assert_eq!(
            resp.headers().get("ETag").unwrap(),
            "\"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\""
        );
        assert_eq!(
            resp.headers().get("Content-Type").unwrap(),
            "application/octet-stream"
        );
        assert!(actix_web::test::read_body(resp).await.is_empty());

        // NO_CONTENT when PUTting /bar/state with valid cookie and If-Match
        let resp = app
            .call(
                test::TestRequest::put()
                    .uri("/bar/state")
                    .add_session_cookies(user_id.clone(), &context.cookie_secret, false, false)
                    .unwrap()
                    .insert_header((CONTENT_TYPE, "application/octet-stream"))
                    .insert_header((
                        actix_web::http::header::IF_MATCH,
                        "\"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\"",
                    ))
                    .set_payload("new state")
                    .to_request(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), http::StatusCode::NO_CONTENT);
        assert_eq!(
            resp.headers().get("ETag").unwrap(),
            "\"8b2eec684b350a01bf1d574d264704722cdf5f0484beee6bf22bb7b26b267329\""
        );
        assert_eq!(
            std::str::from_utf8(&*actix_web::test::read_body(resp).await).unwrap(),
            ""
        );

        // /bar/state has now changed...
        let resp = app
            .call(
                test::TestRequest::get()
                    .uri("/bar/state")
                    .add_session_cookies(user_id.clone(), &context.cookie_secret, false, false)
                    .unwrap()
                    .to_request(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), http::StatusCode::OK);
        assert_eq!(
            resp.headers().get("ETag").unwrap(),
            "\"8b2eec684b350a01bf1d574d264704722cdf5f0484beee6bf22bb7b26b267329\""
        );
        assert_eq!(
            std::str::from_utf8(&*actix_web::test::read_body(resp).await).unwrap(),
            "new state"
        );

        // PRECONDITION_FAILED when PUTting /bar/state with invalid hash
        let resp = app
            .call(
                test::TestRequest::put()
                    .uri("/bar/state")
                    .add_session_cookies(user_id.clone(), &context.cookie_secret, false, false)
                    .unwrap()
                    .insert_header((CONTENT_TYPE, "application/octet-stream"))
                    .insert_header((
                        actix_web::http::header::IF_MATCH,
                        // = sha256("")
                        "\"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\"",
                    ))
                    .set_payload("new state 2")
                    .to_request(),
            )
            .await
            .unwrap();
        assert_eq!(
            resp.response().head().reason(),
            crate::bar::reason::IF_MATCH_DIDNT_MATCH
        );
        assert_eq!(resp.status(), http::StatusCode::PRECONDITION_FAILED);

        // FORBIDDEN  when PUTting /bar/state with invalid cookie
        let resp = app
            .call(
                test::TestRequest::put()
                    .uri("/bar/state")
                    .add_session_cookies(user_id.clone(), "not the cookie secret", false, false)
                    .unwrap()
                    .insert_header((CONTENT_TYPE, "application/octet-stream"))
                    .insert_header((
                        actix_web::http::header::IF_MATCH,
                        "\"8b2eec684b350a01bf1d574d264704722cdf5f0484beee6bf22bb7b26b267329\"",
                    ))
                    .set_payload("new state 2")
                    .to_request(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), http::StatusCode::FORBIDDEN);
        assert_eq!(
            resp.response().head().reason(),
            crate::bar::reason::INVALID_COOKIE
        );

        // FORBIDDEN  when PUTting /bar/state with no cookie
        let resp = app
            .call(
                test::TestRequest::put()
                    .uri("/bar/state")
                    .insert_header((CONTENT_TYPE, "application/octet-stream"))
                    .insert_header((
                        actix_web::http::header::IF_MATCH,
                        "\"8b2eec684b350a01bf1d574d264704722cdf5f0484beee6bf22bb7b26b267329\"",
                    ))
                    .set_payload("new state 2")
                    .to_request(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), http::StatusCode::FORBIDDEN);
        assert_eq!(
            resp.response().head().reason(),
            crate::bar::reason::MISSING_COOKIE
        );

        // BAD_REQUEST  when PUTting /bar/state without If-Match
        let resp = app
            .call(
                test::TestRequest::put()
                    .uri("/bar/state")
                    .add_session_cookies(user_id.clone(), &context.cookie_secret, false, false)
                    .unwrap()
                    .insert_header((CONTENT_TYPE, "application/octet-stream"))
                    .set_payload("new state 2")
                    .to_request(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), http::StatusCode::BAD_REQUEST);
        assert_eq!(
            resp.response().head().reason(),
            crate::bar::reason::IF_MATCH_MISSING
        );

        // BAD_REQUEST when PUTting /bar/state with invalid Content-Type
        let resp = app
            .call(
                test::TestRequest::put()
                    .uri("/bar/state")
                    .add_session_cookies(user_id.clone(), &context.cookie_secret, false, false)
                    .unwrap()
                    .insert_header((CONTENT_TYPE, "application/json"))
                    .insert_header((
                        actix_web::http::header::IF_MATCH,
                        "\"8b2eec684b350a01bf1d574d264704722cdf5f0484beee6bf22bb7b26b267329\"",
                    ))
                    .set_payload("new state 2")
                    .to_request(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), http::StatusCode::BAD_REQUEST);
        assert_eq!(
            resp.response().head().reason(),
            crate::bar::reason::INVALID_CONTENT_TYPE
        );

        // BAD_REQUEST when PUTting /bar/state with no Content-Type
        let resp = app
            .call(
                test::TestRequest::put()
                    .uri("/bar/state")
                    .add_session_cookies(user_id.clone(), &context.cookie_secret, false, false)
                    .unwrap()
                    .insert_header((
                        actix_web::http::header::IF_MATCH,
                        "\"8b2eec684b350a01bf1d574d264704722cdf5f0484beee6bf22bb7b26b267329\"",
                    ))
                    .set_payload("new state 2")
                    .to_request(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), http::StatusCode::BAD_REQUEST);
        assert_eq!(
            resp.response().head().reason(),
            crate::bar::reason::INVALID_CONTENT_TYPE
        );

        // BAD_REQUEST when PUTting /bar/state with multiple ETags
        let resp = app
            .call(
                test::TestRequest::put()
                    .uri("/bar/state")
                    .add_session_cookies(user_id.clone(), &context.cookie_secret, false, false).unwrap()
                    .insert_header((CONTENT_TYPE, "application/octet-stream"))
                    .insert_header((
                        actix_web::http::header::IF_MATCH,
                        "\"8b2eec684b350a01bf1d574d264704722cdf5f0484beee6bf22bb7b26b267329\", \"or_this_perhaps?\"",
                    ))
                    .set_payload("new state 2")
                    .to_request(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), http::StatusCode::BAD_REQUEST);
        assert_eq!(
            resp.response().head().reason(),
            crate::bar::reason::IF_MATCH_MULTIPLE_ETAGS
        );

        // BAD_REQUEST when PUTting /bar/state with '*' If-Match
        let resp = app
            .call(
                test::TestRequest::put()
                    .uri("/bar/state")
                    .add_session_cookies(user_id.clone(), &context.cookie_secret, false, false)
                    .unwrap()
                    .insert_header((CONTENT_TYPE, "application/octet-stream"))
                    .insert_header((actix_web::http::header::IF_MATCH, "*"))
                    .set_payload("new state 2")
                    .to_request(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), http::StatusCode::BAD_REQUEST);
        assert_eq!(
            resp.response().head().reason(),
            crate::bar::reason::IF_MATCH_STAR
        );
    }

    #[actix_web::test]
    async fn test_get_account_only_authorized() {
        let context = create_test_context().await.unwrap();
        let user_id = create_user("email", &context).await.to_string();
        let request = test::TestRequest::get()
            .insert_header((COOKIE, "no"))
            .to_http_request();
        let response = get_account(
            request,
            user_id.into(),
            Data::from(context),
            Translations::NONE,
        )
        .await;

        assert_eq!(response.status(), StatusCode::FOUND);
        let location = response
            .headers()
            .get("Location")
            .unwrap()
            .to_str()
            .unwrap();
        assert_eq!("/login", location);
    }

    #[actix_web::test]
    async fn test_yivi_finish_and_redirect() {
        let cookie_secret = "very_secret";

        let context = create_test_context_with(|mut f| {
            f.cookie_secret = Some(cookie_secret.to_string());
            f.yivi.requestor_api_url = "http://localhost:4002/test1".to_string();
            f
        })
        .await
        .unwrap();
        let user_id = create_user("testemail", &context).await;
        let _hubid = create_test_hub(&context).await;
        let token = "token".to_owned();
        let (tx, rx) = channel();
        start_fake_server(4002, Some(rx)).await;
        tx.send(user_id.clone());

        //existing user account login
        let (req1, mut req1payload) = test::TestRequest::post()
            .set_form(YiviFinishParams {
                yivi_token: token.clone(),
                oidc_auth_request_handle: None,
            })
            .to_http_parts();

        let response = yivi_finish_and_redirect_anyhow(
            Data::from(context.clone()),
            actix_web::web::Form::from_request(&req1, &mut req1payload)
                .await
                .unwrap(),
        )
        .await
        .unwrap();

        assert_eq!(StatusCode::SEE_OTHER, response.status());
        assert!(response.headers().contains_key(SET_COOKIE));
        assert_eq!(
            response.headers().get(LOCATION).unwrap(),
            &format!("/client")
        );

        //existing user hub login
        let client_creds = context
            .oidc
            .generate_client_credentials("", "https://example.com");

        let (auth_req, mut auth_req_payload) = test::TestRequest::with_uri(&format!(
            "https://example.com/?{}",
            serde_urlencoded::to_string([
                ("response_type", "code"),
                ("client_id", client_creds.client_id.as_ref()),
                ("redirect_uri", "https://example.com"),
                ("response_mode", "form_post"),
                ("scope", "openid"),
                ("state", "state"),
                ("nonce", "nonce"),
            ])
            .unwrap()
        ))
        .to_http_parts();

        let (_, auth_request_handle, _) = context
            .oidc
            .issue_auth_request_handle(
                crate::oidc::http::actix_support::CompleteRequest::from_request(
                    &auth_req,
                    &mut auth_req_payload,
                )
                .await
                .unwrap(),
            )
            .unwrap();

        let (req2, mut req2payload) = test::TestRequest::post()
            .set_form(YiviFinishParams {
                yivi_token: token.clone(),
                oidc_auth_request_handle: Some(auth_request_handle),
            })
            .to_http_parts();

        //Send the id again for the fake yivi to return again with this id.
        tx.send(user_id.clone());
        let response = yivi_finish_and_redirect_anyhow(
            Data::from(context.clone()),
            actix_web::web::Form::from_request(&req2, &mut req2payload)
                .await
                .unwrap(),
        )
        .await
        .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert!(response.headers().contains_key(SET_COOKIE));
        // TODO: check that response is a POST-redirect in some way?

        // Discloses new & follow registration flow
        let context = create_test_context_with(|mut f| {
            f.cookie_secret = Some(cookie_secret.to_string());
            f.yivi.requestor_api_url = "http://localhost:4002/test2".to_string();
            f
        })
        .await
        .unwrap();

        //Pretend we are the yiviserver and post to next_session with disclosed mail & phone, to trigger
        // creating the user.
        let body = create_yivi_body();
        let yivi_server_req = TestRequest::post()
            .set_payload(body.clone())
            .to_http_request();
        let resp_y = next_session(yivi_server_req, Data::from(context.clone()), body).await;
        assert_eq!(resp_y.status(), 200);

        let new_user = get_db_user(context.as_ref(), TEST_EMAIL, TEST_TELEPHONE).await;
        //One time is unused but still read by fake server.
        tx.send(new_user.external_id.clone());
        tx.send(new_user.external_id.clone());

        let (req3, mut req3payload) = test::TestRequest::post()
            .set_form(YiviFinishParams {
                yivi_token: token.clone(),
                oidc_auth_request_handle: None,
            })
            .to_http_parts();

        let response = yivi_finish_and_redirect_anyhow(
            Data::from(context.clone()),
            actix_web::web::Form::from_request(&req3, &mut req3payload)
                .await
                .unwrap(),
        )
        .await
        .unwrap();
        assert_eq!(response.status(), StatusCode::SEE_OTHER);
        assert_eq!(
            response.headers().get(LOCATION).unwrap().to_str().unwrap(),
            format!("/client")
        );
        assert!(response.headers().contains_key(SET_COOKIE));

        let user = get_db_user(&context, TEST_EMAIL, TEST_TELEPHONE).await;
        assert_eq!(user.external_id, new_user.external_id);
    }

    fn create_yivi_body() -> String {
        sign_fake_session_result(SessionResult {
            disclosed: Some(vec![vec![
                Attribute {
                    raw_value: TEST_EMAIL.to_string(),
                    status: "".to_string(),
                    id: MAIL.to_string(),
                },
                Attribute {
                    raw_value: TEST_TELEPHONE.to_string(),
                    status: "".to_string(),
                    id: MOBILE_NO.to_string(),
                },
            ]]),
            status: Status::CONNECTED,
            session_type: SessionType::Disclosing,
            proof_status: None,
            next_session: None,
            error: None,
        })
    }

    #[actix_web::test]
    async fn test_policy() {
        let context = create_test_context().await.unwrap();
        let highlights = ["highlight1".to_string(), "highlight2".to_string()];
        let full_policy = "full_policy";

        Policy::new(
            full_policy.to_string(),
            highlights.to_vec(),
            &context.db_tx,
            1000,
        )
        .await;

        let req = TestRequest::default().to_http_request();
        let response = policy(req, Data::from(context), Translations::NONE).await;

        let body = body_to_string(response).await;
        for highlight in highlights {
            assert!(body.contains(&highlight));
        }
    }

    #[actix_web::test]
    async fn test_full_policy() {
        let context = create_test_context().await.unwrap();
        let highlights = ["highlight1".to_string(), "highlight2".to_string()];
        let full_policy = "full_policy";

        Policy::new(
            full_policy.to_string(),
            highlights.to_vec(),
            &context.db_tx,
            1000,
        )
        .await;

        let req = TestRequest::default().to_http_request();
        let response = policy(req, Data::from(context), Translations::NONE).await;

        let body = body_to_string(response).await;
        assert!(body.contains(full_policy));
    }

    #[actix_web::test]
    async fn test_policy_accept() {
        let query = "smt=a&smthelse=b";
        let response = policy_accept(
            Translations::NONE,
            Some(actix_web::web::Query(query.to_owned())),
        )
        .await;
        assert_eq!(response.status(), StatusCode::FOUND);
        let location = response
            .headers()
            .get("Location")
            .unwrap()
            .to_str()
            .unwrap();
        assert!(location.ends_with(query))
    }

    #[actix_web::test]
    async fn test_size_limit() {
        let context = create_test_context().await.unwrap();

        let app = test::init_service(
            App::new().configure(move |cfg| create_app(cfg, Data::from(context))),
        )
        .await;

        // Too large requests are blocked.
        let too_large_request = test::TestRequest::post()
            .uri("/yivi-endpoint/")
            .set_payload(['a' as u8; (PAYLOAD_MAX_SIZE + 1)].to_vec())
            .to_request();

        let response = app.call(too_large_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    }

    #[actix_web::test]
    async fn test_metrics() {
        let context = create_test_context().await.unwrap();

        create_hub("to_generate_some_database_metrics", &context).await;

        let req = test::TestRequest::get()
            .uri("/metrics")
            .insert_header((AUTHORIZATION, format!("Bearer {}", &context.metrics_key)))
            .to_request();

        let app = test::init_service(
            App::new()
                .configure(move |cfg| create_app(cfg, Data::from(context)))
                .wrap_fn(metrics_middleware),
        )
        .await;

        // Unauthorized requests are forbidden.
        let unauthorized_req = test::TestRequest::get()
            .uri("/metrics")
            .insert_header((AUTHORIZATION, "Bearer not_the_key"))
            .to_request();

        let response = app.call(unauthorized_req).await;
        let error = response.unwrap_err();
        assert_eq!(error.error_response().status(), StatusCode::FORBIDDEN);

        //Requests with no authorization are forbidden
        let unauthorized_req = test::TestRequest::get().uri("/metrics").to_request();

        let response = app.call(unauthorized_req).await;
        let error = response.unwrap_err();
        assert_eq!(error.error_response().status(), StatusCode::FORBIDDEN);

        // Make authorized request.
        let response = app.call(req).await.unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = body_to_string(response.into_parts().1).await;

        // Database metrics
        assert!(body.contains(
            r#"database_request_duration_seconds_bucket{command="CreateHub",le="+Inf"}"#
        ));

        // Http metrics
        assert!(
            body.contains(r#"http_request_duration_seconds_bucket{handler="/metrics",le="0.005"}"#)
        );

        assert!(body.contains(r#"http_request_responses{handler="/metrics",response_code="403"}"#));
    }

    async fn create_hub(name: &str, context: &crate::context::Main) -> Hubid {
        let (tx, rx) = oneshot::channel();
        context
            .db_tx
            .send(CreateHub {
                name: name.to_string(),
                description: "test_description".to_string(),
                oidc_redirect_uri: "https://somehub/test_redirect".to_string(),
                client_uri: "/client".to_string(),
                resp: tx,
            })
            .await;
        rx.await.unwrap().unwrap()
    }

    async fn create_user(email: &str, context: &crate::context::Main) -> String {
        let (tx, rx) = oneshot::channel();
        context
            .db_tx
            .send(CreateUser {
                resp: tx,
                email: email.to_string(),
                telephone: "test_telephone".to_string(),
                registration_date: "today".to_string(),
                config: context.pep.clone(),
                is_admin: context.admins.contains(email),
            })
            .await;
        rx.await.unwrap().unwrap().external_id
    }

    async fn get_db_user(context: &crate::context::Main, mail: &str, phone: &str) -> User {
        let (tx, rx) = oneshot::channel();
        context
            .db_tx
            .send(GetUser {
                resp: tx,
                email: mail.to_string(),
                telephone: phone.to_string(),
            })
            .await;
        rx.await.unwrap().unwrap()
    }

    async fn create_test_hub(context: &crate::context::Main) -> Hubid {
        let (tx, rx) = oneshot::channel();
        context
            .db_tx
            .send(CreateHub {
                name: "".to_string(),
                description: "".to_string(),
                oidc_redirect_uri: "".to_string(),
                client_uri: "".to_string(),
                resp: tx,
            })
            .await;
        rx.await.unwrap().unwrap()
    }

    async fn create_test_context() -> Result<Arc<crate::context::Main>> {
        create_test_context_with(|f| f).await
    }

    async fn create_test_context_with(
        config: impl FnOnce(crate::config::File) -> crate::config::File,
    ) -> Result<Arc<crate::context::Main>> {
        let _ = env_logger::builder().is_test(true).try_init();
        // make sure logs are displayed, see
        //   https://docs.rs/env_logger/latest/env_logger/#capturing-logs-in-tests
        // well, at least in those tests using create_test_context()

        crate::context::Main::create(config(crate::config::File::for_testing())).await
    }

    async fn body_to_string(response: HttpResponse) -> String {
        let b: Vec<u8> = response.into_body().try_into_bytes().unwrap().to_vec();
        String::from_utf8(b).unwrap()
    }

    #[derive(Serialize, Deserialize, Debug)]
    pub struct FakeSignedSessionResultClaims {
        exp: u64,    // expiry
        iat: u64,    // issued at
        iss: String, // issuer
        sub: String, // subject

        #[serde(flatten)]
        result: SessionResult,
    }

    fn sign_fake_session_result(result: SessionResult) -> String {
        return jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::RS256),
            &FakeSignedSessionResultClaims {
                result,
                iat: jsonwebtoken::get_current_timestamp(),
                exp: jsonwebtoken::get_current_timestamp() + 100,
                iss: "irmaserver".to_string(),
                sub: "not checked for now".to_string(),
            },
            &jsonwebtoken::EncodingKey::from_rsa_pem(
                r#"-----BEGIN RSA PRIVATE KEY-----
MIIJKAIBAAKCAgEA5SJ3K2E7te+XETt7P6KI/m1iuHgP6BfojAfaqtzlmcfgLoDA
2CnBcF2gDzu6SHQltH99YFrz0rpCI9ve1KzWU0qi3kWE/krw2LKAxIJfuSSBlZ8O
xsQrY3cS6NdH26ZPkC54lDyDK7Jdkz+1fhog/SqVuHjHmsbQM37Bx7rwGtU8hfRX
mG2Xbjlf5j229I3iOZhjrZK7uxxj37lE0oiGXkaIbJJw6D4EBt4fudJOP4+VjFn9
c9ExPm4eRl/Zn/Za/166Atoqw4UXmow1w9BMYFAPI4VDLD4vMqPh+B9Yy95NlCm0
U7DPyI30ggm6r7jmxt7UWjLvzoWbquOoqURNY/ibGWs6MZHxfBYIxlBpHemdkzkC
vvOCHm6piBWPlVNeLDCI+DZJWw+gDNtPDBV3eWPAaZrxTglaq1lbhxxOOyMtH31Z
8hDCKQT0XYn4C6bKgyimXbAHKN0TM0hIy+UL9N+ei1Z6EVMw6Efi1fgjtM7GQwOY
zuSt1VJV/vHzVJIEKZihU5ZAK83cn/3lPxQAv8Hk5ShaTsnxtzK9fa96817KLgs5
ozGFCTC3kxj0p5QZuecEze3X2NPzbB8k9U5ANUcHUbhmOJny0dWcmLQTDUV4xiff
MiORT/kpBSandqnr5FmYjgVaFMD8qvrKQTWqmL8ccRpy26VYM7CYRcsoeJMCAwEA
AQKCAgBjc4Mfy/Mbs2LxMsz6wLQPIjEP+eSFiyL+7EXHlVr+VReDd5S7/ducxrY7
BmSDIA5helhTowZi9z7Py5W6302jFyj7qlbf/Gzu0QM8x41+kU7BPyktsmVWpY8K
iq4Asv2jidgCFwWjyKX+zE8c7YBWAc68I4gXMKWbRDAdXZDrRJQhW/1NBnwMdlCe
YTjwikifUPoqkx5yRw8+Qm6RpnoTny+FWEYzNv+Ob4h7ocEeq1ZwdXqhczGZdDgl
uWJ+oHG8l0PLCyA2fqTRCnwnglg0EWuQsj2GjXL02tawWAK1ccZgQX2oOXzmAl8W
tdxWer2HoZ2vjJ4zGCCJmohQ93lS0XxzJ413ATCBR7AsAbB8SXuh05nPn3PdNlcl
M5PeobsItIOzfTUholJHva9xFTejGoKYhb9/ro4qqXd7OsuqcQuPULfm59CSPPN1
eM6TPUS9Lw8WbH0hfqYa3seDd3qu1sTYKL0/XlV+b7Uf0WKmjcOO6h734MtEQC6S
uI3W3BQwKXvlLRBuf3wckrmt1dCrJpXNcUTS4zQryalym0z2JigMwyrensObM7hB
GTcXoTLDtu7I/t6+MtjAj5bdREyRj7bhAA7ws/fUMziJvNnLINTipfqSLm9slggK
wI0f0amIgajJNc7Wjvlrflz+YIZGoiRu6WbstfGMOtEpg5zdgQKCAQEA+FohIcV6
QuGarxLeTJkNQre9tL0EClG4CuBjNf4IaWC5alm+xB3hCqbiai3HFrH0r03emmp+
qpybhHsVtxz71i6Ke5BeOxgDigCCwyIuNBPGN3s5jBuiMe5hCRLmq5/f+HdJWtRW
6VIG9k3OdpRwLNwTKxxc8PWBsxhq9NO1+7+VmD9KW+SPTV6mm4c5yA2aBbW4FTEQ
+osqBi+hFPTgMZAeqKBqmlEzBQot+0JTIyoNsCbCFEpOhRR32pMI4ayL44Tz2+Ao
J9etmUSzMvyOZYrzTZ+PJTIKjgHfrtlAeGxQla7jN14AjnmDInSsxOEbbZ2hYsW/
Yy0dwmI3IV6FUwKCAQEA7DDWH6MdN4p4y6WDfPR4NEbZcEKRtRNg6DS2zIiFkJRs
61mfXquuOSxNXtvR6JScRiqSMuX/T8k818zl545GvLouHlU43fCvwgSU2svtxnLJ
CiZLgBda96VccLTDgtLLNVQj+OqxX1wtgmaxiQHdCCI/7Ba6p52/8JwKhjjHfe6S
2jtwWSr0BqWgefi2sBF8cjTGEjtSGHOeiUSp6zqiY8p7I1nfimllFbtNJS7H42bE
ps18vNrUg+zh2eQqS+QTjE979Rf/oDmveLduFQNhUprJdTuKUzeQUeu2pdc55zg5
nw5MM77Ja2Hlpz6vxwItkS+/WSlaGPJgT48JGnaXwQKCAQEAlBX6B48fFd48RAR2
NSpV8+Bn5+uFCzorCaE+xyUQkvUv2jBlRb+jPpzACRv+yJOYGSfPgjfaC5WSTe6u
xh8sM0xRGti8t3PcOF+RmRU6g6b+3HpHmDmp/yfrCGQS02djP16xiM1wfXOB30AJ
yj88nCMl8uDYsn1Rtx7qN849hz13z+59QkoJANNdeQOq+pTRsHHosAov25U7m7Cu
1jYlsKgE//uXVSjxySGGxXmI5UDgJJcXxs2AAG5yAQ0HkLk4OJRAbG0+xHMgenGy
gMaDihzOcwyfaEhsbrzDShkVDjlX28kKhyswHcRq4xK7KjIoDradUq4jLtnqEsxJ
n0YjLQKCAQAsIygwe1PfaDIQpFqBBFJeOosxrk76TqfCXO94I18KWKJODM56a4zA
RGYk/uEoHHVjq1rsxgxDBbEoBrND5VOUuxoZMwXQe8Tsddy3UnqZpiOpkOR1CGhI
dQ9kRHNwxCGTUqjyQDFrR5d9keFFYCLE/VmCrfCtmA4hUZep43xsLSQmQgtJrnwx
rcviXzcMigf+c5w8FffOd/S9ZCZ4vdlQ2qrOPWJHxFBOklTlSOuztCW1ohrYU/B4
wtCl3jyFOBbrFoNsltJ/R6hh361joeETBbf1/21nBbAjju/v59t7OQeTkKFu3g1X
0tCOw2knwGFxi0Gv0Ml0df7Hf0xNNLJBAoIBACYHWrtbT3LrAkGs4qHzVObSkE64
X9W0ZnbrpuWZnZJd4zW1j6Ui5umTFhDEaBMe4waTzk+birr3TTcV+j058EqY1BCU
f9y+czlx93EJ2RH1GlqYR6r5YC/4wx4iQiHlmi22rKDgxGO/DOpJkfnjOzRyzL9J
zEo3YYD3h08P4/yuOjlgO56bG9j8X3jLBoo4Ou8JOTs0dfMESs5M2znpGXYX/Lh8
3TsYF9gKCcoUeO81gKa5VDx8nNU60vsF5H1QCP4pFFnX2fgAq6sPuSNyK0UaSjIJ
OdC+rxjYNxRU4uNt8fgMfCdTL4wdxucOp0L8E5Enp+b96tpELIRhBkNEpQo=
-----END RSA PRIVATE KEY-----"#
                    .as_bytes(),
            )
            .unwrap(),
        )
        .unwrap();
    }
}
