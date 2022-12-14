use actix_web::http::header::{HeaderMap, SET_COOKIE};
use actix_web::{HttpRequest, HttpResponseBuilder};
use base64ct::{Base64, Encoding as _};
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};

use sha2::Sha256;
use std::str::FromStr as _;

type HmacSha256 = Hmac<Sha256>;
const COOKIE_NAME: &str = "PHAccount";
//30 days validity
const MAX_AGE: i64 = 60 * 60 * 24 * 30;

#[cfg(not(debug_assertions))]
const SECURE: &str = " Secure;";
#[cfg(debug_assertions)]
const SECURE: &str = "";

pub struct Cookie {
    user_id: i32,
    pub cookie: String,
}

impl Cookie {
    pub fn new(user_id: i32, cookie_secret: &str) -> Self {
        let until = Utc::now()
            .checked_add_signed(Duration::seconds(MAX_AGE))
            .expect("Tried to turn a date time into a timestamp")
            .timestamp();

        let mut mac = HmacSha256::new_from_slice(cookie_secret.as_bytes())
            .expect("Tried to make a mac to sign cookies");

        let content = format!("{}.{}", user_id, until);
        mac.update(content.as_bytes());
        let result = mac.finalize();
        let signature = result;

        let cookie_value = Base64::encode_string(
            &format!("{}.{:X}", content, signature.into_bytes()).into_bytes(),
        );

        let cookie = format!(
            "{}={}; Max-Age={}; SameSite=Strict;{SECURE} Path=/",
            COOKIE_NAME, cookie_value, MAX_AGE
        );

        Cookie { user_id, cookie }
    }

    fn deserialize(cookies: &str, cookie_secret: &str) -> Result<Cookie, String> {
        let cookie_start = format!("{}=", COOKIE_NAME);
        let results: Vec<String> = cookies
            .split(';')
            .map(|cookie| cookie.trim())
            .filter(|cookie| cookie.starts_with(cookie_start.as_str()))
            .map(|cookie| &cookie[cookie_start.len()..])
            // Remove url encoding
            .map(|cookie| cookie.replace("%3D", "="))
            .collect();

        for content in results {
            let original: String = String::from_utf8(
                base64ct::Base64::decode_vec(&content)
                    .expect("Trying to decode base64 from a cookie"),
            )
            .expect("Trying to make a string from cookie content");
            let content: Vec<&str> = original.split('.').collect();
            if content.len() == 3 {
                let mut mac = HmacSha256::new_from_slice(cookie_secret.as_bytes())
                    .expect("Tried to make a mac to sign cookies");
                mac.update(
                    format!("{}.{}", content.first().unwrap(), content.get(1).unwrap()).as_bytes(),
                );
                let t = content.get(2).unwrap();
                let bytes = parse_hex(t);
                if mac.verify_slice(bytes.as_slice()).is_ok() {
                    let until = content.get(1).unwrap();
                    let until = i64::from_str(until).expect("Expected a time stamp");
                    if Utc::now().timestamp() < until {
                        return Ok(Cookie {
                            user_id: content.first().unwrap().to_string().parse().unwrap(),
                            cookie: original,
                        });
                    }
                } else {
                    return Err("Unverified signature".to_string());
                }
            } else {
                return Err("Incorrect data length".to_string());
            }
        }
        Err("No such cookie".to_string())
    }
}

pub fn add_cookie<'a>(
    resp: &'a mut HttpResponseBuilder,
    user_id: i32,
    cookie_secret: &'a str,
) -> &'a mut HttpResponseBuilder {
    let cookie = Cookie::new(user_id, cookie_secret);
    resp.insert_header((SET_COOKIE, cookie.cookie.as_str()))
}

pub fn verify_cookie(req: &HttpRequest, cookie_secret: &str, id: &str) -> bool {
    if let Some(cookies) = req.headers().get("Cookie") {
        let cookies = cookies
            .to_str()
            .expect("Turning a Cookie header value into a string");
        if let Ok(cookie) = Cookie::deserialize(cookies, cookie_secret) {
            if let Ok(user_id) = id.parse::<i32>() {
                return cookie.user_id == user_id;
            }
        }
    }
    false
}

pub fn user_id_from_verified_cookie(headers: &HeaderMap, cookie_secret: &str) -> Option<i32> {
    if let Some(cookies) = headers.get("Cookie") {
        let cookies = cookies
            .to_str()
            .expect("Turning a Cookie header value into a string");
        if let Ok(cookie) = Cookie::deserialize(cookies, cookie_secret) {
            return Some(cookie.user_id);
        }
    }
    None
}

pub fn log_out_cookie() -> String {
    format!(
        "{}=deleted ; Max-Age={}; SameSite=Strict;{SECURE} Path=/",
        COOKIE_NAME, 0
    )
}

const COOKIE_TEXT: &str = "AcceptedPolicy=1; SameSite=Strict;{SECURE} Path=/";

pub fn add_accepted_policy_session_cookie(resp: &mut HttpResponseBuilder) {
    let cookie = COOKIE_TEXT;
    resp.insert_header(("Set-Cookie", cookie));
}

pub fn accepted_policy(req: &HttpRequest) -> bool {
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

fn parse_hex(hex: &str) -> Vec<u8> {
    let mut hex_bytes = hex
        .as_bytes()
        .iter()
        .filter_map(|b| match b {
            b'0'..=b'9' => Some(b - b'0'),
            b'A'..=b'F' => Some(b - b'A' + 10),
            _ => None,
        })
        .fuse();

    let mut bytes = Vec::new();
    while let (Some(h), Some(l)) = (hex_bytes.next(), hex_bytes.next()) {
        bytes.push(h << 4 | l)
    }
    bytes
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

        let with_cookie = add_cookie(&mut resp, user_id, secret);

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
        assert!(cookie.contains(&format!("Max-Age=2592000; SameSite=Strict;{SECURE} Path=/")));
        let re = Regex::new("PHAccount=[A-Za-z0-9]{12,}={0,2}; ").unwrap();
        assert!(re.is_match(cookie.as_bytes()));

        //set up
        let req = test::TestRequest::get()
            .cookie(actix_web::cookie::Cookie::parse("cookie=value").unwrap())
            .cookie(actix_web::cookie::Cookie::parse(cookie).unwrap())
            .cookie(actix_web::cookie::Cookie::parse("other=another").unwrap())
            .to_http_request();

        assert!(verify_cookie(&req, secret, user_id.to_string().as_str()));
    }

    #[actix_web::test]
    async fn bad_cookie_not_verified() {
        let user_id = 200;
        let secret = "really secret";
        let mut resp = HttpResponse::Ok();

        let with_cookie = add_cookie(&mut resp, user_id, secret);

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

        assert!(!verify_cookie(
            &req,
            other_secret,
            user_id.to_string().as_str()
        ));

        // set up for expired cookie
        let until = Utc::now()
            .checked_sub_signed(Duration::seconds(MAX_AGE))
            .expect("Tried to turn a date time into a timestamp")
            .timestamp();

        let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
            .expect("Tried to make a mac to sign cookies");

        let content = format!("{}.{}", user_id, until);
        mac.update(content.as_bytes());
        let result = mac.finalize();
        let signature = result.into_bytes();

        let cookie_value = base64ct::Base64::encode_string(
            format!("{}={}.{:X}", COOKIE_NAME, content, signature).as_bytes(),
        );

        let req2 = test::TestRequest::get()
            .cookie(actix_web::cookie::Cookie::parse(cookie_value).unwrap())
            .to_http_request();

        assert!(!verify_cookie(&req2, secret, user_id.to_string().as_str()));
    }
}
