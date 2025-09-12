use super::server::*;

use std::collections::HashMap;
use std::rc::Rc;

use actix_web::web;

use crate::{
    api::{self},
    attr, handle, phcrypto,
};

impl App {
    /// Implements [`api::auths::AttrKeysEP`].
    pub async fn handle_attr_keys(
        app: Rc<Self>,
        reqs: web::Json<HashMap<handle::Handle, api::auths::AttrKeyReq>>,
    ) -> api::Result<api::auths::AttrKeysResp> {
        let running_state = &app.running_state_or_please_retry()?;

        let reqs = reqs.into_inner();

        let mut resp: HashMap<handle::Handle, api::auths::AttrKeyResp> =
            HashMap::with_capacity(reqs.len());

        let now = api::NumericDate::now();

        for (handle, req) in reqs.into_iter() {
            let attr: attr::Attr = match req
                .attr
                .open(&running_state.attr_signing_key, None) // TODO: constellation 
                {
                    Err(api::OpenError::OtherConstellation(..))
                            | Err(api::OpenError::InvalidSignature)
                            | Err(api::OpenError::Expired) => {
                        return Ok(api::auths::AttrKeysResp::RetryWithNewAttr(handle));
                            }
                    Err(api::OpenError::OtherwiseInvalid) => {
                        return Err(api::ErrorCode::BadRequest);
                    }
                    Err(api::OpenError::InternalError) => {
                        return Err(api::ErrorCode::InternalError);
                    }
                    Ok(attr) => attr
                };

            if !attr.identifying {
                log::debug!(
                    "attribute key denied for non-identifying attribute {value} of type {attr_type}",
                    value = attr.value,
                    attr_type = attr.attr_type
                );
                return Err(api::ErrorCode::BadRequest);
            }

            let timestamps: Vec<api::NumericDate> = if let Some(timestamp) = req.timestamp {
                if timestamp > now {
                    log::warn!(
                        "future attribute key requested for attribute {value} of type {attr_type}",
                        value = attr.value,
                        attr_type = attr.attr_type
                    );
                    return Err(api::ErrorCode::BadRequest);
                }

                vec![timestamp, now]
            } else {
                vec![now]
            };

            let mut attr_keys: Vec<Vec<u8>> =
                phcrypto::auths_attr_keys(attr, app.attr_key_secret.as_slice(), timestamps);

            let latest_key: Vec<u8> = attr_keys.pop().unwrap();
            let old_key: Option<Vec<u8>> = attr_keys.pop();

            assert!(attr_keys.is_empty());

            resp.insert(
                handle.clone(),
                api::auths::AttrKeyResp {
                    latest_key: (serde_bytes::ByteBuf::from(latest_key).into(), now),
                    old_key: old_key.map(|old_key| serde_bytes::ByteBuf::from(old_key).into()),
                },
            )
            .map_or(Ok(()), |_| {
                log::debug!("double handle in attribute keys request: {handle}");
                Err(api::ErrorCode::BadRequest)
            })?;
        }

        Ok(api::auths::AttrKeysResp::Success(resp))
    }
}
