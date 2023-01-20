use crate::cookie::HttpRequestCookieExt as _;
use crate::error::AnyhowExt as _;
use crate::error::TranslatedError;
use actix_web::http::header::{Header as _, TryIntoHeaderValue as _};
use anyhow::Result;

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
    let user_id = match get_user_id(&req, &context) {
        Ok(user_id) => user_id,
        Err(err_resp) => return Ok(err_resp),
    };

    let bar_state: crate::data::BarState = {
        let (bs_tx, bs_rx) = tokio::sync::oneshot::channel();
        context
            .db_tx
            .send(crate::data::DataCommands::GetBarState {
                resp: bs_tx,
                id: user_id,
            })
            .await?;
        bs_rx.await??
    };

    Ok(actix_web::HttpResponse::Ok()
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
    let user_id = match get_user_id(&req, &context) {
        Ok(user_id) => user_id,
        Err(err_resp) => return Ok(err_resp),
    };

    macro_rules! bad_req {
        ($m:expr) => {
            return Ok(actix_web::HttpResponse::BadRequest()
                .reason(concat!("Bad Request - ", $m))
                .finish())
        };
    }

    if req.headers().get("Content-Type")
        != Some(
            &actix_web::http::header::ContentType::octet_stream()
                .try_into_value()
                .expect("octet_stream to be a valid header value"),
        )
    {
        bad_req!("Content-Type must be 'application/octet-stream'");
    }

    let if_match = actix_web::http::header::IfMatch::parse(req)?;

    /* TODO: check error for missing If-Match
    if if_match.is_none() {
        bad_req!("you must send the ETag (and only this ETag) of the old (and still current) state via the If-Match header");
    }
    */

    let old_etag: String = {
        match if_match {
            actix_web::http::header::IfMatch::Items(etags) =>  {
                if etags.len() != 1 {
                    bad_req!("Sending multiple ETags via If-Match is not supported here");
                }
                etags.first().expect("Expect IfMatch to not accept an empty list of ETags").tag().to_string()
            },
            _ => bad_req!("'If-Match: *' is not supported here; you must send the ETag of the old (and still current) state."),
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
            .reason(
                "Precondition Failed - current state does not have the ETag mentioned in If-Match",
            )
            .finish());
    }

    Ok(actix_web::HttpResponse::NoContent()
        .content_type(actix_web::http::header::ContentType::plaintext())
        .insert_header(actix_web::http::header::ETag(
            actix_web::http::header::EntityTag::new_strong(new_etag.unwrap()),
        ))
        .finish())
}

fn get_user_id(
    req: &actix_web::HttpRequest,
    context: &actix_web::web::Data<crate::context::Main>,
) -> Result<u32, actix_web::HttpResponse> {
    let user_id = req.user_id_from_cookie(&context.cookie_secret);

    if user_id.is_none() {
        return Err(actix_web::HttpResponse::Forbidden()
            .reason("Forbidden - missing (valid) cookie")
            .finish());
    }

    Ok(user_id.unwrap())
}
