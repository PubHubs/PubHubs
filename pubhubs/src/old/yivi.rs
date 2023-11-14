use crate::context::{Main, Yivi as YiviContext};
use crate::error::HttpContextExt as _;
use actix_web::web::Data;
use actix_web::{HttpRequest, HttpResponse};
use anyhow::{anyhow, bail, Context as _, Result};
use async_recursion::async_recursion;
use chrono::Utc;

use actix_web::http::header::CONTENT_TYPE;
use hyper::{body, Body, Client, Method, Request, StatusCode};
use log::error;
use qrcode::render::svg;
use qrcode::QrCode;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Formatter};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::oneshot;

use crate::data::DataCommands::{CreateUser, GetUser, GetUserById};
use crate::data::{no_result, User};
use tokio::time::sleep;

#[cfg(not(feature = "real_credentials"))]
pub const MAIL: &str = "irma-demo.sidn-pbdf.email.email";
#[cfg(not(feature = "real_credentials"))]
pub const MOBILE_NO: &str = "irma-demo.sidn-pbdf.mobilenumber.mobilenumber";

#[cfg(not(feature = "real_credentials"))]
pub const PUB_HUBS: &str = "irma-demo.PubHubs.account";
#[cfg(not(feature = "real_credentials"))]
pub const PUB_HUBS_ID: &str = "irma-demo.PubHubs.account.id";
#[cfg(not(feature = "real_credentials"))]
pub const PUB_HUBS_DATE: &str = "irma-demo.PubHubs.account.registration_date";
#[cfg(not(feature = "real_credentials"))]
pub const PUB_HUBS_SOURCE: &str = "irma-demo.PubHubs.account.registration_source";

#[cfg(feature = "real_credentials")]
pub const MAIL: &str = "pbdf.sidn-pbdf.email.email";
#[cfg(feature = "real_credentials")]
pub const MOBILE_NO: &str = "pbdf.sidn-pbdf.mobilenumber.mobilenumber";

#[cfg(feature = "real_credentials")]
pub const PUB_HUBS: &str = "pbdf.PubHubs.account";
#[cfg(feature = "real_credentials")]
pub const PUB_HUBS_ID: &str = "pbdf.PubHubs.account.id";
#[cfg(feature = "real_credentials")]
pub const PUB_HUBS_DATE: &str = "pbdf.PubHubs.account.registrationDate";
#[cfg(feature = "real_credentials")]
pub const PUB_HUBS_SOURCE: &str = "pbdf.PubHubs.account.registrationSource";

