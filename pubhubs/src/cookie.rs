//! Creation and verification of cookies
//!
//! PubHubs Central uses two cookies at the moment:  
//!   1. a session cookie, which is the primary concern of this module, and
//!   2. a secondary 'policy' cookie to remember that a user accepted PHC's policy, see
//!       the [policy_cookie] module.
use crate::error::HttpContextExt as _;
use actix_web::http::header::SET_COOKIE;
use actix_web::{HttpRequest, HttpResponseBuilder};
use anyhow::{anyhow, bail, ensure, Context as _, Result};
use base64ct::{Base64UrlUnpadded, Encoding as _};
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};

use sha2::Sha256;
use std::str::FromStr as _;

type HmacSha256 = Hmac<Sha256>;
const COOKIE_NAME: &str = "PHAccount";
//30 days validity
const MAX_AGE: i64 = 60 * 60 * 24 * 30;

#[cfg(not(debug_assertions))]
const SECURE: &str = " SameSite=None; Secure;";
#[cfg(debug_assertions)]
const SECURE: &str = "";

#[cfg(not(debug_assertions))]
macro_rules! secure_cookie_attribute {
    () => {
        " Secure;"
    };
}

#[cfg(debug_assertions)]
macro_rules! secure_cookie_attribute {
    () => {
        ""
    };
}

/// Creates `PHAccount` session `Cookie` header value
fn create_session_cookie(user_id: u32, cookie_secret: &str) -> Result<String> {
    let now = Utc::now();
    let created = now.timestamp();
    let until = now
        .checked_add_signed(Duration::seconds(MAX_AGE))
        .ok_or_else(|| anyhow!("overflow (!?)"))?
        .timestamp();

    let mut mac = HmacSha256::new_from_slice(cookie_secret.as_bytes())
        .context("creating MAC for {COOKIE_NAME} cookie")?;

    let content = format!("{}.{}.{}", user_id, created, until);
    mac.update(content.as_bytes());
    let result = mac.finalize();
    let signature = result;

    let cookie_value = Base64UrlUnpadded::encode_string(
        &format!("{}.{:X}", content, signature.into_bytes()).into_bytes(),
    );

    Ok(format!("{COOKIE_NAME}={cookie_value}"))
}

/// Creates `PHAccount` session `Set-Cookie` header value
fn create_session_set_cookie(user_id: u32, cookie_secret: &str) -> Result<String> {
    let val = create_session_cookie(user_id, cookie_secret)?;
    Ok(format!(
        "{val}; Max-Age={MAX_AGE};{SECURE} Path=/"
    ))
}

/// Searches cookie string `cookies` for a PHAccount session cookie, and - after validating the
/// cookie - extracts the `userid` from it.  Returns Ok(None) if no session cookie was found.
fn user_id_from_cookies(cookies: &str, cookie_secret: &str) -> Result<Option<u32>> {
    let cookie_start = format!("{}=", COOKIE_NAME);
    let results: Vec<&str> = cookies
        .split(';')
        .map(|cookie| cookie.trim())
        .filter(|cookie| cookie.starts_with(cookie_start.as_str()))
        .map(|cookie| &cookie[cookie_start.len()..])
        .collect();

    if results.is_empty() {
        return Ok(None);
    }

    if results.len() > 1 {
        bail!("multiple {COOKIE_NAME} cookies provided");
    }

    let result = results.first().unwrap();

    let signed: String = String::from_utf8(
        base64ct::Base64UrlUnpadded::decode_vec(result).bad_request(Some(
            "Invalid PHAccount cookie - base64 decoding failed - please remove the cookie and try again!".to_string(),
        ))?,
    )?;
    let tag_and_content: Vec<&str> = signed.rsplitn(2, '.').collect();
    if tag_and_content.len() != 2 {
        bail!("Incorrect {COOKIE_NAME} cookie format - missing MAC");
    }

    let tag = base16ct::mixed::decode_vec(tag_and_content.first().unwrap())?;
    let content = tag_and_content.get(1).unwrap();

    let mut mac = HmacSha256::new_from_slice(cookie_secret.as_bytes())?;
    mac.update(content.as_bytes());

    if mac.verify_slice(tag.as_slice()).is_err() {
        bail!("invalid {COOKIE_NAME} cookie signature");
    }

    let content: Vec<&str> = content.split('.').collect();

    if content.len() != 3 {
        bail!("Incorrect {COOKIE_NAME} cookie format - expected three fields before the MAC");
    }

    let created: i64 = content
        .get(1)
        .unwrap()
        .parse()
        .context("parsing {COOKIE_NAME} cookie 'created' field")?;

    let until = content.get(2).unwrap();
    let until = i64::from_str(until).context("parsing {COOKIE_NAME} cookie's 'until' field")?;

    let now = Utc::now().timestamp();

    if now > until {
        bail!("{COOKIE_NAME} cookie expired");
    }

    if now < created {
        bail!("{COOKIE_NAME} cookie from the future");
    }

    Ok(Some(content.first().unwrap().to_string().parse().unwrap()))
}

