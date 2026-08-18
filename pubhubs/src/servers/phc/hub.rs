//! Hub endpoints
use std::rc::Rc;

use actix_web::web;
use base64ct::{Base64UrlUnpadded, Encoding as _};
use serde::Serialize;

use crate::api::ApiResultExt as _;
use crate::api::OpenError;
use crate::api::{self, NoPayload};
use crate::handle::Handle;
use crate::misc::jwt;
use crate::servers::config::phc::push as push_config;

use super::server::*;
use api::phc::hub::*;

/// PHC's centrally-held Firebase service account, parsed once at startup, used to mint
/// short-lived FCM credentials for hubs (see [`App::mint_fcm_push_credential`]).
#[derive(Clone)]
pub(super) struct FcmCredentialSource {
    pub(super) signing_key: jwt::RS256Sk,
    pub(super) client_email: String,
    pub(super) token_validity: core::time::Duration,
}

impl FcmCredentialSource {
    pub(super) fn from_config(config: &push_config::FcmConfig) -> anyhow::Result<Self> {
        Ok(Self {
            signing_key: jwt::RS256Sk::from_pkcs8_pem(&config.private_key)?,
            client_email: config.client_email.clone(),
            token_validity: config.token_validity,
        })
    }
}

/// PHC's centrally-held APNs auth key, parsed once at startup, used to mint short-lived APNs
/// provider authentication tokens for hubs (see [`App::mint_apns_push_credential`]).
#[derive(Clone)]
pub(super) struct ApnsCredentialSource {
    pub(super) signing_key: jwt::ES256Sk,
    pub(super) key_id: String,
    pub(super) team_id: String,
    pub(super) token_validity: core::time::Duration,
}

impl ApnsCredentialSource {
    pub(super) fn from_config(config: &push_config::ApnsConfig) -> anyhow::Result<Self> {
        Ok(Self {
            signing_key: jwt::ES256Sk::from_pkcs8_pem(&config.private_key)?,
            key_id: config.key_id.clone(),
            team_id: config.team_id.clone(),
            token_validity: config.token_validity,
        })
    }
}

/// Assembles and signs a compact JWT with the given `header` and `claims`.
///
/// [`jwt::JWT::create`] always emits header `{"alg":...}` and nothing else, which suits
/// pubhubs' own internal signing format but not third-party services like Google and Apple,
/// which expect additional header fields (`"typ"`, `"kid"`).  This is a thin, self-contained
/// alternative that reuses only the cryptographic [`jwt::SigningKey::sign`] step from [`jwt`].
fn sign_external_jwt<SK: jwt::SigningKey>(
    header: &impl Serialize,
    claims: &impl Serialize,
    key: &SK,
) -> anyhow::Result<String> {
    let to_be_signed = format!(
        "{}.{}",
        Base64UrlUnpadded::encode_string(&serde_json::to_vec(header)?),
        Base64UrlUnpadded::encode_string(&serde_json::to_vec(claims)?)
    );
    let signature = key.sign(to_be_signed.as_bytes())?;
    Ok(format!(
        "{to_be_signed}.{}",
        Base64UrlUnpadded::encode_string(signature.as_ref())
    ))
}

impl App {
    pub(super) async fn handle_hub_ticket(
        app: Rc<Self>,
        signed_req: web::Json<api::Signed<TicketReq>>,
    ) -> api::Result<TicketResp> {
        let signed_req = signed_req.into_inner();

        let req = signed_req
            .clone()
            .open_without_checking_signature()
            .map_err(|oe| {
                log::debug!("received invalid ticket request: {oe}");

                match oe {
                    OpenError::OtherConstellation(..)
                    | OpenError::InternalError
                    | OpenError::InvalidSignature => api::ErrorCode::InternalError,
                    OpenError::OtherwiseInvalid | OpenError::Expired => api::ErrorCode::BadRequest,
                }
            })?;

        let Some(hub) = app.shared.hubs.get(&req.handle) else {
            return Ok(TicketResp::UnknownHub);
        };

        let resp = app
            .client
            .query::<api::hub::InfoEP>(&hub.url, NoPayload)
            .await
            .into_server_result()?;

        let Some(verifying_key) = resp.verifying_key else {
            return Ok(TicketResp::NoVerifyingKey);
        };

        let Ok(hub_verifying_key) = verifying_key.decode() else {
            log::warn!("hub {} returned a malformed verifying key", req.handle);
            return Err(api::ErrorCode::BadRequest);
        };

        // check that the request indeed came from the hub
        signed_req.open(&hub_verifying_key, None).map_err(|oe| {
            log::warn!(
                "could not verify authenticity of hub ticket request for hub {}: {oe}",
                req.handle,
            );

            match oe {
                OpenError::OtherConstellation(..) | OpenError::InternalError => {
                    api::ErrorCode::InternalError
                }
                OpenError::OtherwiseInvalid | OpenError::Expired | OpenError::InvalidSignature => {
                    api::ErrorCode::BadRequest
                }
            }
        })?;

        // if so, hand out ticket
        Ok(TicketResp::Success(api::Signed::new(
            &app.shared.signing_key,
            &TicketContent {
                handle: req.handle,
                verifying_key,
            },
            std::time::Duration::from_secs(3600 * 24), /* = one day */
        )?))
    }

