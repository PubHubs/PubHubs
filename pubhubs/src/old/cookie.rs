//! Creation and verification of cookies
use crate::error::HttpContextExt as _;
use actix_web::{HttpRequest, HttpResponseBuilder};
use anyhow::{Context as _, Result, anyhow, bail, ensure};
use base64ct::{Base64UrlUnpadded, Encoding as _};
use chrono::Utc;
use hmac::{Hmac, Mac};

use sha2::Sha256;
use std::str::FromStr as _;

type HmacSha256 = Hmac<Sha256>;
//30 days validity
const MAX_AGE: i64 = 60 * 60 * 24 * 30;

const PHACCOUNT: &str = "PHAccount";
const PHACCOUNT_CROSS_SITE: &str = "PHAccount.CrossSite";

/// Creates `PHAccount(.CrossSite)` session `Cookie` header content
fn session_cookie_content(user_id: String, cookie_secret: &str) -> Result<String> {
    let now = Utc::now();
    let created = now.timestamp();
    let until = now
        .checked_add_signed(chrono::Duration::seconds(MAX_AGE))
        .ok_or_else(|| anyhow!("overflow (!?)"))?
        .timestamp();

    let mut mac = HmacSha256::new_from_slice(cookie_secret.as_bytes())
        .context("creating MAC for PHAccount(.CrossSite) cookie")?;

    let content = format!("{user_id}.{created}.{until}");
    mac.update(content.as_bytes());
    let result = mac.finalize();
    let signature = result;

    let cookie_value = Base64UrlUnpadded::encode_string(
        &format!("{}.{:X}", content, signature.into_bytes()).into_bytes(),
    );
    Ok(cookie_value)
}

/// Creates `PHAccount` and `PHAccount.CrossSite` cookies.
fn create_session_cookies(
    user_id: String,
    cookie_secret: &str,
    no_secure: bool,
    no_http_only: bool,
) -> Result<[actix_web::cookie::Cookie<'static>; 2]> {
    let session_cookie_value = session_cookie_content(user_id, cookie_secret)?;

    let finish_cookie =
        |cb: actix_web::cookie::CookieBuilder<'static>| -> actix_web::cookie::Cookie {
            cb.max_age(actix_web::cookie::time::Duration::seconds(MAX_AGE))
                .secure(!no_secure)
                .path("/")
                .finish()
        };

    Ok([
        finish_cookie(
            actix_web::cookie::Cookie::build(PHACCOUNT, session_cookie_value.clone())
                .same_site(actix_web::cookie::SameSite::Strict)
                .http_only(!no_http_only),
        ),
        finish_cookie(
            actix_web::cookie::Cookie::build(PHACCOUNT_CROSS_SITE, session_cookie_value)
                .same_site(actix_web::cookie::SameSite::None) // used by OIDC in an iframe (so Lax
                // won't cut it)
                .http_only(!no_http_only),
        ),
    ])
}

/// Creates `PHAccount`, `PHAccount.CrossSite` and `PHAccount.LoginTimestamp` *removal* cookies.
fn create_session_removal_cookies() -> [actix_web::cookie::Cookie<'static>; 2] {
    let mut cookies = [
        actix_web::cookie::Cookie::new(PHACCOUNT, ""),
        actix_web::cookie::Cookie::new(PHACCOUNT_CROSS_SITE, ""),
    ];
    for cookie in &mut cookies {
        cookie.make_removal();
    }
    cookies
}

pub trait HttpResponseBuilderExt
where
    Self: Sized,
{
    /// Adds `PHAccount`, `PHAccount.CrossSite` and `PHAccount.LastLogin` session cookies to the response
    fn add_session_cookies(
        self,
        user_id: String,
        cookie_secret: &str,
        no_secure: bool,
        no_http_only: bool,
    ) -> Result<Self>;

    /// Removes `PHAccount` session cookie, logging out the user.
    fn remove_session_cookies(self) -> Self;
}

impl HttpResponseBuilderExt for &mut HttpResponseBuilder {
    fn add_session_cookies(
        self,
        user_id: String,
        cookie_secret: &str,
        no_secure: bool,
        no_http_only: bool,
    ) -> Result<Self> {
        for cookie in create_session_cookies(user_id, cookie_secret, no_secure, no_http_only)? {
            self.cookie(cookie);
        }
        Ok(self)
    }

