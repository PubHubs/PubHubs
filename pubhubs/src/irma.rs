use crate::context::Irma as IrmaContext;
use anyhow::{anyhow, bail, Result};
use async_recursion::async_recursion;
use chrono::Utc;
use hyper::{
    body,
    header::{HeaderValue, CONTENT_TYPE},
    Body, Client, Method, Request, Response, StatusCode,
};
use log::error;
use qrcode::render::svg;
use qrcode::QrCode;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Formatter};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::sleep;

#[cfg(not(feature = "real_credentials"))]
pub const MAIL: &str = "irma-demo.sidn-pbdf.email.email";
#[cfg(not(feature = "real_credentials"))]
pub const MOBILE_NO: &str = "irma-demo.sidn-pbdf.mobilenumber.mobilenumber";
#[cfg(not(feature = "real_credentials"))]
pub const PUB_HUBS: &str = "irma-demo.PubHubs.pubhubsaccount";
#[cfg(not(feature = "real_credentials"))]
pub const PUB_HUBS_MAIL: &str = "irma-demo.PubHubs.pubhubsaccount.email";
#[cfg(not(feature = "real_credentials"))]
pub const PUB_HUBS_PHONE: &str = "irma-demo.PubHubs.pubhubsaccount.mobilenumber";

#[cfg(feature = "real_credentials")]
pub const MAIL: &str = "pbdf.sidn-pbdf.email.email";
#[cfg(feature = "real_credentials")]
pub const MOBILE_NO: &str = "pbdf.sidn-pbdf.mobilenumber.mobilenumber";
#[cfg(feature = "real_credentials")]
pub const PUB_HUBS: &str = "pbdf.PubHubs.pubhubsaccount";
#[cfg(feature = "real_credentials")]
pub const PUB_HUBS_MAIL: &str = "pbdf.PubHubs.pubhubsaccount.email";
#[cfg(feature = "real_credentials")]
pub const PUB_HUBS_PHONE: &str = "pbdf.PubHubs.pubhubsaccount.mobilenumber";

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
    email: String,
    mobilenumber: String,
    registrationdate: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PubHubsCredential {
    credential: String,
    validity: u64,
    attributes: PubhubsAttributes,
}