pub trait HttpResponseBuilderExt
where
    Self: Sized,
{
    /// Adds `PHAccount` session cookie to response
    fn add_session_cookie(self, user_id: u32, cookie_secret: &str) -> Result<Self>;

    /// Removes `PHAccount` session cookie, logging out the user.
    fn remove_session_cookie(self) -> Self;
}

impl<'a> HttpResponseBuilderExt for &'a mut HttpResponseBuilder {
    fn add_session_cookie(self, user_id: u32, cookie_secret: &str) -> Result<Self> {
        let cookie = create_session_set_cookie(user_id, cookie_secret)?;
        Ok(self.insert_header((SET_COOKIE, cookie.as_str())))
    }

    fn remove_session_cookie(self) -> Self {
        let cookie: String = format!("{COOKIE_NAME}=deleted; Max-Age=0; {SECURE} Path=/");
        self.insert_header((SET_COOKIE, cookie.as_str()))
    }
}

impl HttpResponseBuilderExt for actix_web::test::TestRequest {
    fn add_session_cookie(self, user_id: u32, cookie_secret: &str) -> Result<Self> {
        let cookie =
            actix_web::cookie::Cookie::parse(create_session_cookie(user_id, cookie_secret)?)?;
        Ok(self.cookie(cookie))
    }

    fn remove_session_cookie(self) -> Self {
        unimplemented!("removing session cookie from TestRequest is not implemented");
    }
}

pub trait HttpRequestCookieExt {
    /// Verifies `PHAccount` cookie,  and extracts userid from it.  Returns Ok(None)
    /// if there's no `PHAccount` cookie.
    fn user_id_from_cookie(self, cookie_secret: &str) -> Result<Option<u32>>;

    /// Verifies a valid `PHAccount` cookie is present for given `user_id`.
    fn assert_user_id(self, cookie_secret: &str, user_id: u32) -> Result<()>;
}

impl<'s> HttpRequestCookieExt for &'s HttpRequest {
    fn user_id_from_cookie(self, cookie_secret: &str) -> Result<Option<u32>> {
        // NOTE: at most one `Cookie` header is set, see
        //   https://www.rfc-editor.org/rfc/rfc6265#section-5.4
        let cookies = self.headers().get("Cookie");
        if cookies.is_none() {
            return Ok(None);
        }
        let cookies = cookies.unwrap();
        user_id_from_cookies(cookies.to_str()?, cookie_secret)
    }