    fn remove_session_cookies(self) -> Self {
        for cookie in create_session_removal_cookies() {
            self.cookie(cookie);
        }
        self
    }
}

impl HttpResponseBuilderExt for actix_web::test::TestRequest {
    fn add_session_cookies(
        mut self,
        user_id: String,
        cookie_secret: &str,
        no_secure: bool,
        no_http_only: bool,
    ) -> Result<Self> {
        for cookie in create_session_cookies(user_id, cookie_secret, no_secure, no_http_only)? {
            self = self.cookie(cookie)
        }
        Ok(self)
    }

    fn remove_session_cookies(self) -> Self {
        unimplemented!("removing session cookie from TestRequest is not implemented");
    }
}

/// Searches cookie string `cookies` for a PHAccount session cookie, and - after validating the
/// cookie - extracts the `userid` from it.  Returns Ok(None) if no session cookie was found.
fn user_id_from_cookies(
    cookie: actix_web::cookie::Cookie<'_>,
    cookie_secret: &str,
) -> Result<Option<String>> {
    let cookie_value = cookie.value();

    let signed: String = String::from_utf8(
        base64ct::Base64UrlUnpadded::decode_vec(cookie_value).bad_request(Some(format!(
            "Invalid {} cookie - base64 decoding failed - please remove the cookie and try again!",
            cookie.name()
        )))?,
    )?;
    let tag_and_content: Vec<&str> = signed.rsplitn(2, '.').collect();
    if tag_and_content.len() != 2 {
        bail!("Incorrect {} cookie format - missing MAC", cookie.name());
    }

    let tag = base16ct::mixed::decode_vec(tag_and_content.first().unwrap())?;
    let content = tag_and_content.get(1).unwrap();

    let mut mac = HmacSha256::new_from_slice(cookie_secret.as_bytes())?;
    mac.update(content.as_bytes());

    if mac.verify_slice(tag.as_slice()).is_err() {
        bail!("invalid {} cookie signature", cookie.name());
    }

    let content: Vec<&str> = content.split('.').collect();

    if content.len() != 3 {
        bail!(
            "Incorrect {} cookie format - expected three fields before the MAC",
            cookie.name()
        );
    }

    let created: i64 = content
        .get(1)
        .unwrap()
        .parse()
        .with_context(|| format!("parsing {} cookie 'created' field", cookie.name()))?;

    let until = content.get(2).unwrap();
    let until = i64::from_str(until)
        .with_context(|| format!("parsing {} cookie's 'until' field", cookie.name()))?;

    let now = Utc::now().timestamp();

    if now > until {
        bail!("{} cookie expired", cookie.name());
    }

    if now < created {
        bail!("{} cookie from the future", cookie.name());
    }

    Ok(Some(content.first().unwrap().to_string().parse().unwrap()))
}

pub trait HttpRequestCookieExt: Sized {
    /// Verifies `PHAccount` cookie,  and extracts userid from it.  Returns Ok(None)
    /// if there's no `PHAccount` cookie.
    fn user_id_from_cookies(self, cookie_secret: &str) -> Result<Option<String>> {
        self.user_id_from_cookies_maybe_cross_site(cookie_secret, false)
    }

    /// Like [Self::user_id_from_cookies], but allows you to use the `SameSite=None`
    /// `PHAccount.CrossSite` cookie.  Be careful not to create a CSRF vulnerability!
    fn user_id_from_cookies_maybe_cross_site(
        self,
        cookie_secret: &str,
        allow_cross_site: bool,
    ) -> Result<Option<String>>;

    /// See [Self::user_id_from_cookies_maybe_cross_site].  Beware CSRF!
    fn user_id_from_cookies_cross_site(self, cookie_secret: &str) -> Result<Option<String>> {
        self.user_id_from_cookies_maybe_cross_site(cookie_secret, true)
    }

    /// Verifies a valid `PHAccount` cookie is present for given `user_id`.
    fn assert_user_id(self, cookie_secret: &str, user_id: String) -> Result<()>;

