//! [oidc::Handler] implementation for pubhubs, using Yivi.
use std::sync::{Arc, Weak};

use crate::{
    context,
    hairy_ext::hairy_eval_html_custom_by_val as hairy_eval_html_custom,
    oidc::{self, http::actix_support::CompleteRequest},
};

pub struct Handler {
    // Since an instance of [Handler] will (via [oidc::OidcImpl]) be part of [context::Main],
    // using an Arc here (instead of Weak)  would create a cycle,
    // preventing context from being dropped.
    //
    //  TODO: when context::Main becomes thread-local, replace Arc by Rc.
    context: Weak<context::Main>,
}

impl Handler {
    pub fn new(context: &Weak<context::Main>) -> Handler {
        Handler {
            context: context.clone(),
        }
    }

    /// Obtains a strong reference to context, panics if the context is already dropped.
    fn context(&self) -> Arc<context::Main> {
        self.context.upgrade().expect("context already dropped")
    }
}

/// Additional data for [Handler]
pub struct AD {
    pub translations: crate::translate::Translations,
}

impl oidc::Handler for Handler {
    type Req<'r> = CompleteRequest;
    type Resp = anyhow::Result<actix_web::HttpResponse>;
    type AdditionalData<'r> = AD;

    fn handle_auth<'r>(
        &self,
        _req: Self::Req<'r>,
        auth_request_handle: String,
        client_id: oidc::ClientId,
        ad: Self::AdditionalData<'r>,
    ) -> Self::Resp {
        use expry::key_str; // used by expry::value!

        let context = self.context();

        let hub_name: String = client_id.bare_id().to_string();

        let prefix = ad.translations.prefix().to_string();
        let data = expry::value!( {
            "oidc_auth_request_handle": auth_request_handle,
            "content": "authenticate",
            "url_prefix": prefix,
            "hub_name": hub_name
        })
        .to_vec(false);

        Ok(actix_web::HttpResponse::Ok().body(
            hairy_eval_html_custom(context.hair.to_ref(), data.to_ref(), ad.translations)
                .map_err(|e| anyhow::anyhow!(e))?,
        ))
    }
}
