use crate::config::having_debug_default;
use crate::data::DataCommands;
use crate::oauth::AuthCommands;
use anyhow::{anyhow, Context, Result};
use expry::BytecodeVec;
use hairy::hairy_compile_html;
use hyper::header::HeaderValue;
use hyper::{Body, Request};
use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::path::PathBuf;
use tokio::sync::mpsc::Sender;
use tokio::sync::{mpsc, oneshot};

pub struct Main {
    pub url: String,

    pub admins: HashSet<String>,
    pub admin_api_key: HeaderValue,
    pub cookie_secret: String,

    pub db_tx: Sender<DataCommands>,
    pub auth_tx: Sender<AuthCommands>,

    pub static_assets: crate::serve::StaticAssets,
    pub translations: HashMap<String, HashMap<String, String>>,
    pub hair: BytecodeVec,

    pub irma: Irma,
    pub pep: crate::pseudonyms::PepContext,
}

impl Main {
    pub async fn create(config: crate::config::File) -> Result<Self> {
        // Make a database actor mpsc channel
        let (db_tx, db_rx) = mpsc::channel(1_000);

        if let Some(ref path) = config.database_location {
            crate::data::make_database_manager(&config.interpret_path(path), db_rx);
        } else {
            crate::data::make_in_memory_database_manager(db_rx);
        }

        crate::policy::initialize_latest_policy(
            &db_tx,
            config.interpret_path(&config.policy_directory),
        )
        .await
        .context("setting up the policy failed")?;

        let (auth_tx, auth_rx) = mpsc::channel(1_000);
        crate::oauth::make_auth_manager(auth_rx, db_tx.clone());

        let path_interpreter = config.path_interpreter();

        Ok(Self {
            url: config
                .determine_url()
                .await
                .context("resolving pubhubs host failed")?,

            pep: crate::pseudonyms::PepContext::from_config(config.pep)?,
            irma: Irma::from_config(config.irma, &path_interpreter)
                .context("failed to load irma configuration")?,

            admins: config.admins,
            admin_api_key: HeaderValue::from_str(&having_debug_default(
                config.admin_api_key,
                "api_key",
                "admin_api_key",
            )?)
            .context("admin_api_key contains invalid characters")?,

            cookie_secret: having_debug_default(
                config.cookie_secret,
                "default_cookie_secret",
                "cookie_secret",
            )?,

            // Use our hair template containing also the sub-templates.
            hair: hairy_compile_html(
                &std::fs::read_to_string(path_interpreter(&config.templates_file))
                    .context("reading templates failed")?,
                "main.tmpl",
                None,
                0,
            )
            // since String does not implement StdErr, we must convert
            // manually to an anyhow::Error
            .map_err(|errmsg: String| anyhow!(errmsg))?,

            static_assets: crate::serve::StaticAssets::from_dir(path_interpreter(
                &config.assets_directory,
            ))
            .context("loading static assets failed")?,

            translations: crate::translate::load_translations(&path_interpreter(
                &config.translations_directory,
            ))
            .context("loading translations failed")?,

            db_tx,
            auth_tx,
        })
    }

    pub async fn is_admin_request(&self, req: &Request<Body>) -> bool {
        // a request is considered an admin request when either
        // the admin_api_key has been sent along in the X-Admin-API-Key header
        // or the user (authenticated by the session cookie) is an admin

        if let Some(supposed_admin_api_key) = req.headers().get("X-Admin-API-Key") {
            return supposed_admin_api_key == self.admin_api_key;
        }

        if let Some(id) = crate::cookie::user_id_from_verified_cookie(req, &self.cookie_secret) {
            let (tx, rx) = oneshot::channel();
            self.db_tx
                .send(crate::data::DataCommands::GetUserById {
                    resp: tx,
                    id: id as u32,
                })
                .await
                .unwrap();
            let user = rx.await.unwrap().unwrap();
            return user.administrator;
        }
        false
    }
}

pub struct Irma {
    pub server_url: String,
    pub client_url: String,
    pub requestor: String,
    pub requestor_hmac_key: Vec<u8>,
    pub server_issuer: String,
    pub server_key: jsonwebtoken::DecodingKey,
}

impl Irma {
    fn from_config(config: crate::config::Irma, pi: impl Fn(&str) -> PathBuf) -> Result<Self> {
        let server_key_file = having_debug_default(
            config.server_key_file,
            "../docker_irma/jwt.pub",
            "irma.server_key_file",
        )?;

        // pi interprets server key file's location relative to
        // the configuration file's location
        let server_key_file = pi(&server_key_file);

        let mut buff: Vec<u8> = vec![];

        let mut f = std::fs::File::open(server_key_file)?;
        f.read_to_end(&mut buff)?;

        let server_key = jsonwebtoken::DecodingKey::from_rsa_pem(&buff)?;

        Ok(Self {
            client_url: config
                .client_url
                .unwrap_or_else(|| config.server_url.clone()),
            server_url: config.server_url,
            requestor: config.requestor,
            requestor_hmac_key: base64::decode(having_debug_default(
                config.requestor_hmac_key,
                "aXJtYV9yZXF1ZXN0b3Jfa2V5", // base64.encodebytes(b"irma_requestor_key")
                "irma.requestor_hmac_key",
            )?)
            .context("expected base64-encoded irma requestor hmac key")?,
            server_issuer: config.server_issuer,
            server_key,
        })
    }
}