    /// Implements [`api::server::HubPingEP`].
    pub(super) async fn handle_hub_ping(
        app: Rc<Self>,
        signed_req: web::Json<TicketSigned<api::server::PingReq>>,
    ) -> api::Result<api::server::PingResp> {
        crate::servers::AppBase::<Server>::handle_hub_ping(app, signed_req).await
    }

    /// Implements [`PushCredentialsEP`].
    pub(super) async fn handle_hub_push_credentials(
        app: Rc<Self>,
        signed_req: web::Json<TicketSigned<PushCredentialsReq>>,
    ) -> api::Result<PushCredentialsResp> {
        // PHC signs its own tickets (see `handle_hub_ticket` above), so it verifies them with
        // its own verifying key - unlike `handle_hub_ping`, which is shared code also used by
        // the transcryptor and authentication server, and so uses the `phc_verifying_key` they
        // learn of via the constellation instead.
        let (req, hub_handle) =
            match signed_req
                .into_inner()
                .open(app.shared.signing_key.verifying_key())
            {
                Ok(opened) => opened,
                Err(toe) => return toe.default_verdict(PushCredentialsResp::RetryWithNewTicket),
            };

        match req.platform {
            PushPlatform::Fcm => app.mint_fcm_push_credential(&hub_handle).await,
            PushPlatform::Apns => app.mint_apns_push_credential(&hub_handle),
        }
    }

    /// Mints a short-lived FCM HTTP v1 OAuth2 access token from PHC's centrally-held Firebase
    /// service account, via the standard service-account JWT-bearer flow (RFC 7523).
    ///
    /// See [`PushCredentialsEP`]'s docs for why hubs request this from PHC instead of holding
    /// the service account themselves.
    async fn mint_fcm_push_credential(&self, hub_handle: &Handle) -> api::Result<PushCredentialsResp> {
        let Some(fcm) = &self.push_fcm else {
            return Ok(PushCredentialsResp::NotConfigured);
        };

        #[derive(Serialize)]
        struct Claims<'a> {
            iss: &'a str,
            scope: &'a str,
            aud: &'a str,
            iat: u64,
            exp: u64,
        }

        let now = jwt::get_current_timestamp();

        let assertion = sign_external_jwt(
            &serde_json::json!({"alg": "RS256", "typ": "JWT"}),
            &Claims {
                iss: &fcm.client_email,
                scope: "https://www.googleapis.com/auth/firebase.messaging",
                aud: "https://oauth2.googleapis.com/token",
                iat: now,
                exp: now + fcm.token_validity.as_secs(),
            },
            &fcm.signing_key,
        )
        .map_err(|err| {
            log::error!("failed to sign FCM OAuth2 assertion for hub {hub_handle}: {err:#}");
            api::ErrorCode::InternalError
        })?;

