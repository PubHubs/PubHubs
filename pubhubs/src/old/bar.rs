use crate::cookie::{HttpRequestCookieExt as _, HttpResponseBuilderExt as _};
use crate::error::AnyhowExt as _;
use crate::error::TranslatedError;

use actix_web::http::header::{Header as _, TryIntoHeaderValue as _};
use anyhow::Result;
use serde::ser::SerializeMap as _;
use serde::ser::SerializeSeq as _;

pub mod reason {
    pub const IF_MATCH_DIDNT_MATCH: &str =
        "Precondition Failed - current state does not have the ETag mentioned in If-Match";
    pub const INVALID_CONTENT_TYPE: &str =
        "Bad Request - Content-Type must be 'application/octet-stream'";
    pub const IF_MATCH_MISSING: &str =
        "Bad Request - You must send an If-Match header (with the ETag of the current state)";
    pub const IF_MATCH_MULTIPLE_ETAGS: &str =
        "Bad Request - Sending multiple ETags via If-Match is not supported here";
    pub const IF_MATCH_STAR: & str =
                "Bad Request - 'If-Match: *' is not supported here; you must send the ETag of the old (and still current) state.";
    pub const MISSING_COOKIE: &str = "Forbidden - missing PHAccount cookie";
    pub const INVALID_COOKIE: &str = "Forbidden - invalid PHAccount cookie";
}

pub async fn get_state(
    req: actix_web::HttpRequest,
    context: actix_web::web::Data<crate::context::Main>,
) -> Result<actix_web::HttpResponse, TranslatedError> {
    get_state_anyhow(&req, context)
        .await
        .into_translated_error(&req)
}

async fn get_state_anyhow(
    req: &actix_web::HttpRequest,
    context: actix_web::web::Data<crate::context::Main>,
) -> Result<actix_web::HttpResponse> {
    let user_id = match get_user_id(req, &context) {
        Ok(user_id) => user_id,
        Err(err_resp) => return Ok(err_resp),
    };

    let bar_state: crate::data::BarState = {
        let (bs_tx, bs_rx) = tokio::sync::oneshot::channel();
        context
            .db_tx
            .send(crate::data::DataCommands::GetBarState {
                resp: bs_tx,
                id: user_id.clone(),
            })
            .await?;
        bs_rx.await??
    };

    let mut resp = actix_web::HttpResponse::Ok();

    // Resets session cookies if some are missing, to prevent #572
    if !req.has_all_session_cookies() {
        resp.add_session_cookies(
            user_id,
            &context.cookie_secret,
            context.hotfixes.no_secure_cookies,
            context.hotfixes.no_http_only_cookies,
        )?;
    }

    Ok(resp
        .insert_header(actix_web::http::header::ETag(
            actix_web::http::header::EntityTag::new_strong(bar_state.state_etag),
        ))
        .content_type(actix_web::http::header::ContentType::octet_stream())
        .body(bar_state.state))
}

pub async fn put_state(
    req: actix_web::HttpRequest,
    context: actix_web::web::Data<crate::context::Main>,
    state: bytes::Bytes,
) -> Result<actix_web::HttpResponse, TranslatedError> {
    put_state_anyhow(&req, context, state)
        .await
        .into_translated_error(&req)
}