impl PubHubsCredential {
    fn new(mail: &str, phone: &str, registration_date: &str) -> Self {
        //Can use leap year since it rounds down: https://irma.app/docs/session-requests/#issuance-requests
        let year = 60 * 60 * 24 * 366;
        let validity = SystemTime::now() + Duration::from_secs(year);

        PubHubsCredential {
            credential: PUB_HUBS.to_string(),
            validity: validity.duration_since(UNIX_EPOCH).unwrap().as_secs(),
            attributes: PubhubsAttributes {
                email: mail.to_string(),
                mobilenumber: phone.to_string(),
                registrationdate: registration_date.to_string(),
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
    irma_host: &str,
    irma_requestor: &str,
    irma_requestor_hmac_key: &[u8],
    pub_hubs_host: &str,
) -> Result<SessionDataWithImage> {
    let to_disclose = vec![vec![vec![
        PUB_HUBS_MAIL.to_string(),
        PUB_HUBS_PHONE.to_string(),
    ]]];
    let next_session = None;
    disclose(
        irma_host,
        irma_requestor,
        irma_requestor_hmac_key,
        pub_hubs_host,
        to_disclose,
        next_session,
    )
    .await
}

pub async fn register(
    irma_host: &str,
    irma_requestor: &str,
    irma_requestor_hmac_key: &[u8],
    pub_hubs_host: &str,
) -> Result<SessionDataWithImage> {
    let to_disclose = vec![
        vec![vec![MAIL.to_string()]],
        vec![vec![MOBILE_NO.to_string()]],
    ];
    // Will immediately ask for issuing card after disclosing with a chained session.
    let next_session = Some(NextSession {
        url: pub_hubs_host.to_string() + "irma-endpoint",
    });
    disclose(
        irma_host,
        irma_requestor,
        irma_requestor_hmac_key,
        pub_hubs_host,
        to_disclose,
        next_session,
    )
    .await
}

async fn disclose(
    irma_host: &str,
    irma_requestor: &str,
    irma_requestor_hmac_key: &[u8],
    pub_hubs_host: &str,
    to_disclose: Vec<Vec<Vec<String>>>,
    next_session: Option<NextSession>,
) -> Result<SessionDataWithImage> {
    let client = Client::new();
    let body = jsonwebtoken::encode(
        &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
        &Claims {
            iss: irma_requestor.to_string(),
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
        &jsonwebtoken::EncodingKey::from_secret(irma_requestor_hmac_key),
    )
    .unwrap();

    let request = Request::builder()
        .method(Method::POST)
        .uri(irma_host.to_owned() + "/session")
        .header("content-type", "text/plain")
        .body(Body::from(body))
        .expect("a request");

    let response = client.request(request).await?;
    let status = response.status();
    let body = body::to_bytes(response).await?;
    let slice = body.as_ref();

    if status != StatusCode::OK {
        let error: IrmaErrorMessage = match serde_json::from_slice(slice) {
            Ok(msg) => msg,
            Err(e) => {
                error!("Could not deserialize a non-200 response {e}");
                IrmaErrorMessage::default()
            }
        };
        error!("Did not receive OK from IRMA server on disclosure request, status '{status}', error '{:?}' ", error);
        bail!("Did not receive OK from IRMA server on disclosure request");
    }

    let mut session: SessionData = serde_json::from_slice(slice)?;

    let re = Regex::new(r#"https?://[^/]+/(irma/)?"#).unwrap();

    let new_url = if re.is_match(&session.session_ptr.u) {
        re.replace(&session.session_ptr.u, format!("{}irma/", pub_hubs_host))
            .to_string()
    } else {
        format!("{}irma/{}", pub_hubs_host, &session.session_ptr.u)
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
pub struct IrmaErrorMessage {
    error: String,
    description: String,
    message: String,
    // N.B.:  irma.RemoteError also has the fields 'status' and 'stacktrace',
    //        see https://irma.app/docs/v0.2.0/api-irma-server/#api-reference
}

impl Default for IrmaErrorMessage {
    fn default() -> Self {
        IrmaErrorMessage {
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
            //TODO maybe no dimensions but relative? Check it tomorrow
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
pub async fn disclosed_email_and_telephone(
    irma_host: &str,
    token: &str,
) -> Result<(String, String)> {
    let client = Client::new();
    for _i in 0..5 {
        let request = Request::builder()
            .method(Method::GET)
            .uri(irma_host.to_owned() + format!("/session/{token}/result").as_str())
            .header("content-type", "application/json")
            .body(Body::empty())
            .expect("a request");

        let resp = client.request(request).await?;
        let status = resp.status();
        let body = body::to_bytes(resp).await?;

        // Start the session
        let slice = body.as_ref();

        if status != StatusCode::OK {
            let error: IrmaErrorMessage = match serde_json::from_slice(slice) {
                Ok(msg) => msg,
                Err(e) => {
                    error!(
                        "Could not deserialize irma error from none-200 response, got error {e}"
                    );
                    IrmaErrorMessage::default()
                }
            };
            error!("Did not receive OK from IRMA server on polling request for result, status '{status}', error '{:?}' ", error);
            bail!("Did not receive OK from IRMA server on disclosure request");
        }

        let result: SessionResult = serde_json::from_slice(slice)?;
        if let Some(err) = result.error {
            bail!(err);
        }

        match (&result.status, &result.session_type) {
            (Status::DONE, &SessionType::Disclosing) => match result.next_session {
                None => {
                    let email = get_first_attribute_raw_value(PUB_HUBS_MAIL, &result)?;
                    let telephone = get_first_attribute_raw_value(PUB_HUBS_PHONE, &result)?;
                    return Ok((email, telephone));
                }
                Some(new_token) => {
                    return disclosed_email_and_telephone(irma_host, &new_token).await
                }
            },
            (Status::DONE, &SessionType::Issuing) => {
                let email = get_first_attribute_raw_value(MAIL, &result)?;
                let telephone = get_first_attribute_raw_value(MOBILE_NO, &result)?;
                return Ok((email, telephone));
            }
            (Status::CANCELLED | Status::TIMEOUT, _) => {
                bail!("Session '{token}' ended");
            }
            _ => {
                sleep(Duration::from_secs(3)).await;
                continue;
            }
        }
    }
    bail!("Did not get IRMA result in 3 tries");
}

pub async fn next_session(
    req: Request<Body>,
    irma: &IrmaContext,
    pub_hubs_host: &str,
) -> Response<Body> {
    match next_session_priv(req, irma, pub_hubs_host).await {
        Ok(a) => a,
        Err(_) => empty_result(),
    }
}

async fn next_session_priv(
    req: Request<Body>,
    irma: &IrmaContext,
    pub_hubs_host: &str,
) -> Result<Response<Body>> {
    if let Some(ct) = req.headers().get(CONTENT_TYPE) {
        let ct = ct.to_str().unwrap_or("<could not convert to string>");

        if !ct.starts_with("text/plain") {
            log::warn!(
                "Irma server called back with Content-Type {} instead of 'text/plain' - has a jwt_privkey(_file) been configurad for the IRMA server?",
                ct
            );
            return Ok(Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::empty())?);
        }
    }

    let jwt_text =
        std::str::from_utf8(body::to_bytes(req.into_body()).await?.as_ref())?.to_string();

    let jwt = jsonwebtoken::decode::<SignedSessionResultClaims>(&jwt_text, &irma.server_key, &{
        let mut val = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);

        val.set_issuer(&[irma.server_issuer.clone()]);
        val.set_required_spec_claims(&["exp", "iat", "iss", "sub"]);
        val
    });

    if jwt.is_err() {
        log::warn!(
            "Failed to decode/verify JWT ({}) from IRMA server callback: {}",
            jwt_text,
            jwt.unwrap_err()
        );
        return Ok(Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(Body::empty())?);
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
            match (
                get_first_attribute_raw_value(PUB_HUBS_MAIL, &result),
                get_first_attribute_raw_value(PUB_HUBS_PHONE, &result),
            ) {
                //the card exists and we can continue
                (Ok(_mail), Ok(_phone)) => Ok(empty_result()),
                //no card; need to issue
                _ => {
                    let email = get_first_attribute_raw_value(MAIL, &result)?;
                    let telephone = get_first_attribute_raw_value(MOBILE_NO, &result)?;
                    let date = Utc::now().format("%Y-%m-%d").to_string();
                    let body = serde_json::to_string(&ExtendedSessionRequest {
                        request: SessionRequest {
                            context: Context::Issuance,
                            disclose: None,
                            credentials: Some(vec![PubHubsCredential::new(
                                &email, &telephone, &date,
                            )]),
                        },
                        next_session: Some(NextSession {
                            url: pub_hubs_host.to_owned() + "irma-endpoint",
                        }),
                    })
                    .unwrap();

                    let mut resp = Response::new(Body::from(body));
                    resp.headers_mut().insert(
                        CONTENT_TYPE,
                        HeaderValue::from_str("application/json").unwrap(),
                    );
                    Ok(resp)
                }
            }
        }
        _ => Ok(empty_result()),
    }
}

fn empty_result() -> Response<Body> {
    let mut resp = Response::new(Body::empty());
    *resp.status_mut() = StatusCode::NO_CONTENT;
    resp
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
#[allow(non_camel_case_types)] // Follow IRMA naming
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
#[allow(non_camel_case_types)] // Follow IRMA naming
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
    use hyper::service::{make_service_fn, service_fn};
    use hyper::Server;
    use std::convert::Infallible;
    use std::net::SocketAddr;
    use std::sync::Arc;

    #[tokio::test]
    async fn can_start_session() {
        start_fake_server(3000).await;
        let test_pub_hubs_host = "test_host/";
        let resp = login(
            "http://localhost:3000/test1",
            "",
            &vec![],
            test_pub_hubs_host,
        )
        .await
        .unwrap();

        assert_eq!(resp.session_ptr.u, "test_host/irma/test_token/session");
        assert_ne!(resp.token, "");
        assert_eq!(resp.session_ptr.irmaqr, SessionType::Disclosing);
        assert!(resp
            .svg
            .starts_with(r#"<?xml version="1.0" standalone="yes"?><svg "#));

        //errors
        let result = login(
            "http://localhost:3000/test1_1",
            "",
            &vec![],
            test_pub_hubs_host,
        )
        .await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(
            err.to_string(),
            "Did not receive OK from IRMA server on disclosure request"
        );
    }

    #[tokio::test]
    async fn can_get_disclosed_values() {
        start_fake_server(3001).await;
        let resp = disclosed_email_and_telephone("http://localhost:3001/test2", "test_token")
            .await
            .unwrap();
        assert_eq!(resp, (String::from("mail"), String::from("phone")));

        //Follow next session
        let resp = disclosed_email_and_telephone("http://localhost:3001/test2", "test_token2")
            .await
            .unwrap();
        assert_eq!(resp, (String::from("mail"), String::from("phone")));

        // sessions ended or bad results
        match (
            disclosed_email_and_telephone("http://localhost:3001/test2", "test_token3").await,
            disclosed_email_and_telephone("http://localhost:3001/test2", "test_token4").await,
            disclosed_email_and_telephone("http://localhost:3001/test2", "test_token5").await,
            disclosed_email_and_telephone("http://localhost:3001/test2", "test_token6").await,
        ) {
            (Err(e1), Err(e2), Err(e3), Err(e4)) => {
                assert_eq!(e1.to_string(), "Session 'test_token3' ended");
                assert_eq!(e2.to_string(), "Session 'test_token4' ended");
                assert_eq!(e3.to_string(), "test_error");
                assert_eq!(
                    e4.to_string(),
                    "Did not receive OK from IRMA server on disclosure request"
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
                result: result,
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

    fn fake_irma_state() -> IrmaContext {
        IrmaContext {
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
            client_url: "".to_string(),
            requestor: "".to_string(),
            requestor_hmac_key: vec![],
            server_url: "".to_string(),
        }
    }

    #[tokio::test]
    async fn done_after_issue() {
        let body = sign_fake_session_result(SessionResult {
            disclosed: None,
            status: Status::DONE,
            session_type: SessionType::Issuing,
            proof_status: None,
            next_session: None,
            error: None,
        });
        let req = Request::new(Body::from(body));
        let resp = next_session_priv(req, &fake_irma_state(), "test_host")
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NO_CONTENT);
    }

    #[tokio::test]
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
        let req = Request::new(Body::from(body));
        let resp = next_session_priv(req, &fake_irma_state(), "test_host/")
            .await
            .unwrap();

        let resp_body = body::to_bytes(resp).await.unwrap();
        let slice = resp_body.as_ref();
        let session_request: ExtendedSessionRequest = serde_json::from_slice(slice).unwrap();
        assert_eq!(
            session_request.next_session.as_ref().unwrap(),
            &NextSession {
                url: "test_host/irma-endpoint".to_string()
            }
        );
        assert_eq!(session_request.request.context, Context::Issuance);
        assert_eq!(session_request.request.disclose, None);
        let credentials = session_request.request.credentials.unwrap();
        assert_eq!(credentials.len(), 1);
        let credential = credentials.first().unwrap();
        assert_eq!(credential.credential, PUB_HUBS);
        assert_eq!(credential.attributes.email, "mail");
        assert_eq!(credential.attributes.mobilenumber, "phone");
    }

    #[tokio::test]
    async fn cannot_extend_session_after_disclose_mail_and_phone_from_pubhubs() {
        let body = sign_fake_session_result(SessionResult {
            disclosed: Some(vec![vec![
                Attribute {
                    raw_value: "mail".to_string(),
                    status: "".to_string(),
                    id: PUB_HUBS_MAIL.to_string(),
                },
                Attribute {
                    raw_value: "phone".to_string(),
                    status: "".to_string(),
                    id: PUB_HUBS_PHONE.to_string(),
                },
            ]]),
            status: Status::CONNECTED,
            session_type: SessionType::Disclosing,
            proof_status: None,
            next_session: None,
            error: None,
        });
        let req = Request::new(Body::from(body));
        let resp = next_session_priv(req, &fake_irma_state(), "test_host")
            .await
            .unwrap();

        let resp_body = body::to_bytes(resp).await.unwrap();
        assert!(resp_body.is_empty());
    }

    #[tokio::test]
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
                let req = Request::new(Body::from(body));
                let resp = next_session(req, &fake_irma_state(), "test_host").await;

                let resp_body = body::to_bytes(resp).await.unwrap();
                assert!(resp_body.is_empty());
            }
        }
    }

    async fn handle(req: Request<Body>) -> Result<Response<Body>, Infallible> {
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
                        PUB_HUBS_MAIL.to_string(),
                        PUB_HUBS_PHONE.to_string()
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
                    disclosed: Some(vec![vec![
                        Attribute {
                            raw_value: "mail".to_string(),
                            status: "".to_string(),
                            id: PUB_HUBS_MAIL.to_string(),
                        },
                        Attribute {
                            raw_value: "phone".to_string(),
                            status: "".to_string(),
                            id: PUB_HUBS_PHONE.to_string(),
                        },
                    ]]),
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

    async fn start_fake_server(port: u16) {
        let port_bound = Arc::new(tokio::sync::Notify::new());

        {
            let port_bound = port_bound.clone();

            tokio::spawn(async move {
                // We'll bind to 127.0.0.1:<port>
                let addr = SocketAddr::from(([127, 0, 0, 1], port));

                let make_service = make_service_fn(move |_conn| {
                    let service = service_fn(move |req| handle(req));

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
}