        let send_result = self
            .client
            .http_client()
            .post("https://oauth2.googleapis.com/token")
            .send_form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
                ("assertion", assertion.as_str()),
            ])
            .await;

        let mut resp = send_result.map_err(|err| {
            log::warn!("requesting FCM access token for hub {hub_handle} failed: {err}");
            api::ErrorCode::PleaseRetry
        })?;

        if !resp.status().is_success() {
            log::error!(
                "Google rejected PHC's FCM OAuth2 assertion for hub {hub_handle}: {}",
                resp.status()
            );
            return Err(api::ErrorCode::InternalError);
        }

        #[derive(serde::Deserialize)]
        struct TokenResp {
            access_token: String,
            expires_in: u64,
        }

        let token_resp: TokenResp = resp.json().await.map_err(|err| {
            log::error!("could not parse Google's FCM token response for hub {hub_handle}: {err}");
            api::ErrorCode::InternalError
        })?;

        log::info!("minted FCM push credential for hub {hub_handle}");

        Ok(PushCredentialsResp::Success(PushCredentials {
            token: token_resp.access_token,
            expires: api::NumericDate::now().add_clamp(token_resp.expires_in),
        }))
    }

    /// Mints a short-lived APNs provider authentication token from PHC's centrally-held APNs
    /// auth key.  Unlike FCM, no round-trip to Apple is needed: the signed JWT itself is the
    /// bearer token APNs accepts directly.
    fn mint_apns_push_credential(&self, hub_handle: &Handle) -> api::Result<PushCredentialsResp> {
        let Some(apns) = &self.push_apns else {
            return Ok(PushCredentialsResp::NotConfigured);
        };

        #[derive(Serialize)]
        struct Claims<'a> {
            iss: &'a str,
            iat: u64,
        }

        let token = sign_external_jwt(
            &serde_json::json!({"alg": "ES256", "kid": apns.key_id}),
            &Claims {
                iss: &apns.team_id,
                iat: jwt::get_current_timestamp(),
            },
            &apns.signing_key,
        )
        .map_err(|err| {
            log::error!("failed to sign APNs provider token for hub {hub_handle}: {err:#}");
            api::ErrorCode::InternalError
        })?;

        log::info!("minted APNs push credential for hub {hub_handle}");

        Ok(PushCredentialsResp::Success(PushCredentials {
            token,
            expires: api::NumericDate::now().add_clamp(apns.token_validity.as_secs()),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_external_jwt_roundtrips_and_has_the_given_header() {
        let sk = jwt::RS256Sk::random(2048).unwrap();

        let header = serde_json::json!({"alg": "RS256", "typ": "JWT", "kid": "test-key"});
        let claims = serde_json::json!({"iss": "phc-test", "iat": 1_700_000_000u64});

        let compact = sign_external_jwt(&header, &claims, &sk).unwrap();

        let parts: Vec<&str> = compact.split('.').collect();
        assert_eq!(parts.len(), 3, "a compact JWT has exactly two dots");

        // the header we asked for round-trips exactly - in particular, unlike jwt::JWT::create,
        // it is not collapsed down to just `{"alg":...}`.
        let decoded_header: serde_json::Value =
            serde_json::from_slice(&Base64UrlUnpadded::decode_vec(parts[0]).unwrap()).unwrap();
        assert_eq!(decoded_header, header);

        let decoded_claims: serde_json::Value =
            serde_json::from_slice(&Base64UrlUnpadded::decode_vec(parts[1]).unwrap()).unwrap();
        assert_eq!(decoded_claims, claims);

        // the signature is over exactly "header.claims" (the first two parts), verifiable with
        // the corresponding public key.
        use jwt::VerifyingKey as _;
        let pk = jwt::RS256Vk::new(sk.as_rsa_pub().clone());
        let signed_part = format!("{}.{}", parts[0], parts[1]);
        let signature = Base64UrlUnpadded::decode_vec(parts[2]).unwrap();
        assert!(pk.is_valid_signature(signed_part.as_bytes(), signature));
    }

    #[test]
    fn credential_sources_parse_from_config() {
        use p256::pkcs8::EncodePrivateKey as _;

        let rsa_sk = jwt::RS256Sk::random(2048).unwrap();
        let fcm_config = push_config::FcmConfig {
            client_email: "sygnal@example-project.iam.gserviceaccount.com".to_string(),
            private_key: rsa_sk.to_pkcs8_pem().unwrap().to_string(),
            token_validity: core::time::Duration::from_secs(3600),
        };
        let fcm = FcmCredentialSource::from_config(&fcm_config).unwrap();
        assert_eq!(fcm.client_email, fcm_config.client_email);

        let ec_sk = p256::ecdsa::SigningKey::random(&mut rsa::rand_core::OsRng);
        let apns_config = push_config::ApnsConfig {
            key_id: "ABC123DEFG".to_string(),
            team_id: "TEAM123456".to_string(),
            private_key: ec_sk.to_pkcs8_pem(Default::default()).unwrap().to_string(),
            token_validity: core::time::Duration::from_secs(3000),
        };
        let apns = ApnsCredentialSource::from_config(&apns_config).unwrap();
        assert_eq!(apns.key_id, apns_config.key_id);
        assert_eq!(apns.team_id, apns_config.team_id);

        // wrong key type for the platform (an RSA key where APNs needs EC P-256) must be
        // rejected at parse time, not silently accepted.
        let mismatched = push_config::ApnsConfig {
            private_key: rsa_sk.to_pkcs8_pem().unwrap().to_string(),
            ..apns_config
        };
        assert!(ApnsCredentialSource::from_config(&mismatched).is_err());
    }
}
