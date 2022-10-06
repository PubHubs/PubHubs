use crate::irma::{
    disclosed_email_and_telephone, login, next_session, register, SessionDataWithImage,
};

use serde::{Deserialize, Serialize};
mod config;
mod context;
mod cookie;
mod data;
mod fs;
mod irma;
mod irma_proxy;
mod oauth;
mod policy;
mod pseudonyms;
mod serve;
mod translate;

use crate::data::Hub;
use crate::oauth::{get_authorize, post_authorize, token, user_info};
use crate::DataCommands::{AllHubs, CreateHub, CreateUser, GetHub, GetUser, GetUserById};
use data::DataCommands;
use expry::{key_str, value, BytecodeVec};
use uuid::Uuid;

use hairy::hairy_eval_html_custom;
use hyper::header::{HeaderValue, CONTENT_TYPE, LOCATION};
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Method, Request, Response, Server, StatusCode};
use log::{debug, error, info};
use std::convert::Infallible;
use std::fmt::{Debug, Formatter};
use std::fs::read_to_string;
use std::net::SocketAddr;
use std::sync::Arc;

use crate::cookie::{
    accepted_policy, add_cookie, log_out_cookie, user_id_from_verified_cookie, verify_cookie,
};
use crate::data::{HubHandle, Hubid};
use crate::irma_proxy::{irma_proxy, irma_proxy_stream};
use crate::policy::{full_policy, policy, policy_accept};
use crate::translate::{get_translations, TranslateFuncs};
use anyhow::{Context, Result};
use env_logger::Env;
use std::str::FromStr;
use tokio::sync::mpsc::Sender;
use tokio::sync::oneshot;

extern crate core;
extern crate serde_json;

#[derive(Deserialize, Serialize)]
struct HubForm {
    name: String,
    description: String,
    redirection_uri: String,
    passphrase: String,
}

impl Debug for HubForm {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("HubForm")
            .field("name", &self.name)
            .field("description", &self.description)
            .field("redirection_uri", &self.redirection_uri)
            .finish()
    }
}

#[derive(Debug, Deserialize, Serialize)]
struct HubFormUpdate {
    name: String,
    description: String,
}

async fn index(_translations: &mut TranslateFuncs) -> Response<Body> {
    //TODO make contents templated and read from a file with messages plus update with site from real latest pubhubs.net
    let contents = read_to_string("static/templates_hair/front.html")
        .expect("Something went wrong reading the file");

    Response::new(Body::from(contents))
}

async fn get_hubs<'a>(
    context: &crate::context::Main,
    request: &Request<Body>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
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

            let body = hairy_eval_html_custom(context.hair.to_ref(), data.to_ref(), translations)
                .expect("Expected to render a template");
            Response::new(Body::from(body))
        }
        error => internal_server_error(
            "Could not get hubs",
            &context.hair,
            &format!("Someone looked for all hubs and got this error {:?}", error,),
            request,
            translations,
        ),
    }
}

async fn add_hub(
    context: &crate::context::Main,
    mut request: Request<Body>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    let body = String::from_utf8(Vec::from(
        hyper::body::to_bytes(&mut request).await.unwrap().as_ref(),
    ))
    .unwrap();
    let hub: HubForm = match serde_urlencoded::from_str(&body) {
        Ok(hub_form) => hub_form,
        Err(decoding_error) => {
            return bad_request(
                decoding_error.to_string().as_str(),
                &context.hair,
                &format!(
                    "Someone tried to add a hub with parameters {:?} and got this error {:?}",
                    body, decoding_error,
                ),
                &request,
                translations,
            );
        }
    };

    let (resp_tx, resp_rx) = oneshot::channel();
    context
        .db_tx
        .send(CreateHub {
            name: (hub.name).to_string(),
            description: (hub.description).to_string(),
            redirection_uri: (hub.redirection_uri).to_string(),
            passphrase: (hub.passphrase).to_string(),
            resp: resp_tx,
        })
        .await
        .expect("To use our channel");

    match resp_rx.await {
        Ok(Ok(_)) => {
            let mut resp = Response::new(Body::empty());
            *resp.status_mut() = StatusCode::FOUND;
            let val =
                HeaderValue::from_str(&format!("{}/hubs", translations.get_prefix())).unwrap();
            resp.headers_mut().insert(LOCATION, val);
            resp
        }
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
    id: &str,
    context: &crate::context::Main,
    request: &Request<Body>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    let (tx, rx) = oneshot::channel();
    match Hubid::from_str(id) {
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
                            ).unwrap(); // TODO: replace this unwrap
                            Response::new(Body::from(body))
                        },
                        _ => render_hub(&context.hair, &context.pep, &hub, translations)
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
                        request,translations
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
            request,
            translations,
        ),
    }
}

async fn get_hubid(
    name: &str,
    context: &crate::context::Main,
    request: &Request<Body>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    let (tx, rx) = oneshot::channel();
    context
        .db_tx
        .send(DataCommands::GetHubid {
            resp: tx,
            name: name.to_owned(),
        })
        .await
        .expect("To use our channel");
    match rx.await {
        Ok(Ok(Some(hubid))) => Response::new(Body::from(hubid.to_string())),

        Ok(Ok(None)) => Response::builder()
            .status(StatusCode::NOT_FOUND)
            .body(Body::from(format!("there is no hub named {}", name)))
            .unwrap(),
        error => internal_server_error(
            "Could not get hubid",
            &context.hair,
            &format!(
                "Someone tried to get the id of a hub named {:} with but got this error {:?}",
                name, error,
            ),
            request,
            translations,
        ),
    }
}