#[allow(dead_code)] //This is used in SessionRequest
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum Context {
    #[serde(rename = "https://irma.app/ld/request/disclosure/v2")]
    Disclosure,
    #[serde(rename = "https://irma.app/ld/request/signature/v2")]
    Signature,
    #[serde(rename = "https://irma.app/ld/request/issuance/v2")]
    Issuance,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PubhubsAttributes {
    id: String,
    // NOTE: someone made the mistake of using snake case for the demo credentials
    // and camel case for the real credentials
    #[cfg_attr(feature = "real_credentials", serde(rename = "registrationSource"))]
    registration_source: String,
    // email: String,
    // mobilenumber: String,
    #[cfg_attr(feature = "real_credentials", serde(rename = "registrationDate"))]
    registration_date: String,
}

#[cfg(test)]
#[test]
fn test_ph_attrs_serialization() {
    let result: String = serde_json::to_string(&PubhubsAttributes {
        id: "id".to_string(),
        registration_date: "date".to_string(),
        registration_source: "source".to_string(),
    })
    .unwrap();

    assert_eq!(
        result,
        if cfg!(feature = "real_credentials") {
            "{\"id\":\"id\",\"registrationSource\":\"source\",\"registrationDate\":\"date\"}"
        } else {
            "{\"id\":\"id\",\"registration_source\":\"source\",\"registration_date\":\"date\"}"
        }
    );
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PubHubsCredential {
    credential: String,
    validity: u64,
    attributes: PubhubsAttributes,
}

impl PubHubsCredential {
    fn new(id: &str, registration_source: &str, registration_date: &str) -> Self {
        //Can use leap year since it rounds down: https://irma.app/docs/session-requests/#issuance-requests
        let year = 60 * 60 * 24 * 366;
        let validity = SystemTime::now() + Duration::from_secs(year);

        PubHubsCredential {
            credential: PUB_HUBS.to_string(),
            validity: validity.duration_since(UNIX_EPOCH).unwrap().as_secs(),
            attributes: PubhubsAttributes {
                id: id.to_string(),
                registration_source: registration_source.to_string(),
                registration_date: registration_date.to_string(),
            },
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct NextSession {
    url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionRequest {
    #[serde(rename = "@context")]
    context: Context,
    disclose: Option<Vec<Vec<Vec<String>>>>,
    credentials: Option<Vec<PubHubsCredential>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtendedSessionRequest {
    pub request: SessionRequest,
    #[serde(rename = "nextSession")]
    pub next_session: Option<NextSession>,
}

// Contents (or 'claims') of a(n extended) signed session request JWT.
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    iat: u64,     // issued at
    iss: String,  // issuer, that is, requestor name
    sub: Subject, // subject, "verification_request",

    #[serde(flatten)]
    request: TaggedSessionRequest,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum TaggedSessionRequest {
    #[serde(rename = "sprequest")]
    Disclosure(ExtendedSessionRequest),
    #[serde(rename = "absrequest")]
    Signature(ExtendedSessionRequest),
    #[serde(rename = "iprequest")]
    Issuance(ExtendedSessionRequest),
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Subject {
    #[serde(rename = "verification_request")]
    Disclosure,
    #[serde(rename = "signature_request")]
    Signature,
    #[serde(rename = "issue_request")]
    Issuance,
}

/// Generate a QR code to disclose email and telephone fromPubHubs card. Returns the session
pub async fn login(
    yivi_host: &str,
    yivi_requestor: &str,
    yivi_requestor_hmac_key: &crate::jwt::HS256,
    pubhubs_url_for_yivi_app: &str,
) -> Result<SessionDataWithImage> {
    let to_disclose = vec![vec![vec![
        // While we only  use registration pseudonym (PUB_HUBS_ID)  we ask for
        // the registration source (PUB_HUBS_SOURCE) and date (PUB_HUBS_DATE) too just to make it
        // easier for the user to pick the correct card. (If we don't ask for registration source
        // and date, they are not shown to the user upon disclosure.)
        PUB_HUBS_SOURCE.to_string(),
        PUB_HUBS_DATE.to_string(),
        PUB_HUBS_ID.to_string(),
    ]]];
    let next_session = None;
    disclose(
        yivi_host,
        yivi_requestor,
        yivi_requestor_hmac_key,
        pubhubs_url_for_yivi_app,
        to_disclose,
        next_session,
    )
    .await
}

pub async fn register(
    yivi_host: &str,
    yivi_requestor: &str,
    yivi_requestor_hmac_key: &crate::jwt::HS256,
    pubhubs_url_for_yivi_app: &str,
) -> Result<SessionDataWithImage> {
    let to_disclose = vec![
        vec![vec![MAIL.to_string()]],
        vec![vec![MOBILE_NO.to_string()]],
    ];
    // Will immediately ask for issuing card after disclosing with a chained session.
    let next_session = Some(NextSession {
        url: pubhubs_url_for_yivi_app.to_string() + "yivi-endpoint/",
    });
    disclose(
        yivi_host,
        yivi_requestor,
        yivi_requestor_hmac_key,
        pubhubs_url_for_yivi_app,
        to_disclose,
        next_session,
    )
    .await
}

async fn disclose(
    yivi_host: &str,
    yivi_requestor: &str,
    yivi_requestor_hmac_key: &crate::jwt::HS256,
    pubhubs_url_for_yivi_app: &str,
    to_disclose: Vec<Vec<Vec<String>>>,
    next_session: Option<NextSession>,
) -> Result<SessionDataWithImage> {
    let client = Client::new();
    let body = crate::jwt::sign(
        &Claims {
            iss: yivi_requestor.to_string(),
            iat: jsonwebtoken::get_current_timestamp(),
            sub: Subject::Disclosure,
            request: TaggedSessionRequest::Disclosure(ExtendedSessionRequest {
                request: SessionRequest {
                    context: Context::Disclosure,
                    disclose: Some(to_disclose),
                    credentials: None,
                },
                next_session,
            }),
        },
        yivi_requestor_hmac_key,
    )
    .unwrap();

    let request = Request::builder()
        .method(Method::POST)
        .uri(yivi_host.to_owned() + "/session")
        .header("content-type", "text/plain")
        .body(Body::from(body))
        .expect("a request");

    let response = client.request(request).await?;
    let status = response.status();
    let body = body::to_bytes(response).await?;
    let slice = body.as_ref();

    if status != StatusCode::OK {
        let error: YiviErrorMessage = match serde_json::from_slice(slice) {
            Ok(msg) => msg,
            Err(e) => {
                error!("Could not deserialize a non-200 response {e}");
                YiviErrorMessage::default()
            }
        };
        error!("Did not receive OK from Yivi server on disclosure request, status '{status}', error '{:?}' ", error);
        bail!("Did not receive OK from Yivi server on disclosure request");
    }

    let mut session: SessionData = serde_json::from_slice(slice)?;

    let re = Regex::new(r#"https?://[^/]+/(irma/)?"#).unwrap();

    let new_url = if re.is_match(&session.session_ptr.u) {
        re.replace(
            &session.session_ptr.u,
            format!("{}yivi/", pubhubs_url_for_yivi_app),
        )
        .to_string()
    } else {
        format!(
            "{}yivi/{}",
            pubhubs_url_for_yivi_app, &session.session_ptr.u
        )
    };

    session.session_ptr = SessionPointer {
        u: new_url,
        irmaqr: session.session_ptr.irmaqr,
    };

    Ok(SessionDataWithImage::from(session))
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SessionType {
    Disclosing,
    Signing,
    Issuing,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SessionPointer {
    pub u: String,
    pub irmaqr: SessionType,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SessionData {
    #[serde(rename = "sessionPtr")]
    pub session_ptr: SessionPointer,
    pub token: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct YiviErrorMessage {
    error: String,
    description: String,
    message: String,
    // N.B.:  yivi.RemoteError also has the fields 'status' and 'stacktrace',
    //        see https://irma.app/docs/v0.2.0/api-irma-server/#api-reference
}

impl Default for YiviErrorMessage {
    fn default() -> Self {
        YiviErrorMessage {
            error: "internal PubHubs default".to_string(),
            description: "internal PubHubs default".to_string(),
            message: "internal PubHubs default".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct SessionDataWithImage {
    svg: String,
    #[serde(rename = "sessionPtr")]
    pub session_ptr: SessionPointer,
    /// The token for further interaction with the session
    token: String,
}

impl From<SessionData> for SessionDataWithImage {
    fn from(session: SessionData) -> Self {
        let code = QrCode::new(
            serde_json::to_string(&session.session_ptr)
                .expect("To be able to serialize the session"),
        )
        .expect("To turn the json into a QR code.");
        let image = code
            .render()
            .min_dimensions(300, 300)
            .dark_color(svg::Color("#000")) //black
            .light_color(svg::Color("#118DE8")) //white
            .build();

        Self {
            svg: image,
            session_ptr: session.session_ptr,
            token: session.token,
        }
    }
}

impl Debug for SessionDataWithImage {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SessionDataWithImage")
            .field("session_ptr", &self.session_ptr)
            .field("token", &self.token)
            .finish()
    }
}

#[async_recursion]
pub async fn disclosed_ph_id(yivi_host: &str, token: &str, context: &Main) -> Result<User> {
    let started = SystemTime::now();
    let mut attempt_nr: u32 = 0;
    loop {
        let client = Client::new();

        attempt_nr += 1;
        log::debug!("waiting for Yivi session with token {token} to finish");
        if started.elapsed()?.as_secs() > 5 * 60 {
            break;
        }

        let uri: String = yivi_host.to_owned() + &format!("/session/{token}/result");

        let request = Request::builder()
            .method(Method::GET)
            .uri(&uri)
            .header("content-type", "application/json")
            .body(Body::empty())
            .expect("a request");

        let resp = client
            .request(request)
            .await
            .with_context(|| format!("requesting {uri}"))?;
        let status = resp.status();
        let body = body::to_bytes(resp)
            .await
            .with_context(|| format!("retrieving body for {uri} (status: {status})"))?;

        // Start the session
        let slice = body.as_ref();

        if status != StatusCode::OK {
            let error: YiviErrorMessage = match serde_json::from_slice(slice) {
                Ok(msg) => msg,
                Err(e) => {
                    error!(
                        "Could not deserialize Yivi error from none-200 response, got error {e}"
                    );
                    YiviErrorMessage::default()
                }
            };
            error!("Did not receive OK from Yivi server on polling request for result, status '{status}', error '{:?}' ", error);
            bail!("Did not receive OK from Yivi server on disclosure request");
        }

        let result: SessionResult = serde_json::from_slice(slice)?;
        if let Some(err) = result.error {
            bail!(err);
        }

        match (&result.status, &result.session_type) {
            (Status::DONE, &SessionType::Disclosing) => match result.next_session {
                None => {
                    // The end of the registration process, we get the disclosed ph id.
                    let id = get_first_attribute_raw_value(PUB_HUBS_ID, &result)?;
                    return get_user_by_id(&id, context).await;
                }
                Some(new_token) => {
                    // There is a new sessions, this means mail & phone have been disclosed, now the
                    // ph account card will be issued and we we need to wait for the end of the chained
                    // session.
                    return disclosed_ph_id(yivi_host, &new_token, context).await;
                }
            },
            (Status::DONE, &SessionType::Issuing) => {
                // We issued the ph account card and will find the corresponding user that was created
                // before the user accepted the issued card based on the disclosed mail and mobile number.
                let email = get_first_attribute_raw_value(MAIL, &result)?;
                let telephone = get_first_attribute_raw_value(MOBILE_NO, &result)?;
                return get_user(&email, &telephone, context).await;
            }
            (Status::CANCELLED | Status::TIMEOUT, _) => {
                bail!("Session '{token}' ended");
            }
            _ => {
                // NOTE: we sleep only 2 seconds to prevent registration from feeling too slugish
                log::debug!(
                    "session '{token}' has status {:?}; retrying a bit later..",
                    result.status
                );
                sleep(Duration::from_secs(2_u64)).await;
                continue;
            }
        }
    }
    Err(anyhow!("Did not get Yivi result in {attempt_nr} tries")).http_context(
        StatusCode::INTERNAL_SERVER_ERROR,
        Some("We haven't heard back from the Yivi server.  Did you perhaps forget to add your PubHubs card to Yivi?  If so, please register again.".to_owned())
        // NOTE:  this error message is not always appropriate, but this code will be replaced by the authentication server in the future anyhow
    )
}

pub async fn next_session(req: HttpRequest, context: Data<Main>, jwt_text: String) -> HttpResponse {
    let pubhubs_url_for_yivi_app = &context.url.for_yivi_app.as_str();
    let yivi = &context.yivi;
    match next_session_priv(
        req,
        yivi,
        pubhubs_url_for_yivi_app,
        &jwt_text,
        context.as_ref(),
    )
    .await
    {
        Ok(a) => a,
        Err(_) => empty_result(),
    }
}

async fn next_session_priv(
    req: HttpRequest,
    yivi: &YiviContext,
    pubhubs_url_for_yivi_app: &str,
    jwt_text: &str,
    context: &Main,
) -> Result<HttpResponse> {
    if let Some(ct) = req.headers().get(CONTENT_TYPE) {
        let ct = ct.to_str().unwrap_or("<could not convert to string>");

        if !ct.starts_with("text/plain") {
            log::warn!(
                "Yivi server called back with Content-Type {} instead of 'text/plain' - has a jwt_privkey(_file) been configurad for the Yivi server?",
                ct
            );
            return Ok(HttpResponse::InternalServerError().finish());
        }
    }

    let jwt = jsonwebtoken::decode::<SignedSessionResultClaims>(jwt_text, &yivi.server_key, &{
        let mut val = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);

        val.set_issuer(&[yivi.server_issuer.clone()]);
        val.set_required_spec_claims(&["exp", "iat", "iss", "sub"]);
        val
    });

    if jwt.is_err() {
        log::warn!(
            "Failed to decode/verify JWT ({}) from Yivi server callback: {}",
            jwt_text,
            jwt.unwrap_err()
        );
        return Ok(HttpResponse::InternalServerError().finish());
    }

    let claims = jwt.unwrap().claims;
    let result = claims.result;

    if let Some(err) = result.error {
        return Err(anyhow!(err));
    }

    match (&result.status, &result.session_type) {
        (_, SessionType::Issuing) => {
            // Issued after done, reveals the correct info
            Ok(empty_result())
        }
        (_, SessionType::Disclosing) => {
            match get_first_attribute_raw_value(PUB_HUBS_ID, &result) {
                //the card exists and we can continue
                Ok(_id) => Ok(empty_result()),
                //no card; need to issue
                _ => {
                    let email = get_first_attribute_raw_value(MAIL, &result)?;
                    let telephone = get_first_attribute_raw_value(MOBILE_NO, &result)?;
                    let date = Utc::now().format("%Y-%m-%d").to_string();

                    let (id, date) = get_or_create_user(&email, &telephone, &date, context).await?;

                    // When not registering for main or stable, note this in the registration
                    // source.
                    let odd_source_mention: String = if !context
                        .url
                        .for_browser
                        .domain()
                        .is_some_and(|d| d.ends_with("ihub.ru.nl"))
                    {
                        format!("\nfor: {}", context.url.for_browser)
                    } else {
                        String::default()
                    };

                    let masked_email = mask_email(email);
                    let masked_telephone = mask_telephone(telephone);
                    let source = format!(
                        "via Yivi app: \n{masked_telephone}\n{masked_email}{odd_source_mention}"
                    );
                    let body = serde_json::to_string(&ExtendedSessionRequest {
                        request: SessionRequest {
                            context: Context::Issuance,
                            disclose: None,
                            credentials: Some(vec![PubHubsCredential::new(&id, &source, &date)]),
                        },
                        next_session: Some(NextSession {
                            url: pubhubs_url_for_yivi_app.to_owned() + "yivi-endpoint/",
                        }),
                    })
                    .unwrap();

                    let resp = HttpResponse::Ok()
                        .insert_header((CONTENT_TYPE, "application/json"))
                        .body(body);
                    Ok(resp)
                }
            }
        }
        _ => Ok(empty_result()),
    }
}

fn mask_email(email: String) -> String {
    if email.len() < 3 {
        return email;
    }

    let start = 1;
    // These ifs might seem strange, but demo cards can be any string
    let end = if email.chars().position(|x| x == '@').unwrap_or(0) > 2 {
        email.chars().position(|x| x == '@').unwrap() - 1
    } else {
        email.len() - 1
    };

    mask(email, start, end)
}

fn mask_telephone(telephone: String) -> String {
    // This size check might seem strange but demo cards have no phone number format restrictions.
    if telephone.len() < 11 {
        return telephone;
    }
    // real Yivi phone numbers have a structure like +31611****11
    let start = 6;
    let end = 10;
    mask(telephone, start, end)
}

fn mask(string: String, start: usize, end: usize) -> String {
    string
        .chars()
        .enumerate()
        .map(|(i, c)| if i >= start && i < end { '*' } else { c })
        .collect()
}

async fn get_or_create_user(
    email: &str,
    telephone: &str,
    date: &str,
    context: &Main,
) -> Result<(String, String)> {
    let user = get_user(email, telephone, context).await;

    match user {
        Ok(user) => Ok((user.external_id, user.registration_date)),
        Err(e) if no_result(&e) => {
            let (user_tx, user_rx) = oneshot::channel();
            context
                .db_tx
                .send(CreateUser {
                    resp: user_tx,
                    email: email.to_string(),
                    telephone: telephone.to_string(),
                    registration_date: date.to_string(),
                    config: context.pep.clone(),
                    is_admin: false,
                })
                .await?;
            let user = user_rx.await??;
            Ok((user.external_id, user.registration_date))
        }
        Err(e) => Err(e),
    }
}

async fn get_user(email: &str, telephone: &str, context: &Main) -> Result<User> {
    let (user_tx, user_rx) = oneshot::channel();
    context
        .db_tx
        .send(GetUser {
            resp: user_tx,
            email: email.to_string(),
            telephone: telephone.to_string(),
        })
        .await?;
    user_rx.await?
}

async fn get_user_by_id(id: &str, context: &Main) -> Result<User> {
    let (user_tx, user_rx) = oneshot::channel();
    context
        .db_tx
        .send(GetUserById {
            resp: user_tx,
            id: id.parse()?,
        })
        .await?;
    user_rx.await?
}

fn empty_result() -> HttpResponse {
    HttpResponse::NoContent().finish()
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
#[allow(non_camel_case_types)] // Follow Yivi naming
#[allow(clippy::upper_case_acronyms)]
pub enum Status {
    DONE,
    PAIRING,
    CONNECTED,
    CANCELLED,
    TIMEOUT,
    INITIALIZED,
}

#[derive(Serialize, Deserialize, Debug)]
#[allow(non_camel_case_types)] // Follow Yivi naming
#[allow(clippy::upper_case_acronyms)]
pub enum ProofStatus {
    VALID,
    INVALID,
    INVALID_TIMESTAMP,
    UNMATCHED_REQUEST,
    MISSING_ATTRIBUTES,
    EXPIRED,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Attribute {
    #[serde(rename = "rawvalue")]
    pub raw_value: String,
    pub status: String,
    pub id: String,
    // value: TranslatedString
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SignedSessionResultClaims {
    exp: u64,    // expiry
    iat: u64,    // issued at
    iss: String, // issuer
    sub: String, // subject

    #[serde(flatten)]
    result: SessionResult,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SessionResult {
    pub disclosed: Option<Vec<Vec<Attribute>>>,
    pub status: Status,
    #[serde(rename = "type")]
    pub session_type: SessionType,
    #[serde(rename = "proofStatus")]
    pub proof_status: Option<ProofStatus>,
    #[serde(rename = "nextSession")]
    pub next_session: Option<String>,
    pub error: Option<String>,
}

fn get_first_attribute_raw_value(attribute_name: &str, result: &SessionResult) -> Result<String> {
    match &result.disclosed {
        None => bail!("Nothing is disclosed and wanted to find attribute {attribute_name}"),
        Some(disclosed) => {
            let attribute: Option<&Attribute> = disclosed
                .iter()
                .flat_map(|x| x.iter())
                .filter(|x| x.id == attribute_name)
                .last();

            match attribute {
                Some(a) => Ok(a.raw_value.clone()),
                None => bail!("Attribute '{}' not disclosed", attribute_name),
            }
        }
    }
}

#[cfg(test)]
#[allow(unused_must_use)]
mod tests {
    use super::*;
    use crate::config::File;
    use actix_web::body::MessageBody;
    use actix_web::test::TestRequest;
    use hyper::service::{make_service_fn, service_fn};
    use hyper::{Response, Server};
    use std::convert::Infallible;
    use std::net::SocketAddr;
    use std::sync::Arc;

    #[actix_web::test]
    async fn can_start_session() {
        start_fake_server(3000, None).await;
        let test_pub_hubs_host = "test_host/";
        let resp = login(
            "http://localhost:3000/test1",
            "",
            &crate::jwt::HS256(vec![]),
            test_pub_hubs_host,
        )
        .await
        .unwrap();

        assert_eq!(resp.session_ptr.u, "test_host/yivi/test_token/session");
        assert_ne!(resp.token, "");
        assert_eq!(resp.session_ptr.irmaqr, SessionType::Disclosing);
        assert!(resp
            .svg
            .starts_with(r#"<?xml version="1.0" standalone="yes"?><svg "#));

        //errors
        let result = login(
            "http://localhost:3000/test1_1",
            "",
            &crate::jwt::HS256(vec![]),
            test_pub_hubs_host,
        )
        .await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(
            err.to_string(),
            "Did not receive OK from Yivi server on disclosure request"
        );
    }

    #[actix_web::test]
    async fn can_get_disclosed_values_of_existing_user() {
        let context = create_test_context_with(|f| f).await.unwrap();
        let (user_id, _) = get_or_create_user("email", "phone", "date", &context)
            .await
            .unwrap();
        start_fake_server(3001, Some(user_id)).await;
        let resp = disclosed_ph_id("http://localhost:3001/test2", "test_token", &context)
            .await
            .unwrap();
        let orig_id = resp.external_id;
        assert_eq!(*&orig_id.len(), 10);
        assert!(&orig_id.chars().all(|c| c.is_alphanumeric()));

        //Follow next session
        let resp = disclosed_ph_id("http://localhost:3001/test2", "test_token2", &context)
            .await
            .unwrap();
        assert_eq!(resp.external_id, orig_id);

        // sessions ended or bad results
        match (
            disclosed_ph_id("http://localhost:3001/test2", "test_token3", &context).await,
            disclosed_ph_id("http://localhost:3001/test2", "test_token4", &context).await,
            disclosed_ph_id("http://localhost:3001/test2", "test_token5", &context).await,
            disclosed_ph_id("http://localhost:3001/test2", "test_token6", &context).await,
        ) {
            (Err(e1), Err(e2), Err(e3), Err(e4)) => {
                assert_eq!(e1.to_string(), "Session 'test_token3' ended");
                assert_eq!(e2.to_string(), "Session 'test_token4' ended");
                assert_eq!(e3.to_string(), "test_error");
                assert_eq!(
                    e4.to_string(),
                    "Did not receive OK from Yivi server on disclosure request"
                );
            }
            (_1, _2, _3, _4) => {
                println!("1: {:?} 2 {:?} 3 {:?} 4 {:?}", _1, _2, _3, _4);
                assert!(false);
            }
        }
    }

    fn sign_fake_session_result(result: SessionResult) -> String {
        return jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::RS256),
            &SignedSessionResultClaims {
                result,
                iat: jsonwebtoken::get_current_timestamp(),
                exp: jsonwebtoken::get_current_timestamp() + 100,
                iss: "irmaserver".to_string(),
                sub: "not checked for now".to_string(),
            },
            &jsonwebtoken::EncodingKey::from_rsa_pem(
                r#"-----BEGIN RSA PRIVATE KEY-----
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
-----END RSA PRIVATE KEY-----"#
                    .as_bytes(),
            )
            .unwrap(),
        )
        .unwrap();
    }

    fn fake_yivi_context() -> crate::config::Yivi {
        crate::config::Yivi {
            server_issuer: "yiviserver/".to_string(),
            client_api_url: Some("some.host/".to_string()),
            requestor: "some.host/".to_string(),
            requestor_hmac_key: None,
            requestor_api_url: "some.host/".to_string(),
            server_key_file: Some(r#"../docker_yivi/jwt.priv"#.to_string()),
        }
    }

    fn fake_yivi_state() -> YiviContext {
        YiviContext {
            server_issuer: "irmaserver".to_string(),
            server_key: jsonwebtoken::DecodingKey::from_rsa_pem(
                r#"-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA5SJ3K2E7te+XETt7P6KI
/m1iuHgP6BfojAfaqtzlmcfgLoDA2CnBcF2gDzu6SHQltH99YFrz0rpCI9ve1KzW
U0qi3kWE/krw2LKAxIJfuSSBlZ8OxsQrY3cS6NdH26ZPkC54lDyDK7Jdkz+1fhog
/SqVuHjHmsbQM37Bx7rwGtU8hfRXmG2Xbjlf5j229I3iOZhjrZK7uxxj37lE0oiG
XkaIbJJw6D4EBt4fudJOP4+VjFn9c9ExPm4eRl/Zn/Za/166Atoqw4UXmow1w9BM
YFAPI4VDLD4vMqPh+B9Yy95NlCm0U7DPyI30ggm6r7jmxt7UWjLvzoWbquOoqURN
Y/ibGWs6MZHxfBYIxlBpHemdkzkCvvOCHm6piBWPlVNeLDCI+DZJWw+gDNtPDBV3
eWPAaZrxTglaq1lbhxxOOyMtH31Z8hDCKQT0XYn4C6bKgyimXbAHKN0TM0hIy+UL
9N+ei1Z6EVMw6Efi1fgjtM7GQwOYzuSt1VJV/vHzVJIEKZihU5ZAK83cn/3lPxQA
v8Hk5ShaTsnxtzK9fa96817KLgs5ozGFCTC3kxj0p5QZuecEze3X2NPzbB8k9U5A
NUcHUbhmOJny0dWcmLQTDUV4xiffMiORT/kpBSandqnr5FmYjgVaFMD8qvrKQTWq
mL8ccRpy26VYM7CYRcsoeJMCAwEAAQ==
-----END PUBLIC KEY-----"#
                    .as_bytes(),
            )
            .unwrap(),
            client_api_url: "".to_string(),
            requestor: "".to_string(),
            requestor_hmac_key: crate::jwt::HS256(vec![]),
            requestor_api_url: "".to_string(),
        }
    }

    #[actix_web::test]
    async fn done_after_issue() {
        let body = sign_fake_session_result(SessionResult {
            disclosed: None,
            status: Status::DONE,
            session_type: SessionType::Issuing,
            proof_status: None,
            next_session: None,
            error: None,
        });
        let req = TestRequest::default().to_http_request();
        let context = create_test_context_with(|f| f).await.unwrap();
        let resp = next_session_priv(req, &fake_yivi_state(), "test_host", &body, &context)
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NO_CONTENT);
    }

    #[actix_web::test]
    async fn can_extend_session_after_disclose_mail_and_phone() {
        let body = sign_fake_session_result(SessionResult {
            disclosed: Some(vec![vec![
                Attribute {
                    raw_value: "mail".to_string(),
                    status: "".to_string(),
                    id: MAIL.to_string(),
                },
                Attribute {
                    raw_value: "phone".to_string(),
                    status: "".to_string(),
                    id: MOBILE_NO.to_string(),
                },
            ]]),
            status: Status::CONNECTED,
            session_type: SessionType::Disclosing,
            proof_status: None,
            next_session: None,
            error: None,
        });
        let req = TestRequest::default().to_http_request();
        let context = create_test_context_with(|f| f).await.unwrap();
        let resp = next_session_priv(req, &fake_yivi_state(), "test_host/", &body, &context)
            .await
            .unwrap();

        let resp_body =
            String::from_utf8(resp.into_body().try_into_bytes().unwrap().to_vec()).unwrap();
        let slice = resp_body.as_ref();
        let session_request: ExtendedSessionRequest = serde_json::from_slice(slice).unwrap();
        assert_eq!(
            session_request.next_session.as_ref().unwrap(),
            &NextSession {
                url: "test_host/yivi-endpoint/".to_string()
            }
        );
        assert_eq!(session_request.request.context, Context::Issuance);
        assert_eq!(session_request.request.disclose, None);
        let credentials = session_request.request.credentials.unwrap();
        assert_eq!(credentials.len(), 1);
        let credential = credentials.first().unwrap();
        assert_eq!(credential.credential, PUB_HUBS);
        assert_eq!(*(&credential.attributes.id.len()), 10);
        assert!(&credential
            .attributes
            .id
            .chars()
            .all(|c| c.is_alphanumeric()));
    }

    #[actix_web::test]
    async fn cannot_extend_session_after_disclose_mail_and_phone_from_pubhubs() {
        let body = sign_fake_session_result(SessionResult {
            disclosed: Some(vec![vec![Attribute {
                raw_value: "mail".to_string(),
                status: "".to_string(),
                id: PUB_HUBS_ID.to_string(),
            }]]),
            status: Status::CONNECTED,
            session_type: SessionType::Disclosing,
            proof_status: None,
            next_session: None,
            error: None,
        });
        let req = TestRequest::default().to_http_request();
        let context = create_test_context_with(|f| f).await.unwrap();
        let resp = next_session_priv(req, &fake_yivi_state(), "test_host", &body, &context)
            .await
            .unwrap();

        let resp_body =
            String::from_utf8(resp.into_body().try_into_bytes().unwrap().to_vec()).unwrap();
        assert!(resp_body.is_empty());
    }

    #[actix_web::test]
    async fn extend_session_will_return_empty_responses() {
        for status in [
            Status::CONNECTED,
            Status::TIMEOUT,
            Status::DONE,
            Status::CANCELLED,
            Status::INITIALIZED,
            Status::PAIRING,
        ] {
            for session_type in [
                SessionType::Disclosing,
                SessionType::Issuing,
                SessionType::Signing,
            ] {
                if status == Status::CONNECTED
                    && (session_type == SessionType::Issuing
                        || session_type == SessionType::Disclosing)
                {
                    continue;
                }
                let body = sign_fake_session_result(SessionResult {
                    disclosed: None,
                    status: status.clone(),
                    session_type,
                    proof_status: None,
                    next_session: None,
                    error: None,
                });
                let req = TestRequest::default().to_http_request();

                let context = create_test_context_with(|mut f| {
                    f.url = Some(url::Url::parse("https://test.host/").unwrap());
                    f.yivi = fake_yivi_context();
                    f
                })
                .await
                .unwrap();

                let resp = next_session(req, Data::from(context), body).await;

                let resp_body =
                    String::from_utf8(resp.into_body().try_into_bytes().unwrap().to_vec()).unwrap();
                assert!(resp_body.is_empty());
            }
        }
    }

    #[test]
    fn test_phone_and_email_masking() {
        let mails = vec![
            ("a", "a"),
            ("aaaaaaaaaaaaaaa", "a*************a"),
            ("@", "@"),
            ("abc@dddd.dd", "a*c@dddd.dd"),
            ("😀😀😀😀@😀😀.😀😀", "😀**😀@😀😀.😀😀"),
        ];
        for (inp, res) in mails {
            assert_eq!(mask_email(inp.to_string()), res)
        }

        let phones = vec![
            ("a", "a"),
            ("1234567890", "1234567890"),
            ("123456789012", "123456****12"),
            ("😀😁😀😁😀😁😀😁😀😁😀😁", "😀😁😀😁😀😁****😀😁"),
            ("+31612345678", "+31612****78"),
        ];
        for (inp, res) in phones {
            assert_eq!(mask_telephone(inp.to_string()), res)
        }
    }

    async fn handle(
        req: Request<Body>,
        user_id: Option<String>,
    ) -> Result<Response<Body>, Infallible> {
        let endpoint = req.uri().path().to_string();
        let endpoint = endpoint.as_str();

        match endpoint {
            "/test1/session" => {
                let jwt = jsonwebtoken::decode::<Claims>(
                    std::str::from_utf8(body::to_bytes(req).await.unwrap().as_ref()).unwrap(),
                    &jsonwebtoken::DecodingKey::from_secret("".as_ref()),
                    &{
                        let mut val = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
                        // don't require 'exp' to be present
                        val.required_spec_claims.clear();
                        val
                    },
                )
                .unwrap();
                let session_request = match jwt.claims.request {
                    TaggedSessionRequest::Disclosure(xsr) => xsr,
                    _ => panic!(),
                };

                assert_eq!(session_request.next_session, None);
                assert_eq!(
                    session_request.request.disclose.unwrap(),
                    vec![vec![vec![
                        PUB_HUBS_SOURCE.to_string(),
                        PUB_HUBS_DATE.to_string(),
                        PUB_HUBS_ID.to_string(),
                    ],]]
                );
                assert_eq!(session_request.request.context, Context::Disclosure);

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
            "/test1_1/session" => {
                let mut resp = Response::new(Body::empty());
                *resp.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
                Ok(resp)
            }
            "/test2/session/test_token/result" => {
                let body = body::to_bytes(req).await.unwrap();
                assert!(body.is_empty());

                let resp_data = &SessionResult {
                    disclosed: Some(vec![vec![Attribute {
                        raw_value: user_id.unwrap_or("1".to_string()),
                        status: "".to_string(),
                        id: PUB_HUBS_ID.to_string(),
                    }]]),
                    status: Status::DONE,
                    session_type: SessionType::Disclosing,
                    proof_status: None,
                    next_session: None,
                    error: None,
                };
                let resp_body = serde_json::to_string(&resp_data).unwrap();
                Ok(Response::new(Body::from(resp_body)))
            }
            "/test2/session/test_token2/result" => {
                let body = body::to_bytes(req).await.unwrap();
                assert!(body.is_empty());

                let resp_data = &SessionResult {
                    disclosed: None,
                    status: Status::DONE,
                    session_type: SessionType::Disclosing,
                    proof_status: None,
                    next_session: Some("test_token".to_string()),
                    error: None,
                };
                let resp_body = serde_json::to_string(&resp_data).unwrap();
                Ok(Response::new(Body::from(resp_body)))
            }
            "/test2/session/test_token3/result" => {
                let body = body::to_bytes(req).await.unwrap();
                assert!(body.is_empty());

                let resp_data = &SessionResult {
                    disclosed: None,
                    status: Status::CANCELLED,
                    session_type: SessionType::Disclosing,
                    proof_status: None,
                    next_session: Some("test_token".to_string()),
                    error: None,
                };
                let resp_body = serde_json::to_string(&resp_data).unwrap();
                Ok(Response::new(Body::from(resp_body)))
            }
            "/test2/session/test_token4/result" => {
                let body = body::to_bytes(req).await.unwrap();
                assert!(body.is_empty());

                let resp_data = &SessionResult {
                    disclosed: None,
                    status: Status::TIMEOUT,
                    session_type: SessionType::Disclosing,
                    proof_status: None,
                    next_session: Some("test_token".to_string()),
                    error: None,
                };
                let resp_body = serde_json::to_string(&resp_data).unwrap();
                Ok(Response::new(Body::from(resp_body)))
            }
            "/test2/session/test_token5/result" => {
                let body = body::to_bytes(req).await.unwrap();
                assert!(body.is_empty());

                let resp_data = &SessionResult {
                    disclosed: None,
                    status: Status::TIMEOUT,
                    session_type: SessionType::Disclosing,
                    proof_status: None,
                    next_session: Some("test_token".to_string()),
                    error: Some("test_error".to_string()),
                };
                let resp_body = serde_json::to_string(&resp_data).unwrap();
                Ok(Response::new(Body::from(resp_body)))
            }
            "/test2/session/test_token6/result" => {
                let mut resp = Response::new(Body::empty());
                *resp.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
                Ok(resp)
            }
            _ => panic!("Got a request I can't test"),
        }
    }

    async fn start_fake_server(port: u16, user_id: Option<String>) {
        let port_bound = Arc::new(tokio::sync::Notify::new());

        {
            let port_bound = port_bound.clone();

            tokio::spawn(async move {
                // We'll bind to 127.0.0.1:<port>
                let addr = SocketAddr::from(([127, 0, 0, 1], port));

                let make_service = make_service_fn(move |_conn| {
                    let user_id = user_id.clone();
                    let service = service_fn(move |req| handle(req, user_id.clone()));

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

    async fn create_test_context_with(config: impl FnOnce(File) -> File) -> Result<Arc<Main>> {
        Main::create(config(File::for_testing())).await
    }
}
