use actix_web::http::header::{HeaderMap, HeaderValue};
use anyhow::{Context, Result, anyhow};
use expry::BytecodeVec;
use hairy::hairy_compile_html;

use std::collections::HashSet;
use std::io::Read;
use std::path::PathBuf;
use std::sync::Arc;

#[cfg(feature = "old")]
use std::ops::Deref as _;

use base64ct::{Base64, Encoding as _};
use http::header::AUTHORIZATION;
use prometheus::{CounterVec, HistogramOpts, HistogramVec, Opts, Registry};
use rand::distr::SampleString as _;
use subtle::ConstantTimeEq;
use tokio::sync::mpsc::Sender;
use tokio::sync::{mpsc, oneshot};

use crate::{
    config, config::having_debug_default, context, cookie::HttpRequestCookieExt as _,
    data::DataCommands, oidc, oidc_handler,
};

pub struct Main {
    pub url: Urls,
    pub bind_to: (Vec<String>, u16),
    pub connection_check_nonce: String,

    pub admins: HashSet<String>,
    pub allowed_embedding_contexts: Vec<String>,
    pub admin_api_key: HeaderValue,
    pub cookie_secret: String,
    pub metrics_key: String,

    pub db_tx: Sender<DataCommands>,

    pub translations: crate::translate::AllTranslations,
    pub hair: BytecodeVec,

    pub yivi: Yivi,
    pub pep: crate::pseudonyms::PepContext,
    pub oidc: oidc::OidcImpl<oidc_handler::Handler>,

    /// EdDSA private key used to sign the `id_token`s generated by OIDC.
    pub id_token_key: ed25519_dalek::SigningKey,

    pub registry: Registry,
    pub http_req_histogram: HistogramVec,
    pub http_req_status: CounterVec,

    /// content for /.well-known/openid-configuration
    pub well_known_openid_configuration: bytes::Bytes,
    /// content for /.well-known/jwks.json
    pub well_known_jwks_json: bytes::Bytes,
    // NB. We're using bytes::Bytes' instead of Strings, since the former are cheaply cloneable,
    //     and cloning is required for contructing an actix_web::HttpResponse.
    /// for a hotfix to #459
    pub static_files_conf: config::StaticFiles,
    pub hotfixes: config::Hotfixes,
}

#[derive(Clone)]
pub struct Urls {
    /// Where can the browser reach PubHubs Central?
    ///   e.g. http://localhost:8080/
    pub for_browser: url::Url,
    /// Where can a hub (possibly from within a docker container) reach PubHubs Central?
    ///   e.g. <http://host.docker.internal:8080/>
    pub for_hub: url::Url,
    /// Where can the Yivi App (possibly from another network) reach PubHubs Central?
    ///   e.g. http://1.2.3.4:8080/
    pub for_yivi_app: url::Url,
}

impl Main {
    pub async fn create(config: crate::config::File) -> Result<Arc<Self>> {
        //Set up metrics
        let registry = Registry::new();

        let http_req_histogram = HistogramVec::new(
            HistogramOpts::new(
                "http_request_duration_seconds",
                "The HTTP request latencies in seconds per resource.",
            ),
            &["handler"],
        )
        .context("Creating http_req_histogram failed")?;

        registry
            .register(Box::new(http_req_histogram.clone()))
            .context("Expected to register http_request_duration_seconds")?;

        let http_req_status = CounterVec::new(
            Opts::new("http_request_responses", "The response codes per resource."),
            &["handler", "response_code"],
        )
        .context("Creating http_req_status failed")?;

        registry
            .register(Box::new(http_req_status.clone()))
            .context("Expected to register http_req_status")?;

        let database_req_histogram = HistogramVec::new(
            HistogramOpts::new(
                "database_request_duration_seconds",
                "The database request latencies in seconds per handler.",
            )
            .buckets(
                ([
                    0.0001f64, 0.0005f64, 0.001f64, 0.0025f64, 0.005f64, 0.01f64, 0.025f64,
                    0.05f64, 0.1f64, 0.25f64, 0.5f64,
                ])
                .to_vec(),
            ),
            &["command"],
        )
        .context("Creating database_req_histogram failed")?;

        registry
            .register(Box::new(database_req_histogram.clone()))
            .context("Expected to register database_req_histogram")?;

        // Make a database actor mpsc channel
        let (db_tx, db_rx) = mpsc::channel(1_000);

        if let Some(ref path) = config.database_location {
            crate::data::make_database_manager(
                config.interpret_path(path),
                db_rx,
                database_req_histogram,
            );
        } else {
            crate::data::make_in_memory_database_manager(db_rx, database_req_histogram);
        }

        let path_interpreter = config.path_interpreter();

        let url: Urls = config
            .determine_urls()
            .context("determining URL for PubHubs Central failed")?;

        let pep = crate::pseudonyms::PepContext::from_config(config.pep)?;

        let yivi = Yivi::from_config(config.yivi, &path_interpreter)
            .context("failed to load yivi configuration")?;

        let admin_api_key = HeaderValue::from_str(&having_debug_default(
            config.admin_api_key,
            "api_key",
            "admin_api_key",
        )?)
        .context("admin_api_key contains invalid characters")?;

        let cookie_secret = having_debug_default(
            config.cookie_secret,
            "default_cookie_secret",
            "cookie_secret",
        )?;

        let connection_check_nonce = config
            .connection_check_nonce
            .unwrap_or_else(|| rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 16));