pub async fn put_state_anyhow(
    req: &actix_web::HttpRequest,
    context: actix_web::web::Data<crate::context::Main>,
    state: bytes::Bytes,
) -> Result<actix_web::HttpResponse> {
    let user_id = match get_user_id(req, &context) {
        Ok(user_id) => user_id,
        Err(err_resp) => return Ok(err_resp),
    };

    macro_rules! bad_req {
        ($r:expr) => {
            return Ok(actix_web::HttpResponse::BadRequest().reason($r).finish())
        };
    }

    if req.headers().get("Content-Type")
        != Some(
            &actix_web::http::header::ContentType::octet_stream()
                .try_into_value()
                .expect("octet_stream to be a valid header value"),
        )
    {
        bad_req!(reason::INVALID_CONTENT_TYPE);
    }

    let if_match = actix_web::http::header::IfMatch::parse(req)?;
    // NOTE: interestingly, a missing "If-Match" does not result in an error, but instead in an
    // IfMatch::Items(etags) where etags is empty.

    let old_etag: String = {
        match if_match {
            actix_web::http::header::IfMatch::Items(etags) => {
                if etags.is_empty() {
                    bad_req!(reason::IF_MATCH_MISSING);
                }
                if etags.len() > 1 {
                    bad_req!(reason::IF_MATCH_MULTIPLE_ETAGS);
                }
                etags
                    .first()
                    .expect("Expected tags.len() > 1")
                    .tag()
                    .to_string()
            }
            _ => bad_req!(reason::IF_MATCH_STAR),
        }
    };

    let new_etag: Option<String> = {
        let (etag_tx, etag_rx) = tokio::sync::oneshot::channel();
        context
            .db_tx
            .send(crate::data::DataCommands::UpdateBarState {
                resp: etag_tx,
                id: user_id,
                old_etag,
                state,
            })
            .await?;
        etag_rx.await??
    };

    if new_etag.is_none() {
        return Ok(actix_web::HttpResponse::PreconditionFailed()
            .reason(reason::IF_MATCH_DIDNT_MATCH)
            .finish());
    }

    Ok(actix_web::HttpResponse::NoContent()
        .content_type(actix_web::http::header::ContentType::plaintext())
        .insert_header(actix_web::http::header::ETag(
            actix_web::http::header::EntityTag::new_strong(new_etag.unwrap()),
        ))
        .finish())
}

pub async fn get_hubs(
    req: actix_web::HttpRequest,
    context: actix_web::web::Data<crate::context::Main>,
) -> Result<actix_web::HttpResponse, TranslatedError> {
    get_hubs_anyhow(&req, context)
        .await
        .into_translated_error(&req)
}

async fn get_hubs_anyhow(
    _req: &actix_web::HttpRequest,
    context: actix_web::web::Data<crate::context::Main>,
) -> Result<actix_web::HttpResponse> {
    // NB. We do not require the user to be authenticated, because the global client
    // needs to be able to display a list of hubs before the end-user has authenticated.

    // TODO: take measures to prevent DOS (rate limiting or caching)
    let hubs: Vec<crate::data::Hub> = {
        let (bs_tx, bs_rx) = tokio::sync::oneshot::channel();
        context
            .db_tx
            .send(crate::data::DataCommands::AllHubs { resp: bs_tx })
            .await?;
        bs_rx.await??
    };

    // Hub contains some sensitive data that we do not want to pass to
    // the bar, so redefine Serialize for Hub by wrapping it in the following type.
    struct SerializeHub<'s>(&'s crate::data::Hub);

    impl serde::Serialize for SerializeHub<'_> {
        fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: serde::Serializer,
        {
            let hub = &self.0;
            let mut map = serializer.serialize_map(None)?;
            map.serialize_entry("id", &hub.id)?;
            map.serialize_entry("name", &hub.name)?;
            map.serialize_entry("description", &hub.description)?;
            map.serialize_entry("client_uri", &hub.client_uri)?;
            map.serialize_entry(
                "server_uri",
                &hub.oidc_redirect_uri
                    .replace("_synapse/client/oidc/callback", ""),
            )?;
            map.end()
        }
    }

    struct SerializeHubs(Vec<crate::data::Hub>);

    impl serde::Serialize for SerializeHubs {
        fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: serde::Serializer,
        {
            let hubs = &self.0;
            let mut seq = serializer.serialize_seq(None)?;
            for hub in hubs {
                seq.serialize_element(&SerializeHub(hub))?;
            }
            seq.end()
        }
    }

    Ok(actix_web::HttpResponse::Ok()
        .content_type(actix_web::http::header::ContentType::json())
        .json(SerializeHubs(hubs)))
}

fn get_user_id(
    req: &actix_web::HttpRequest,
    context: &actix_web::web::Data<crate::context::Main>,
) -> Result<String, actix_web::HttpResponse> {
    let user_id = req.user_id_from_cookies(&context.cookie_secret);

    if user_id.is_err() {
        return Err(actix_web::HttpResponse::Forbidden()
            .reason(reason::INVALID_COOKIE)
            .finish());
    }

    let user_id = user_id.unwrap();

    if user_id.is_none() {
        return Err(actix_web::HttpResponse::Forbidden()
            .reason(reason::MISSING_COOKIE)
            .finish());
    }

    Ok(user_id.unwrap())
}