fn render_hub(
    hair: &BytecodeVec,
    pep: &pseudonyms::PepContext,
    hub: &Hub,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    let id = hub.id.to_string();
    let decryption_id = hub.decryption_id.to_string();
    let key = pep
        .make_local_decryption_key(hub)
        .expect("To make a decryption key");
    let data = value!({
        "id": id,
        "decryption_id": decryption_id,
        "name": hub.name,
        "description": hub.description,
        "redirection_uri": hub.redirection_uri,
        "key": key,
        "content": "hub"
    })
    .to_vec(false);
    let body = hairy_eval_html_custom(hair.to_ref(), data.to_ref(), translations).unwrap();
    Response::new(Body::from(body))
}

async fn update_hub(
    id: &str,
    context: &crate::context::Main,
    mut request: Request<Body>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    let body = String::from_utf8(Vec::from(
        hyper::body::to_bytes(&mut request).await.unwrap().as_ref(),
    ))
    .unwrap();
    let (tx, rx) = oneshot::channel();
    match Hubid::from_str(id) {
        Ok(id) => {
            let hub_form = serde_urlencoded::from_str(&body);
            let hub_form: HubFormUpdate = match hub_form {
                Ok(hub_form) => hub_form,
                Err(decoding_error) => {
                    return bad_request(
                        decoding_error.to_string().as_str(),
                        &context.hair,
                        &format!(
                      "Someone tried to update a hub with parameters {:?} and got this error {:?}",
                      body, decoding_error,
                  ),
                        &request,
                        translations,
                    );
                }
            };
            context
                .db_tx
                .send(DataCommands::UpdateHub {
                    resp: tx,
                    id,
                    name: hub_form.name.clone(),
                    description: hub_form.description.clone(),
                })
                .await
                .expect("To use our channel");
            match rx.await  {
                Ok(Ok(hub)) => render_hub(&context.hair, &context.pep, &hub, translations),
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
    context: &crate::context::Main,
    request: Request<Body>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
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
            let body = hairy_eval_html_custom(context.hair.to_ref(), data.to_ref(), translations)
                .expect("Expected to render a template");
            Response::new(Body::from(body))
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

pub fn internal_server_error(
    message: &str,
    hair: &BytecodeVec,
    internal_message: &str,
    request: &Request<Body>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
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
    let body = hairy_eval_html_custom(hair.to_ref(), data.to_ref(), translations)
        .expect("Expected to render a template");
    let mut response = Response::new(Body::from(body));
    *response.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
    response
}

pub fn bad_request(
    message: &str,
    hair: &BytecodeVec,
    internal_message: &str,
    request: &Request<Body>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
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
    let body = hairy_eval_html_custom(hair.to_ref(), data.to_ref(), translations)
        .expect("Expected to render a template");
    let mut response = Response::new(Body::from(body));
    *response.status_mut() = StatusCode::BAD_REQUEST;
    response
}

async fn irma_start(
    irma_host: &str,
    irma_requestor: &str,
    irma_requestor_hmac_key: &[u8],
    pub_hubs_host: &str,
    hair: &BytecodeVec,
    request: Request<Body>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    match login(
        irma_host,
        irma_requestor,
        irma_requestor_hmac_key,
        pub_hubs_host,
    )
    .await
    {
        Ok(session) => irma_response(&session),
        Err(error) => internal_server_error(
            "We're having some trouble with IRMA",
            hair,
            &format!(
                "Someone tried to start an IRMA sessions and got this error {:?}",
                error,
            ),
            &request,
            translations,
        ),
    }
}

async fn irma_register(
    irma_host: &str,
    irma_requestor: &str,
    irma_requestor_hmac_key: &[u8],
    pub_hubs_host: &str,
    hair: &BytecodeVec,
    request: Request<Body>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    match register(
        irma_host,
        irma_requestor,
        irma_requestor_hmac_key,
        pub_hubs_host,
    )
    .await
    {
        Ok(session) => irma_response(&session),
        Err(error) => internal_server_error(
            "We're having some trouble with IRMA",
            hair,
            &format!(
                "Someone tried to start an IRMA sessions and got this error {:?}",
                error,
            ),
            &request,
            translations,
        ),
    }
}

fn irma_response(session: &SessionDataWithImage) -> Response<Body> {
    let body = serde_json::to_string(&session).expect("To be able to serialize the session");
    let mut resp = Response::new(Body::from(body));
    resp.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_str("application/json").unwrap(),
    );
    resp
}

#[derive(Deserialize)]
struct HubIdForm {
    hub_id: Option<Hubid>,
}

async fn irma_result(
    context: &crate::context::Main,
    token: &str,
    request: &Request<Body>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    match _irma_result(context, token, request).await {
        Ok(response) => response,
        Err(error) => internal_server_error(
            "We are having some trouble with your account",
            &context.hair,
            &format!(
                "Trying to use an irma result and got this error {:?}",
                error,
            ),
            request,
            translations,
        ),
    }
}

async fn _irma_result(
    context: &crate::context::Main,
    token: &str,
    request: &Request<Body>,
) -> Result<Response<Body>> {
    let hub: HubIdForm = serde_urlencoded::from_str(request.uri().query().unwrap_or(""))?;
    let (email, telephone) = disclosed_email_and_telephone(&context.irma.server_url, token).await?;

    let user = {
        let (user_tx, user_rx) = oneshot::channel();
        context
            .db_tx
            .send(GetUser {
                resp: user_tx,
                email: email.clone(),
                telephone: telephone.clone(),
            })
            .await
            .expect("To use our channel");

        let some_user_or_none = user_rx.await.expect("Expected to use our channel")?;

        if let Some(user) = some_user_or_none {
            user
        } else {
            // register the new user
            let (user_tx, user_rx) = oneshot::channel();

            context
                .db_tx
                .send(CreateUser {
                    resp: user_tx,
                    email: email.clone(),
                    telephone: telephone.clone(),
                    config: context.pep.clone(),
                    is_admin: context.admins.contains(&email),
                })
                .await
                .expect("To use our channel");
            user_rx.await.expect("To use our channel")?
        }
    };

    let body = match hub.hub_id {
        None => serde_json::to_string(&JsonResponseIRMAToAccount {
            account_id: user.id,
        })
        .unwrap(),
        Some(hub_id) => {
            let (tx, rx) = oneshot::channel();

            context
                .db_tx
                .send(GetHub {
                    resp: tx,
                    handle: HubHandle::Id(hub_id),
                })
                .await
                .expect("To use our channel");

            let hub = rx.await.expect("Expected to use our channel")?;

            serde_json::to_string(&JsonResponseIRMAToHub {
                pseudonym: context
                    .pep
                    .convert_to_local_pseudonym(&user.pseudonym, &hub)?,
            })
            .expect("Expected to serialize our response")
        }
    };

    let mut resp = Response::new(Body::from(body));
    resp.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_str("application/json").unwrap(),
    );
    Ok(add_cookie(resp, user.id, &context.cookie_secret))
}

async fn get_account(
    req: &Request<Body>,
    id: &str,
    cookie_secret: &str,
    hair: &BytecodeVec,
    db_tx: Sender<DataCommands>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    if verify_cookie(req, cookie_secret, id) {
        if let Ok(id) = u32::from_str(id) {
            let (user_tx, user_rx) = oneshot::channel();
            db_tx
                .send(GetUserById { resp: user_tx, id })
                .await
                .expect("To use our channel");
            match user_rx.await{
                Ok(Ok(user)) => {
                    let (hub_tx, hub_rx) = oneshot::channel();
                    db_tx.send(AllHubs { resp: hub_tx }).await.expect("Expected to find all hubs");
                    let hubs = hub_rx.await.expect("Expected to fetch all hubs").expect("Expected to fetch all hubs");
            let data = value!({
                "email": user.email,
                "telephone": user.telephone,
                "hubs": hubs,
                "content": "user"
                })
                .to_vec(false);
            let body = hairy_eval_html_custom(hair.to_ref(), data.to_ref(), translations).unwrap();
            Response::new(Body::from(body))}
                Ok(Err(error)) => internal_server_error(
                    "Could not locate user",
                    hair,
                    &format!(
                        "Someone tried to get an account page with a valid cookie with id: '{}' and got this error {:?}",
                        id, error,
                    ),
                    req,
                    translations
                ),
                Err(error) => internal_server_error(
                    "Could not locate user",
                    hair,
                    &format!(
                        "Someone tried to get an account page with a valid cookie with id: '{}' and got this error {:?}",
                        id, error,
                    ),
                    req,translations
                ),
            }
        } else {
            internal_server_error(
                "That's not an account id",
                hair,
                format!(
                    "Someone had a valid cookie for id '{}' but it's not an i32",
                    id
                )
                .as_str(),
                req,
                translations,
            )
        }
    } else {
        let mut resp = Response::new(Body::empty());
        resp.headers_mut().insert(
            LOCATION,
            HeaderValue::from_str(&format!("{}/login", translations.get_prefix())).unwrap(),
        );
        *resp.status_mut() = StatusCode::FOUND;
        resp
    }
}

async fn account_login(
    req: &Request<Body>,
    hair: &BytecodeVec,
    cookie_secret: &str,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    match user_id_from_verified_cookie(req, cookie_secret) {
        None => {
            let prefix = translations.get_prefix();
            let data = value!( {
                "hub": "",
                "url": "",
                "state": "",
                "hub_name": "",
                "content": "authenticate",
                "url_prefix": prefix
            })
            .to_vec(false);

            let body = hairy_eval_html_custom(hair.to_ref(), data.to_ref(), translations)
                .expect("To render a template");
            Response::new(Body::from(body))
        }
        Some(id) => {
            let mut resp = Response::new(Body::empty());
            resp.headers_mut().insert(
                LOCATION,
                HeaderValue::from_str(
                    format!("{}/account/{}", translations.get_prefix(), id).as_str(),
                )
                .unwrap(),
            );
            *resp.status_mut() = StatusCode::FOUND;
            resp
        }
    }
}

fn account_logout(translations: &TranslateFuncs) -> Response<Body> {
    let mut resp = Response::new(Body::empty());
    let logout_cookie = log_out_cookie();
    resp.headers_mut().insert(
        "Set-Cookie",
        HeaderValue::from_str(logout_cookie.as_str()).unwrap(),
    );

    resp.headers_mut().insert(
        LOCATION,
        HeaderValue::from_str(&format!("{}/login", translations.get_prefix())).unwrap(),
    );
    *resp.status_mut() = StatusCode::FOUND;
    resp
}

#[derive(Deserialize, Serialize)]
struct Register {
    hub: String,
    state: String,
    url: String,
}

async fn register_account(
    req: &Request<Body>,
    hair: &BytecodeVec,
    db_tx: &Sender<DataCommands>,
    translations: &mut TranslateFuncs,
) -> Response<Body> {
    if !accepted_policy(req) {
        let mut resp = Response::new(Body::empty());
        *resp.status_mut() = StatusCode::FOUND;
        let val = HeaderValue::from_str(
            format!(
                "{}/policy?{}",
                translations.get_prefix(),
                req.uri().query().unwrap_or("")
            )
            .as_str(),
        )
        .unwrap();
        resp.headers_mut().insert(LOCATION, val);
        return resp;
    }
    let prefix = translations.get_prefix();
    let mut data = value!( {
        "hub": "",
        "url": "",
        "state": "",
        "hub_name": "",
        "login": false,
        "content": "authenticate",
        "url_prefix": prefix
    })
    .to_vec(false);

    if let Some(query) = req.uri().query() {
        if let Ok(register) = serde_urlencoded::from_str::<Register>(query) {
            // TODO errors
            let (tx, rx) = oneshot::channel();
            let hub_name = if !register.hub.is_empty() {
                db_tx
                    .send(GetHub {
                        resp: tx,
                        handle: HubHandle::Id(register.hub.parse().unwrap()),
                    })
                    .await
                    .expect("Expected to send a command");
                rx.await.unwrap().expect("Expected a hub").name
            } else {
                "".to_string()
            };
            let prefix = translations.get_prefix();
            data = value!( {
                "hub": register.hub,
                "url": register.url,
                "state": register.state,
                 "hub_name": hub_name,
                "login": false,
                "content": "authenticate",
                "url_prefix": prefix
            })
            .to_vec(false);
        }
    }

    let body = hairy_eval_html_custom(hair.to_ref(), data.to_ref(), translations)
        .expect("To render a template");
    Response::new(Body::from(body))
}

#[derive(Serialize, Deserialize)]
struct JsonResponseIRMAToHub {
    pseudonym: String,
}

#[derive(Serialize, Deserialize)]
struct JsonResponseIRMAToAccount {
    account_id: i32,
}

async fn handle(
    req: Request<Body>,
    context: &crate::context::Main,
) -> Result<Response<Body>, Infallible> {
    debug!("{:?}", req);

    // check whether a static file was requested
    if let Some(resp) = context.static_assets.serve(&req) {
        return Ok(resp);
    }

    let uri = req.uri().path().to_string();

    let parts: Vec<&str> = uri.split('/').collect();

    let (parts, mut translations) = get_translations(&context.translations, parts);

    // NB: matching is likely O(n) where n is the number of cases;
    //     if the number of cases grows substantially, we should replace
    //     this match with some sort of look-up table.
    let resp = match (parts[1], req.method()) {
        ("", &Method::GET) => index(&mut translations).await,
        ("policy", &Method::GET) => {
            policy(&req, &context.hair, &context.db_tx, &mut translations).await
        }
        ("full_policy", &Method::GET) => {
            full_policy(&req, &context.hair, &context.db_tx, &mut translations).await
        }
        ("policy_accept", &Method::GET) => policy_accept(&req, &translations).await,
        ("admin", method) => match (parts[2], method, context.is_admin_request(&req).await) {
            ("hubs", method, true) => match (parts.get(3), method) {
                (None, &Method::GET) => get_hubs(context, &req, &mut translations).await,
                (Some(id), &Method::POST) => update_hub(id, context, req, &mut translations).await,
                (None, &Method::POST) => add_hub(context, req, &mut translations).await,
                (Some(id), &Method::GET) => {
                    get_hub_details(id, context, &req, &mut translations).await
                }
                (_, _) => not_found(),
            },
            ("users", &Method::GET, true) => get_users(context, req, &mut translations).await,
            ("hubid", method, true) => match (parts.get(3), method) {
                (Some(name), &Method::GET) => {
                    get_hubid(name, context, &req, &mut translations).await
                }
                (_, _) => not_found(),
            },
            _ => unauthorized(),
        },
        ("irma", _) => {
            if parts.contains(&"statusevents") {
                irma_proxy_stream(req, &context.irma.client_url).await
            } else {
                irma_proxy(req, &context.irma.client_url, &context.url).await
            }
        }
        ("irma-endpoint", &Method::GET) => match (parts.get(2), parts.get(3)) {
            (Some(&"start"), None) => {
                irma_start(
                    &context.irma.server_url,
                    &context.irma.requestor,
                    &context.irma.requestor_hmac_key,
                    &context.url,
                    &context.hair,
                    req,
                    &mut translations,
                )
                .await
            }
            (Some(&"register"), None) => {
                irma_register(
                    &context.irma.server_url,
                    &context.irma.requestor,
                    &context.irma.requestor_hmac_key,
                    &context.url,
                    &context.hair,
                    req,
                    &mut translations,
                )
                .await
            }
            (Some(token), Some(&"result")) => {
                irma_result(context, token, &req, &mut translations).await
            }
            (_, _) => not_found(),
        },
        ("irma-endpoint", &Method::POST) => next_session(req, &context.irma, &context.url).await,
        ("oauth2", method) => match (parts.get(2), method) {
            (Some(&"auth"), &Method::POST) => post_authorize(req, context.auth_tx.clone()).await,
            (Some(&"token"), &Method::POST) => token(req, context.auth_tx.clone()).await,
            (Some(&"auth"), &Method::GET) => {
                get_authorize(
                    &context.hair,
                    req.uri().query(),
                    context.auth_tx.clone(),
                    &context.db_tx,
                    &mut translations,
                )
                .await
            }
            (_, _) => not_found(),
        },
        ("register", &Method::GET) => {
            register_account(&req, &context.hair, &context.db_tx, &mut translations).await
        }
        ("account", method) => match (parts.get(2), method) {
            (Some(id), &Method::GET) => {
                get_account(
                    &req,
                    id,
                    &context.cookie_secret,
                    &context.hair,
                    context.db_tx.clone(),
                    &mut translations,
                )
                .await
            }
            (_, _) => not_found(),
        },
        ("login", &Method::GET) => {
            account_login(
                &req,
                &context.hair,
                &context.cookie_secret,
                &mut translations,
            )
            .await
        }
        ("logout", &Method::GET) => account_logout(&translations),
        ("userinfo", &Method::GET) => user_info(req, context.auth_tx.clone()).await,
        (_, _) => not_found(),
    };
    debug!("{:?}", resp);
    Ok(resp)
}

fn not_found() -> Response<Body> {
    let mut resp = Response::new(Body::empty());
    *resp.status_mut() = StatusCode::NOT_FOUND;
    *resp.body_mut() = hyper::Body::from("Not found!");
    resp
}

fn unauthorized() -> Response<Body> {
    let mut resp = Response::new(Body::empty());
    *resp.status_mut() = StatusCode::UNAUTHORIZED;
    *resp.body_mut() = hyper::Body::from("Unauthorized");
    resp
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::Builder::from_env(Env::default().default_filter_or("info")).init();
    info!("Starting PubHubs!");

    // Construct our SocketAddr to listen on...
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));

    // Create a reference to a new State with static lifetime
    let context: &'static crate::context::Main = Box::leak(Box::new(
        crate::context::Main::create(
            crate::config::File::from_env().context("failed to load configuration file")?,
        )
        .await
        .context("failed to initialize")?,
    ));

    // And a MakeService to handle each connection...
    let make_service = make_service_fn(move |_conn| {
        let service = service_fn(move |req| handle(req, context));

        async move { Ok::<_, Infallible>(service) }
    });

    // Then bind and serve...
    let server = Server::bind(&addr).serve(make_service);

    // And run forever?
    server.await?;

    Ok(())
}