        let metrics_key =
            having_debug_default(config.metrics_key, "default_metrics_key", "metrics_key")?;

        // Use our hair template containing also the sub-templates.
        let hair = hairy_compile_html(
            &std::fs::read_to_string(path_interpreter(&config.templates_file))
                .context("reading templates failed")?,
            "main.tmpl",
            None,
            0,
        )
        // since String does not implement StdErr, we must convert
        // manually to an anyhow::Error
        .map_err(|errmsg: String| anyhow!(errmsg))?;

        let translations = crate::translate::AllTranslations::load(&path_interpreter(
            &config.translations_directory,
        ))
        .context("loading translations failed")?;

        let oidc_secret = having_debug_default(
            config.oidc_secret,
            crate::misc::serde_ext::bytes_wrapper::B64::new(serde_bytes::ByteBuf::from(
                b"default_oidc_secret".to_vec(),
            )),
            "oidc_secret",
        )?;

        let well_known_openid_configuration : bytes::Bytes = serde_json::to_string_pretty(&serde_json::json!({
            "issuer": url.for_hub.as_str(),
            // NB: we need to include response_mode=form_post in the authorization endpoint,
            //     because synapse can currently not be configured to include it
            "authorization_endpoint": url.for_browser.join("oidc/auth?response_mode=form_post")?.to_string(),
            "token_endpoint": url.for_hub.join("oidc/token")?.to_string(),
            "jwks_uri": url.for_hub.join(".well-known/jwks.json")?.to_string(),
            "response_types_supported": crate::oidc::RESPONSE_TYPES_SUPPORTED,
            "response_modes_supported": crate::oidc::RESPONSE_MODES_SUPPORTED,
            "scopes_supported": crate::oidc::SCOPES_SUPPORTED,
            "grant_types_supported": crate::oidc::GRANT_TYPES_SUPPORTED,
            "token_endpoint_auth_methods_supported": crate::oidc::TOKEN_ENDPOINT_AUTH_METHODS_SUPPORTED,
            // Each client (i.e. hub) gets a different "sub" for the same end-user,
            // see section 8 of OpenID Connect Core 1.0.
            "subject_types_supported": ["pairwise"], 
            // TODO: what does this signify?  Doesn't the OpenID provider (i.e. PubHubs)
            // simply choose what 'alg' to use?
            "id_token_signing_alg_values_supported": ["EdDSA"],
        }))?.into();

        // Compute contents of /.well-known/jwks.json,
        let id_token_key: ed25519_dalek::SigningKey = {
            let id_token_private_key: [u8; 32] =
                crate::crypto::derive_secret("id-token-key", &oidc_secret).into();
            ed25519_dalek::SigningKey::from_bytes(&id_token_private_key)
        };