    fn assert_user_id(self, cookie_secret: &str, user_id: u32) -> Result<()> {
        ensure!(
            self.user_id_from_cookie(cookie_secret)?
                .ok_or_else(|| anyhow!("no {COOKIE_NAME} cookie"))?
                == user_id,
            "logged in as someone else"
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, HttpResponse};
    use regex::bytes::Regex;

    #[actix_web::test]
    async fn test_add_cookie_that_can_be_verified() {
        let user_id = 200;
        let secret = "really secret";
        let mut resp = HttpResponse::Ok();

        let with_cookie = resp.add_session_cookie(user_id, secret).unwrap();

        let cookie = with_cookie
            .finish()
            .headers()
            .get("Set-Cookie")
            .unwrap()
            .to_str()
            .unwrap()
            .to_owned();

        // Verified with
        // ```
        // [profile.test-without-debug]
        // inherits = "test"
        // debug-assertions = false
        // ```
        // and
        // `cargo test --profile=test-without-debug test_add_cookie_that_can_be_verified`
        assert!(cookie.contains(&format!("Max-Age=2592000;{SECURE} Path=/")));
        let re = Regex::new("PHAccount=[A-Za-z0-9]{12,}={0,2}; ").unwrap();
        assert!(re.is_match(cookie.as_bytes()));

        //set up
        let req = test::TestRequest::get()
            .cookie(actix_web::cookie::Cookie::parse("cookie=value").unwrap())
            .cookie(actix_web::cookie::Cookie::parse(cookie).unwrap())
            .cookie(actix_web::cookie::Cookie::parse("other=another").unwrap())
            .to_http_request();

        assert!(req.assert_user_id(secret, user_id).is_ok());
    }

    #[actix_web::test]
    async fn bad_cookie_not_verified() {
        let user_id = 200;
        let secret = "really secret";
        let mut resp = HttpResponse::Ok();

        let with_cookie = resp.add_session_cookie(user_id, secret).unwrap();

        let cookie = with_cookie
            .finish()
            .headers()
            .get("Set-Cookie")
            .unwrap()
            .to_str()
            .unwrap()
            .to_owned();

        let other_secret = "wrong";

        let req = test::TestRequest::get()
            // .insert_header((COOKIE, cookie))
            .cookie(actix_web::cookie::Cookie::parse(cookie).unwrap())
            .to_http_request();

        assert!(req.assert_user_id(other_secret, user_id).is_err());

        // set up for expired cookie
        let until = Utc::now()
            .checked_sub_signed(Duration::seconds(MAX_AGE))
            .expect("Tried to turn a date time into a timestamp")
            .timestamp();

        let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
            .expect("Tried to make a mac to sign cookies");

        let content = format!("{user_id}.{until}.{until}");
        mac.update(content.as_bytes());
        let result = mac.finalize();
        let signature = result.into_bytes();

        let cookie_value = format!(
            "{COOKIE_NAME}={}",
            base64ct::Base64UrlUnpadded::encode_string(
                format!("{content}.{signature:X}").as_bytes(),
            )
        );

        let req2 = test::TestRequest::get()
            .cookie(actix_web::cookie::Cookie::parse(cookie_value).unwrap())
            .to_http_request();

        assert_eq!(
            req2.assert_user_id(secret, user_id)
                .unwrap_err()
                .to_string(),
            format!("{COOKIE_NAME} cookie expired")
        );
    }
}

pub mod policy_cookie {
    use actix_web::{HttpRequest, HttpResponseBuilder};

    const POLICY_ACCEPTED_COOKIE_TEXT: &str =
        concat!("AcceptedPolicy=1;", secure_cookie_attribute!(), " Path=/");

    pub fn add_accepted_policy_session_cookie(resp: &mut HttpResponseBuilder) {
        let cookie = POLICY_ACCEPTED_COOKIE_TEXT;
        resp.insert_header(("Set-Cookie", cookie));
    }

    pub fn accepted_policy(req: &HttpRequest) -> bool {
        // NOTE: at most one 'Cookie' header is set, see
        //   https://www.rfc-editor.org/rfc/rfc6265#section-5.4
        if let Some(cookies) = req.headers().get("Cookie") {
            cookies
                .to_str()
                .expect("Turning a Cookie header value into a string")
                .split(';')
                .map(|c| c.trim())
                .any(|c| c == "AcceptedPolicy=1")
        } else {
            false
        }
    }
}