#[allow(unused_must_use)]
#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::{Policy, User};
    use hyper::header::COOKIE;
    use hyper::{http, Uri};
    use std::collections::HashMap;

    use crate::irma::SessionType::Disclosing;
    use crate::irma::{
        Attribute, SessionData, SessionPointer, SessionResult, SessionType, Status, MAIL,
        MOBILE_NO, PUB_HUBS_MAIL, PUB_HUBS_PHONE,
    };
    use regex::Regex;

    #[tokio::test]
    async fn test_index() {
        let mut translations = TranslateFuncs::default();
        let mut response = index(&mut translations).await;
        assert_eq!(response.status(), StatusCode::OK);

        let body = body_to_string(&mut response).await;

        let re = Regex::new(r"Pubhubs gaat van start</h2>").unwrap();
        assert!(re.is_match(&body));
    }

    #[tokio::test]
    async fn test_hubs_ok() {
        let context = create_test_context().await.unwrap();
        let name = "test_name";
        create_hub(name, &context).await;

        let request = http::Request::new(Body::empty());
        let mut translations = TranslateFuncs::default();
        let mut response = get_hubs(&context, &request, &mut translations).await;
        assert_eq!(response.status(), StatusCode::OK);

        let body = body_to_string(&mut response).await;

        let re = Regex::new(format!("<td>{}</td>", name).as_str()).unwrap();
        assert!(re.is_match(&body))
    }

    #[tokio::test]
    async fn test_hubs_error() {
        let context = create_test_context().await.unwrap();
        let name = "test_name";
        create_hub(name, &context).await;

        // Close the database actor
        context.db_tx.send(DataCommands::Terminate {}).await;

        let request = http::Request::new(Body::empty());
        let mut response = get_hubs(&context, &request, &mut TranslateFuncs::default()).await;
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let body = body_to_string(&mut response).await;

        let re = Regex::new("<p>Could not get hubs</p>").unwrap();
        assert!(re.is_match(&body))
    }

    #[tokio::test]
    async fn create_hub_ok() {
        let context = create_test_context().await.unwrap();
        let hub = HubForm {
            name: "test_hub".to_string(),
            description: "test description".to_string(),
            redirection_uri: "/test_redirect".to_string(),
            passphrase: "test_passphrase".to_string(),
        };

        let request = http::Request::new(Body::from(serde_urlencoded::to_string(hub).unwrap()));
        let response = add_hub(&context, request, &mut TranslateFuncs::default()).await;
        assert_eq!(response.status(), StatusCode::FOUND);
        assert_eq!(response.headers().get(LOCATION).unwrap(), "/hubs");
    }

    #[tokio::test]
    async fn create_hub_error() {
        let context = create_test_context().await.unwrap();
        let hub = HubForm {
            name: "test_hub".to_string(),
            description: "test description".to_string(),
            redirection_uri: "/test_redirect".to_string(),
            passphrase: "test_passphrase".to_string(),
        };
        let form_string = serde_urlencoded::to_string(hub)
            .unwrap()
            .replace("&passphrase=test_passphrase", "");
        let request = http::Request::new(Body::from(form_string));
        let mut response = add_hub(&context, request, &mut TranslateFuncs::default()).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = body_to_string(&mut response).await;
        let re = Regex::new("<p>missing field `passphrase`</p>").unwrap();
        assert!(re.is_match(&body))
    }

    #[tokio::test]
    async fn test_hub_details() {
        let context = create_test_context().await.unwrap();
        let name = "test_name";
        let hubid = create_hub(name, &context).await;

        let request = http::Request::new(Body::empty());
        let mut response = get_hub_details(
            hubid.as_str(),
            &context,
            &request,
            &mut TranslateFuncs::default(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);

        let body = body_to_string(&mut response).await;

        assert!(body.contains(&format!("<p>Hub id: {}</p>", hubid.as_str())))
    }

    #[tokio::test]
    async fn test_hub_details_error() {
        let context = create_test_context().await.unwrap();
        let _name = "test_name";

        let request = http::Request::new(Body::empty());
        let mut response = get_hub_details(
            "notanid",
            &context,
            &request,
            &mut TranslateFuncs::default(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = body_to_string(&mut response).await;

        let re = Regex::new("<p>not an id</p>").unwrap();
        assert!(re.is_match(&body))
    }

    #[tokio::test]
    async fn test_update_hub_details() {
        let context = create_test_context().await.unwrap();
        let name = "test_name";
        let hubid = create_hub(name, &context).await;

        let hub = HubFormUpdate {
            name: "test_name_updated".to_string(),
            description: "test description".to_string(),
        };

        let request = http::Request::new(Body::from(serde_urlencoded::to_string(hub).unwrap()));
        let mut response = update_hub(
            hubid.as_str(),
            &context,
            request,
            &mut TranslateFuncs::default(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);

        let body = body_to_string(&mut response).await;
        let re = Regex::new(
            r#"<input type="text" name="name" id="name" value="test_name_updated" required>"#,
        )
        .unwrap();
        assert!(re.is_match(&body))
    }

    #[tokio::test]
    async fn test_update_hub_details_error() {
        let context = create_test_context().await.unwrap();
        let name = "test_name";
        let hubid = create_hub(name, &context).await;

        let hub = HubFormUpdate {
            name: "test_name_updated".to_string(),
            description: "test description".to_string(),
        };

        // Close the database actor
        context.db_tx.send(DataCommands::Terminate {}).await;

        let request = http::Request::new(Body::from(serde_urlencoded::to_string(hub).unwrap()));
        let mut response = update_hub(
            hubid.as_str(),
            &context,
            request,
            &mut TranslateFuncs::default(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let body = body_to_string(&mut response).await;
        let re = Regex::new("<p>Could not update hub</p>").unwrap();
        assert!(re.is_match(&body))
    }

    #[tokio::test]
    async fn test_users_ok() {
        let context = create_test_context().await.unwrap();
        let email = "test_email";
        let email2 = "different_test_email";
        create_user(email, &context).await;
        create_user(email2, &context).await;

        let request = http::Request::new(Body::empty());
        let mut response = get_users(&context, request, &mut TranslateFuncs::default()).await;
        assert_eq!(response.status(), StatusCode::OK);

        let body = body_to_string(&mut response).await;

        let re = Regex::new(format!("<td>{}</td>", email).as_str()).unwrap();
        assert!(re.is_match(&body));
        let re2 = Regex::new(format!("<td>{}</td>", email2).as_str()).unwrap();
        assert!(re2.is_match(&body))
    }

    #[tokio::test]
    async fn test_users_error() {
        let context = create_test_context().await.unwrap();

        // Close the database actor
        context.db_tx.send(DataCommands::Terminate {}).await;

        let request = http::Request::new(Body::empty());
        let mut response = get_users(&context, request, &mut TranslateFuncs::default()).await;
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let body = body_to_string(&mut response).await;
        let re = Regex::new(format!("<p>Could not list users</p>").as_str()).unwrap();
        assert!(re.is_match(&body));
    }

    async fn start_fake_server(port: u16) {
        let port_bound = Arc::new(tokio::sync::Notify::new());

        {
            let port_bound = port_bound.clone();

            tokio::spawn(async move {
                // We'll bind to 127.0.0.1:<port>
                let addr = SocketAddr::from(([127, 0, 0, 1], port));

                let make_service = make_service_fn(move |_conn| {
                    let service = service_fn(move |req| handle_test(req));

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

    const TEST_TELEPHONE: &'static str = "test_telephone";

    const TEST_EMAIL: &'static str = "testemail";

    const NEW_TEST_TELEPHONE: &'static str = "new_test_telephone";

    const NEW_TEST_EMAIL: &'static str = "new_testemail";

    async fn handle_test(req: Request<Body>) -> Result<Response<Body>, Infallible> {
        let endpoint = req.uri().path().to_string();
        let endpoint = endpoint.as_str();
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
            "/test1/session/token/result" => make_response(
                TEST_EMAIL,
                PUB_HUBS_MAIL,
                TEST_TELEPHONE,
                PUB_HUBS_PHONE,
                None,
            ),
            "/test2/session/token/result" => make_response(
                NEW_TEST_EMAIL,
                MAIL,
                NEW_TEST_TELEPHONE,
                MOBILE_NO,
                Some("new_disclose".to_string()),
            ),
            "/test2/session/new_disclose/result" => make_response(
                NEW_TEST_EMAIL,
                PUB_HUBS_MAIL,
                NEW_TEST_TELEPHONE,
                PUB_HUBS_PHONE,
                None,
            ),
            _ => panic!("Got a request I can't test"),
        }
    }

    fn make_response(
        mail: &str,
        mail_type: &str,
        phone: &str,
        phone_type: &str,
        next_session: Option<String>,
    ) -> Result<Response<Body>, Infallible> {
        let resp_data = &SessionResult {
            disclosed: Some(vec![vec![
                Attribute {
                    raw_value: mail.to_string(),
                    status: "".to_string(),
                    id: mail_type.to_string(),
                },
                Attribute {
                    raw_value: phone.to_string(),
                    status: "".to_string(),
                    id: phone_type.to_string(),
                },
            ]]),
            status: Status::DONE,
            session_type: SessionType::Disclosing,
            proof_status: None,
            next_session: next_session,
            error: None,
        };
        let resp_body = serde_json::to_string(&resp_data).unwrap();
        Ok(Response::new(Body::from(resp_body)))
    }

    fn add_cookie_request(mut req: Request<Body>, secret: &str, id: i32) -> Request<Body> {
        let resp = Response::new(Body::empty());
        let resp = add_cookie(resp, id, secret);
        req.headers_mut()
            .insert("Cookie", resp.headers().get("Set-Cookie").unwrap().clone());
        req
    }

    #[tokio::test]
    async fn test_irma_register() {
        let context = create_test_context().await.unwrap();
        let req = Request::new(Body::empty());
        start_fake_server(4001).await;

        let mut resp = irma_register(
            "http://localhost:4001/test1",
            "",
            &vec![],
            &context.url,
            &context.hair,
            req,
            &mut TranslateFuncs::default(),
        )
        .await;

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_to_string(&mut resp).await;
        let session = serde_json::from_str::<SessionDataWithImage>(&body);
        assert!(session.is_ok());
        assert_eq!(session.unwrap().session_ptr.irmaqr, Disclosing);
    }

    #[tokio::test]
    async fn test_register_account_redirects_if_policy_not_accepted() {
        let context = create_test_context().await.unwrap();
        let req = Request::new(Body::empty());
        let response = register_account(
            &req,
            &context.hair,
            &context.db_tx,
            &mut TranslateFuncs::default(),
        )
        .await;

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

    #[tokio::test]
    async fn test_register_account() {
        let context = create_test_context().await.unwrap();
        let mut req = Request::new(Body::empty());
        req.headers_mut()
            .insert(COOKIE, HeaderValue::from_str("AcceptedPolicy=1").unwrap());
        let mut response = register_account(
            &req,
            &context.hair,
            &context.db_tx,
            &mut TranslateFuncs::default(),
        )
        .await;

        let body = body_to_string(&mut response).await;

        assert!(body.contains("let hub = \"\""));
        assert!(body.contains("let state = \"\""));
        assert!(body.contains("let url = \"\""));
        assert!(body.contains("let endpoint = \"\" + \"/irma-endpoint/register\""));
        assert!(body.contains("irmaLogin(endpoint, hub, state, url);"));
        assert!(!body.contains("<button>Register</button>"));
    }

    #[tokio::test]
    async fn test_account_login() {
        let context = create_test_context().await.unwrap();
        let req = Request::new(Body::empty());
        let mut response = account_login(
            &req,
            &context.hair,
            &context.cookie_secret,
            &mut TranslateFuncs::default(),
        )
        .await;

        let body = body_to_string(&mut response).await;
        assert!(body.contains("let hub = \"\""));
        assert!(body.contains("let state = \"\""));
        assert!(body.contains("let url = \"\""));
        assert!(body.contains("let endpoint = \"\" + \"/irma-endpoint/start\";"));
        assert!(body.contains("irmaLogin(endpoint, hub, state, url);"));
        assert!(body.contains(r#"<button class="btn btn-secondary btn-rounded align-content-center text-white">Registreren</button>"#));

        let mut response = account_login(
            &req,
            &context.hair,
            &context.cookie_secret,
            &mut TranslateFuncs::new(HashMap::new(), "/en"),
        )
        .await;

        let body = body_to_string(&mut response).await;
        assert!(body.contains("let hub = \"\""));
        assert!(body.contains("let state = \"\""));
        assert!(body.contains("let url = \"\""));
        assert!(body.contains("let endpoint = \"/en\" + \"/irma-endpoint/start\";"));
        assert!(body.contains("irmaLogin(endpoint, hub, state, url);"));
        assert!(body.contains(r#"<button class="btn btn-secondary btn-rounded align-content-center text-white">Registreren</button>"#));
    }

    #[tokio::test]
    async fn test_get_account() {
        let context = create_test_context().await.unwrap();
        let email = "email@test.com";
        let user_id = create_user(email, &context).await;
        let req = Request::new(Body::empty());
        let secret = "very secret";
        let req = add_cookie_request(req, secret, user_id);
        let mut response = get_account(
            &req,
            &user_id.to_string(),
            secret,
            &context.hair,
            context.db_tx,
            &mut TranslateFuncs::default(),
        )
        .await;

        assert_eq!(response.status(), StatusCode::OK);
        let body = body_to_string(&mut response).await;
        assert!(body.contains(format!("<p>{}</p>", email).as_str()));
        assert!(body.contains(" <p>test_telephone</p>"));
    }

    #[tokio::test]
    async fn test_no_access_to_admin() {
        let context = create_test_context().await.unwrap();
        let email = "email@test.com";
        let user_id = create_user(email, &context).await;
        let mut req = Request::new(Body::empty());
        *req.uri_mut() = Uri::from_static("https://some.host/admin/hubs");
        let secret = "very secret";
        let req = add_cookie_request(req, secret, user_id);
        let mut response = handle(req, &context).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = body_to_string(&mut response).await;
        assert_eq!(body, "Unauthorized");
    }

    #[tokio::test]
    async fn test_get_account_only_authorized() {
        let context = create_test_context().await.unwrap();
        let user_id = create_user("email", &context).await.to_string();
        let mut req = Request::new(Body::empty());
        req.headers_mut()
            .insert("Cookie", HeaderValue::from_str("no").unwrap());
        let response = get_account(
            &req,
            &user_id,
            &context.cookie_secret,
            &context.hair,
            context.db_tx,
            &mut TranslateFuncs::default(),
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

    #[tokio::test]
    async fn test_irma_result() {
        let mut context = create_test_context().await.unwrap();
        let user_id = create_user("testemail", &context).await;
        let hubid = create_test_hub(&context).await;
        let token = "token";
        let cookie_secret = "very_secret";
        start_fake_server(4002).await;

        //existing user account login
        let req1 = Request::new(Body::empty());

        context.cookie_secret = cookie_secret.to_string();
        context.irma.client_url = "http://localhost:4002/test1".to_string();
        context.irma.server_url = "http://localhost:4002/test1".to_string();

        let mut response =
            irma_result(&context, token, &req1, &mut TranslateFuncs::default()).await;
        let body = body_to_string(&mut response).await;
        assert_eq!(StatusCode::OK, response.status(),);
        let deserialized: JsonResponseIRMAToAccount = serde_json::from_str(&body).unwrap();
        assert_eq!(deserialized.account_id, user_id);

        //existing user hub login
        let req2 = Request::builder()
            .uri(format!("http://fake.not_exists?hub_id={}", hubid.as_str()))
            .body(Body::empty())
            .unwrap();

        let mut response =
            irma_result(&context, token, &req2, &mut TranslateFuncs::default()).await;
        assert_eq!(response.status(), StatusCode::OK);
        let body = body_to_string(&mut response).await;
        serde_json::from_str::<JsonResponseIRMAToHub>(&body).unwrap();

        //register account
        let req3 = Request::new(Body::empty());
        // Discloses new an
        context.irma.client_url = "http://localhost:4002/test2".to_string();
        context.irma.server_url = "http://localhost:4002/test2".to_string();
        let mut response =
            irma_result(&context, token, &req3, &mut TranslateFuncs::default()).await;
        assert_eq!(response.status(), StatusCode::OK);
        let body = body_to_string(&mut response).await;
        let deserialized: JsonResponseIRMAToAccount = serde_json::from_str(&body).unwrap();
        let user = get_db_user(&context, NEW_TEST_EMAIL, NEW_TEST_TELEPHONE)
            .await
            .unwrap();
        assert_eq!(deserialized.account_id, user.id);

        //error
        let req_error = Request::new(Body::empty());

        context.irma.client_url = "http://no-irma".to_string();
        context.irma.server_url = "http://no-irma".to_string();

        let mut response =
            irma_result(&context, token, &req_error, &mut TranslateFuncs::default()).await;
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let body = body_to_string(&mut response).await;
        assert!(body.contains("We are having some trouble with your account"))
    }

    #[tokio::test]
    async fn test_irma_result_register_through_hub() {
        let mut context = create_test_context().await.unwrap();
        let user_id = create_user("testemail", &context).await;
        let hubid = create_test_hub(&context).await;
        let token = "token";
        let cookie_secret = "very_secret";
        start_fake_server(4003).await;
        //register hub
        let req4 = Request::builder()
            .uri(format!("http://fake.not_exists?hub_id={}", hubid.as_str()))
            .body(Body::empty())
            .unwrap();

        context.cookie_secret = cookie_secret.to_string();
        context.irma.client_url = "http://localhost:4003/test2".to_string();
        context.irma.server_url = "http://localhost:4003/test2".to_string();

        let mut response = irma_result(
            // Discloses new an
            &context,
            token,
            &req4,
            &mut TranslateFuncs::default(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        let body = body_to_string(&mut response).await;
        serde_json::from_str::<JsonResponseIRMAToHub>(&body).unwrap();
        let user = get_db_user(&context, NEW_TEST_EMAIL, NEW_TEST_TELEPHONE)
            .await
            .unwrap();
        assert_ne!(user_id, user.id);
    }

    #[tokio::test]
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

        let req = Request::new(Body::empty());
        let mut response = policy(
            &req,
            &context.hair,
            &context.db_tx,
            &mut TranslateFuncs::default(),
        )
        .await;

        let body = body_to_string(&mut response).await;
        for highlight in highlights {
            assert!(body.contains(&highlight));
        }
    }

    #[tokio::test]
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

        let req = Request::new(Body::empty());
        let mut response = policy(
            &req,
            &context.hair,
            &context.db_tx,
            &mut TranslateFuncs::default(),
        )
        .await;

        let body = body_to_string(&mut response).await;
        assert!(body.contains(&full_policy));
    }

    #[tokio::test]
    async fn test_policy_accept() {
        let query = "smt=a&smthelse=b";

        let mut req = Request::new(Body::empty());
        *req.uri_mut() = format!("/smth?{}", query).parse().unwrap();
        let response = policy_accept(&req, &TranslateFuncs::default()).await;
        assert_eq!(response.status(), StatusCode::FOUND);
        let location = response
            .headers()
            .get("Location")
            .unwrap()
            .to_str()
            .unwrap();
        assert!(location.ends_with(query))
    }

    async fn create_hub(name: &str, context: &crate::context::Main) -> Hubid {
        let (tx, rx) = oneshot::channel();
        context
            .db_tx
            .send(CreateHub {
                name: name.to_string(),
                description: "test_description".to_string(),
                redirection_uri: "/test_redirect".to_string(),
                passphrase: "test_passphrase".to_string(),
                resp: tx,
            })
            .await;
        rx.await.unwrap().unwrap()
    }

    async fn create_user(email: &str, context: &crate::context::Main) -> i32 {
        let (tx, rx) = oneshot::channel();
        context
            .db_tx
            .send(CreateUser {
                resp: tx,
                email: email.to_string(),
                telephone: "test_telephone".to_string(),
                config: context.pep.clone(),
                is_admin: context.admins.contains(email),
            })
            .await;
        rx.await.unwrap().unwrap().id
    }

    async fn get_db_user(context: &crate::context::Main, mail: &str, phone: &str) -> Option<User> {
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
                redirection_uri: "".to_string(),
                passphrase: "".to_string(),
                resp: tx,
            })
            .await;
        rx.await.unwrap().unwrap()
    }

    async fn create_test_context() -> Result<crate::context::Main> {
        let _ = env_logger::builder().is_test(true).try_init();
        // make sure logs are displayed, see
        //   https://docs.rs/env_logger/latest/env_logger/#capturing-logs-in-tests
        // well, at least in those tests using create_test_context()

        crate::context::Main::create(crate::config::File::from_path("test.yaml")?).await
    }

    async fn body_to_string(mut response: &mut Response<Body>) -> String {
        String::from_utf8(Vec::from(
            hyper::body::to_bytes(&mut response).await.unwrap().as_ref(),
        ))
        .unwrap()
    }
}