    /// Checks whether all session cookies are present.  Does not check whether they are valid.
    fn has_all_session_cookies(&self) -> bool;
}

impl HttpRequestCookieExt for &HttpRequest {
    fn user_id_from_cookies_maybe_cross_site(
        self,
        cookie_secret: &str,
        allow_cross_site_cookie: bool,
    ) -> Result<Option<String>> {
        let mut cookie_or_none = self.cookie(PHACCOUNT);

        if cookie_or_none.is_none() && allow_cross_site_cookie {
            cookie_or_none = self.cookie(PHACCOUNT_CROSS_SITE);
        }

        if cookie_or_none.is_none() {
            return Ok(None);
        }

        let cookie = cookie_or_none.unwrap();

        user_id_from_cookies(cookie, cookie_secret)
    }

    fn assert_user_id(self, cookie_secret: &str, user_id: String) -> Result<()> {
        ensure!(
            self.user_id_from_cookies(cookie_secret)?
                .ok_or_else(|| anyhow!("no {PHACCOUNT} cookie"))?
                == user_id,
            "logged in as someone else"
        );
        Ok(())
    }

    fn has_all_session_cookies(&self) -> bool {
        for cookie_name in [PHACCOUNT, PHACCOUNT_CROSS_SITE] {
            if self.cookie(cookie_name).is_none() {
                return false;
            }
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{HttpResponse, test};
    use uuid::Uuid;

    #[actix_web::test]
    async fn test_add_cookie_that_can_be_verified() {
        let user_id = Uuid::new_v4().to_string();
        let secret = "really secret";
        let mut resp = HttpResponse::Ok();

        let with_cookie = resp
            .add_session_cookies(user_id.clone(), secret, false, false)
            .unwrap()
            .finish();

        let mut had_phaccount = false;
        let mut had_phaccount_cross_site = false;
        let mut phaccount_cookie: Option<actix_web::cookie::Cookie<'_>> = None;

        for cookie in with_cookie.cookies() {
            match cookie.name() {
                PHACCOUNT => {
                    assert!(cookie.max_age().is_some());
                    assert_eq!(cookie.secure(), Some(true));
                    assert_eq!(cookie.http_only(), Some(true));
                    assert_eq!(
                        cookie.same_site(),
                        Some(actix_web::cookie::SameSite::Strict)
                    );
                    had_phaccount = true;
                    phaccount_cookie = Some(cookie.clone());
                }
                PHACCOUNT_CROSS_SITE => {
                    assert!(cookie.max_age().is_some());
                    assert_eq!(cookie.secure(), Some(true));
                    assert_eq!(cookie.http_only(), Some(true));
                    assert_eq!(cookie.same_site(), Some(actix_web::cookie::SameSite::None));
                    had_phaccount_cross_site = true;
                }
                _ => panic!("unexpected cookie!"),
            }
        }

        assert!(had_phaccount && had_phaccount_cross_site);

        //set up
        let req = test::TestRequest::get()
            .cookie(actix_web::cookie::Cookie::parse("cookie=value").unwrap())
            .cookie(phaccount_cookie.unwrap())
            .cookie(actix_web::cookie::Cookie::parse("other=another").unwrap())
            .to_http_request();

        assert!(req.assert_user_id(secret, user_id).is_ok());
    }

    #[actix_web::test]
    async fn bad_cookie_not_verified() {
        let user_id = Uuid::new_v4().to_string();
        let secret = "really secret";
        let mut resp = HttpResponse::Ok();

        let with_cookie = resp
            .add_session_cookies(user_id.clone(), secret, false, false)
            .unwrap();

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

        assert!(req.assert_user_id(other_secret, user_id.clone()).is_err());

        // set up for expired cookie
        let until = Utc::now()
            .checked_sub_signed(chrono::Duration::seconds(MAX_AGE))
            .expect("Tried to turn a date time into a timestamp")
            .timestamp();

        let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
            .expect("Tried to make a mac to sign cookies");

        let content = format!("{user_id}.{until}.{until}");
        mac.update(content.as_bytes());
        let result = mac.finalize();
        let signature = result.into_bytes();

        let cookie_value = format!(
            "{PHACCOUNT}={}",
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
            format!("{PHACCOUNT} cookie expired")
        );
    }
}