        let well_known_jwks_json: bytes::Bytes =
            serde_json::to_string_pretty(&serde_json::json!({
                // See RFC8037 "CFRG Elliptic Curve Diffie-Hellman (ECDH) and Signatures in JSON Object
                // Signing and Encryption (JOSE)", and RFC7517 "JSON Web Key (JWK)".
                "keys": [
                    crate::jwt::SigningKey::jwk(&id_token_key),
                ]
            }))?
            .into_bytes()
            .into();

        Ok(Arc::new_cyclic(|wp: &std::sync::Weak<context::Main>| {
            let oidc = oidc::new(oidc_handler::Handler::new(wp), oidc_secret.deref());

            Self {
                url,
                bind_to: config.bind_to,
                connection_check_nonce,
                pep,
                yivi,
                admins: config.admins,
                allowed_embedding_contexts: config.allowed_embedding_contexts,
                admin_api_key,
                cookie_secret,
                metrics_key,
                hair,
                translations,
                db_tx,
                oidc,
                registry,
                http_req_histogram,
                http_req_status,
                well_known_openid_configuration,
                well_known_jwks_json,
                id_token_key,
                static_files_conf: config.static_files,
                hotfixes: config.hotfixes,
            }
        }))
    }

    pub fn is_metrics_request(&self, headers: &HeaderMap) -> bool {
        if let Some(possible_auth) = headers.get(AUTHORIZATION) {
            if let Ok(auth) = possible_auth.to_str() {
                if let Some(metrics_api_key) =
                    auth.trim().split(' ').collect::<Vec<&str>>()[..].last()
                {
                    return metrics_api_key
                        .as_bytes()
                        .ct_eq(self.metrics_key.as_bytes())
                        .into();
                }
            }
        };
        false
    }

    pub async fn is_admin_request(&self, req: &actix_web::HttpRequest) -> bool {
        // a request is considered an admin request when either
        // the admin_api_key has been sent along in the X-Admin-API-Key header
        // or the user (authenticated by the session cookie) is an admin

        if let Some(supposed_admin_api_key) = req.headers().get("X-Admin-API-Key") {
            return supposed_admin_api_key
                .as_bytes()
                .ct_eq(self.admin_api_key.as_bytes())
                .into();
        }

        if let Ok(Some(id)) = req.user_id_from_cookies(&self.cookie_secret) {
            let (tx, rx) = oneshot::channel();
            self.db_tx
                .send(crate::data::DataCommands::GetUserById { resp: tx, id })
                .await
                .unwrap();
            let user = rx.await.unwrap().unwrap();
            return user.administrator;
        }
        false
    }

    pub fn global_client_uri(&self) -> &str {
        "/client"
    }
}

pub struct Yivi {
    pub requestor_api_url: String,
    pub client_api_url: String,
    pub requestor: String,
    pub requestor_hmac_key: crate::jwt::HS256,
    pub server_issuer: String,
    pub server_key: jsonwebtoken::DecodingKey,
}

impl Yivi {
    fn from_config(config: crate::config::Yivi, pi: impl Fn(&str) -> PathBuf) -> Result<Self> {
        let server_key_file = having_debug_default(
            config.server_key_file,
            "../docker_yivi/jwt.pub",
            "yivi.server_key_file",
        )?;

        // pi interprets server key file's location relative to
        // the configuration file's location
        let server_key_file = pi(&server_key_file);

        let mut buff: Vec<u8> = vec![];

        let mut f = std::fs::File::open(server_key_file)?;
        f.read_to_end(&mut buff)?;

        let server_key = jsonwebtoken::DecodingKey::from_rsa_pem(&buff)?;

        Ok(Self {
            client_api_url: config
                .client_api_url
                .unwrap_or_else(|| config.requestor_api_url.clone()),
            requestor_api_url: config.requestor_api_url,
            requestor: config.requestor,
            requestor_hmac_key: crate::jwt::HS256(
                Base64::decode_vec(&having_debug_default(
                    config.requestor_hmac_key,
                    "aXJtYV9yZXF1ZXN0b3Jfa2V5", // base64.encodebytes(b"yivi_requestor_key")
                    "yivi.requestor_hmac_key",
                )?)
                .map_err(|e| anyhow!(e)) // because B64Error does not implement StdError
                .context("expected base64-encoded yivi requestor hmac key")?,
            ),

            server_issuer: config.server_issuer,
            server_key,
        })
    }
}
