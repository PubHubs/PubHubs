//! Push notifications to the app, sent by PHC for hubs.
//!
//! The app puts its device's push token (or UnifiedPush endpoint), encrypted for PHC, in each hub's
//! Matrix pusher: a fresh "blob" per hub, together with a random tag per hub.  A hub relays the blob
//! through the transcryptor ([`api::tr::PushEP`]), which forwards it to PHC ([`SendEP`]) without
//! saying which hub it came from.  PHC decrypts it and sends a push carrying only the tag, which
//! the app maps back to the hub.  So:
//!
//! - hubs only see random blobs, so they can't link their users by push token;
//! - PHC sees push tokens and tags, but not which hubs they belong to;
//! - the transcryptor sees which hub sends a blob, but can't read it;
//! - only Apple's and Google's credentials, held by PHC, can push to iOS and Play builds.
//!
//! See also docs/app/push.md.
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::Arc;

use actix_web::web;
use aws_lc_rs::{aead, agreement, hkdf, rand as lc_rand, signature};
use base64ct::{Base64, Base64UrlUnpadded, Encoding as _};
use serde::Deserialize;

use crate::api;
use crate::common::secret::DigestibleSecret as _;
use crate::misc::jwt::{self, SigningKey as _};
use crate::servers::config::phc::push::{ApnsConfig, FcmConfig, PushConfig};

use api::phc::push::*;
use api::tr::{MAX_PUSHES_PER_REQ, Push, PushResp};

use super::server::App;

/// Version byte of the blob format, see [`BlobKey::open`].
const BLOB_VERSION: u8 = 1;

/// HKDF info prefix for blobs; must match global-client/src/logic/pushBlob.ts.
const BLOB_INFO: &[u8] = b"pubhubs push blob v1";

/// How long a push may wait at Apple, Google or the UnifiedPush server for an offline device.
const PUSH_TTL_SECS: u64 = 24 * 60 * 60;

/// The string keys of the generic notification, in the app's own strings (iOS:
/// ios/App/App/*.lproj/Localizable.strings; Android shows it itself, see LocalNotifier.java).
const TITLE_LOC_KEY: &str = "push_notification_title";
const BODY_LOC_KEY: &str = "push_notification_body";

/// Where a blob says to push to, and the tag to send.  Must match pushBlob.ts.
#[derive(Deserialize, Debug)]
#[serde(tag = "transport", rename_all = "snake_case")]
enum Target {
    /// iOS: a hex APNs device token.
    Apns { token: String, tag: String },

    /// Android Play build: an FCM registration token.
    Fcm { token: String, tag: String },

    /// Android F-Droid build: a UnifiedPush (Web Push) endpoint and the device's message
    /// encryption keys (RFC 8291), all base64url.
    Webpush {
        endpoint: String,
        p256dh: String,
        auth: String,
        tag: String,
    },
}

impl Target {
    fn tag(&self) -> &str {
        match self {
            Target::Apns { tag, .. } | Target::Fcm { tag, .. } | Target::Webpush { tag, .. } => tag,
        }
    }
}

/// What happened to one push.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Outcome {
    Delivered,

    /// The blob or the device's token is no good, and never will be.
    Rejected,

    /// Try again later.
    Failed,
}

/// PHC's P-256 key the app encrypts its blobs for.
pub(super) struct BlobKey {
    private: agreement::PrivateKey,

    /// Uncompressed point.
    public: Vec<u8>,
}

impl BlobKey {
    fn new(scalar: &[u8]) -> anyhow::Result<Self> {
        let private = agreement::PrivateKey::from_private_key(&agreement::ECDH_P256, scalar)
            .map_err(|err| anyhow::anyhow!("invalid P-256 scalar: {err}"))?;
        let public = private
            .compute_public_key()
            .map_err(|_| anyhow::anyhow!("computing P-256 public key"))?
            .as_ref()
            .to_vec();
        Ok(Self { private, public })
    }

    /// Changes whenever the key does.
    fn id(&self) -> String {
        use sha2::Digest as _;
        Base64UrlUnpadded::encode_string(&sha2::Sha256::digest(&self.public)[..12])
    }

    /// Decrypts a blob: `version (1) ‖ ephemeral public key (65) ‖ iv (12) ‖ AES-256-GCM
    /// ciphertext and tag`, with the AES key derived by HKDF-SHA256 (empty salt) from the ECDH
    /// secret, with info [`BLOB_INFO`] ‖ ephemeral public key ‖ [`Self::public`].
    fn open(&self, blob: &str) -> Option<Vec<u8>> {
        let mut bytes = Base64UrlUnpadded::decode_vec(blob).ok()?;
        if bytes.len() < 1 + 65 + 12 + 16 || bytes[0] != BLOB_VERSION {
            return None;
        }
        let (header, ciphertext) = bytes.split_at_mut(1 + 65 + 12);
        let ephemeral = &header[1..66];
        let iv = &header[66..];

        let mut key = [0u8; 32];
        agreement::agree(
            &self.private,
            agreement::UnparsedPublicKey::new(&agreement::ECDH_P256, ephemeral),
            (),
            |secret| {
                hkdf_into(&[], secret, &[BLOB_INFO, ephemeral, &self.public], &mut key);
                Ok(())
            },
        )
        .ok()?;

        let key = aead::LessSafeKey::new(aead::UnboundKey::new(&aead::AES_256_GCM, &key).ok()?);
        let nonce = aead::Nonce::try_assume_unique_for_key(iv).ok()?;
        let plaintext = key
            .open_in_place(nonce, aead::Aad::empty(), ciphertext)
            .ok()?;
        Some(plaintext.to_vec())
    }

    /// Encrypts like the app does, for tests.
    #[cfg(test)]
    fn seal(public: &[u8], plaintext: &[u8]) -> String {
        let ephemeral = agreement::PrivateKey::generate(&agreement::ECDH_P256).unwrap();
        let ephemeral_public = ephemeral.compute_public_key().unwrap().as_ref().to_vec();
        let mut key = [0u8; 32];
        agreement::agree(
            &ephemeral,
            agreement::UnparsedPublicKey::new(&agreement::ECDH_P256, public),
            (),
            |secret| {
                hkdf_into(
                    &[],
                    secret,
                    &[BLOB_INFO, &ephemeral_public, public],
                    &mut key,
                );
                Ok(())
            },
        )
        .unwrap();
        let iv: [u8; 12] = crate::misc::crypto::random_32_bytes()[..12]
            .try_into()
            .unwrap();
        let key = aead::LessSafeKey::new(aead::UnboundKey::new(&aead::AES_256_GCM, &key).unwrap());
        let mut in_out = plaintext.to_vec();
        key.seal_in_place_append_tag(
            aead::Nonce::assume_unique_for_key(iv),
            aead::Aad::empty(),
            &mut in_out,
        )
        .unwrap();
        let mut blob = vec![BLOB_VERSION];
        blob.extend_from_slice(&ephemeral_public);
        blob.extend_from_slice(&iv);
        blob.extend_from_slice(&in_out);
        Base64UrlUnpadded::encode_string(&blob)
    }
}

/// HKDF-SHA256, writing `out.len()` bytes.
fn hkdf_into(salt: &[u8], ikm: &[u8], info: &[&[u8]], out: &mut [u8]) {
    struct Len(usize);
    impl hkdf::KeyType for Len {
        fn len(&self) -> usize {
            self.0
        }
    }
    hkdf::Salt::new(hkdf::HKDF_SHA256, salt)
        .extract(ikm)
        .expand(info, Len(out.len()))
        .and_then(|okm| okm.fill(out))
        .expect("HKDF output length is small");
}

/// A P-256 scalar derived from `seed`, so it stays the same across restarts.
fn derive_p256_scalar(seed: &[u8], domain: &str) -> Vec<u8> {
    (0u32..)
        .map(|i| {
            seed.derive_bytes(
                <sha2::Sha256 as sha2::Digest>::new(),
                format!("{domain}-{i}"),
            )
        })
        .find(|bytes| agreement::PrivateKey::from_private_key(&agreement::ECDH_P256, bytes).is_ok())
        .expect("a random 32 byte string is a valid P-256 scalar with overwhelming probability")
}

/// An ES256 key with its uncompressed public point.
fn es256_key(scalar: &[u8]) -> anyhow::Result<signature::EcdsaKeyPair> {
    let public = BlobKey::new(scalar)?.public;
    signature::EcdsaKeyPair::from_private_key_and_public_key(
        &signature::ECDSA_P256_SHA256_FIXED_SIGNING,
        scalar,
        &public,
    )
    .map_err(|err| anyhow::anyhow!("invalid ES256 key: {err}"))
}

/// A compact JWS, with whatever header the other side wants.
fn compact_jwt(
    header: &serde_json::Value,
    claims: &serde_json::Value,
    sign: impl FnOnce(&[u8]) -> anyhow::Result<Vec<u8>>,
) -> anyhow::Result<String> {
    let to_be_signed = format!(
        "{}.{}",
        Base64UrlUnpadded::encode_string(&serde_json::to_vec(header)?),
        Base64UrlUnpadded::encode_string(&serde_json::to_vec(claims)?)
    );
    let signature = sign(to_be_signed.as_bytes())?;
    Ok(format!(
        "{to_be_signed}.{}",
        Base64UrlUnpadded::encode_string(&signature)
    ))
}

fn es256_sign(key: &signature::EcdsaKeyPair, message: &[u8]) -> anyhow::Result<Vec<u8>> {
    Ok(key
        .sign(&lc_rand::SystemRandom::new(), message)
        .map_err(|_| anyhow::anyhow!("ES256 signing failed"))?
        .as_ref()
        .to_vec())
}

/// The DER inside a PEM file.
fn pem_to_der(pem: &str) -> anyhow::Result<Vec<u8>> {
    let b64: String = pem
        .lines()
        .map(str::trim)
        .filter(|line| !line.starts_with("-----"))
        .collect();
    Base64::decode_vec(&b64).map_err(|err| anyhow::anyhow!("invalid PEM: {err}"))
}

pub(super) struct Apns {
    key: signature::EcdsaKeyPair,
    config: ApnsConfig,
}

pub(super) struct Fcm {
    key: jwt::RS256Sk,
    config: FcmConfig,
}

/// PHC's push keys and credentials, shared by all apps.
pub(super) struct PushKeys {
    blob_key: BlobKey,
    vapid_key: signature::EcdsaKeyPair,
    apns: Option<Apns>,
    fcm: Option<Fcm>,
}

impl PushKeys {
    /// `seed` is PHC's `enc_key`: if it changes, the blob key changes, and the app registers again.
    pub(super) fn new(seed: &[u8], config: &PushConfig) -> anyhow::Result<Arc<Self>> {
        let apns = config
            .apns
            .as_ref()
            .map(|config| -> anyhow::Result<Apns> {
                Ok(Apns {
                    key: signature::EcdsaKeyPair::from_private_key_der(
                        &signature::ECDSA_P256_SHA256_FIXED_SIGNING,
                        &pem_to_der(&config.private_key)?,
                    )
                    .map_err(|err| anyhow::anyhow!("APNs key is not a P-256 key: {err}"))?,
                    config: config.clone(),
                })
            })
            .transpose()
            .map_err(|err| err.context("parsing phc.push.apns"))?;

        let fcm = config
            .fcm
            .as_ref()
            .map(|config| -> anyhow::Result<Fcm> {
                Ok(Fcm {
                    key: jwt::RS256Sk::from_pkcs8_pem(&config.private_key)?,
                    config: config.clone(),
                })
            })
            .transpose()
            .map_err(|err| err.context("parsing phc.push.fcm"))?;

        Ok(Arc::new(Self {
            blob_key: BlobKey::new(&derive_p256_scalar(seed, "pubhubs-phc-push-blob-key"))?,
            vapid_key: es256_key(&derive_p256_scalar(seed, "pubhubs-phc-push-vapid-key"))?,
            apns,
            fcm,
        }))
    }
}

/// Per-app push state: the keys, plus tokens cached for a while.
pub(super) struct PushState {
    keys: Arc<PushKeys>,

    /// Without redirects: UnifiedPush endpoints come from devices.
    http: awc::Client,

    /// APNs provider token and when it was made.  Apple wants it reused for 20 to 60 minutes.
    apns_token: RefCell<Option<(String, u64)>>,

    /// FCM OAuth2 access token and when it expires.
    fcm_token: RefCell<Option<(String, u64)>>,

    /// `sub` of VAPID tokens: how push services can reach PubHubs.
    vapid_subject: String,
}

impl PushState {
    pub(super) fn new(keys: Arc<PushKeys>, global_client_url: &url::Url) -> Self {
        Self {
            keys,
            http: awc::Client::builder()
                .disable_redirects()
                .timeout(std::time::Duration::from_secs(10))
                .finish(),
            apns_token: RefCell::new(None),
            fcm_token: RefCell::new(None),
            vapid_subject: if global_client_url.scheme() == "https" {
                global_client_url.as_str().trim_end_matches('/').to_string()
            } else {
                "mailto:contact@pubhubs.net".to_string()
            },
        }
    }

    async fn deliver(&self, push: &Push) -> Outcome {
        let Some(plaintext) = self.keys.blob_key.open(&push.blob) else {
            log::debug!("push: could not decrypt a blob");
            return Outcome::Rejected;
        };
        let target: Target = match serde_json::from_slice(&plaintext) {
            Ok(target) => target,
            Err(err) => {
                log::debug!("push: blob has no valid target: {err}");
                return Outcome::Rejected;
            }
        };
        let tag = target.tag();
        if tag.is_empty()
            || tag.len() > 64
            || !tag
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        {
            log::debug!("push: blob has an invalid tag");
            return Outcome::Rejected;
        }

        let result = match &target {
            Target::Apns { token, tag } => self.send_apns(token, tag).await,
            Target::Fcm { token, tag } => self.send_fcm(token, tag, push.high_prio).await,
            Target::Webpush {
                endpoint,
                p256dh,
                auth,
                tag,
            } => {
                self.send_webpush(endpoint, p256dh, auth, tag, push.high_prio)
                    .await
            }
        };
        result.unwrap_or_else(|err| {
            log::warn!("push: sending failed: {err:#}");
            Outcome::Failed
        })
    }

    fn apns_token(&self, apns: &Apns) -> anyhow::Result<String> {
        let now = jwt::get_current_timestamp();
        if let Some((token, made)) = &*self.apns_token.borrow()
            && now < made + 40 * 60
        {
            return Ok(token.clone());
        }
        let token = compact_jwt(
            &serde_json::json!({"alg": "ES256", "kid": apns.config.key_id}),
            &serde_json::json!({"iss": apns.config.team_id, "iat": now}),
            |msg| es256_sign(&apns.key, msg),
        )?;
        *self.apns_token.borrow_mut() = Some((token.clone(), now));
        Ok(token)
    }

    async fn send_apns(&self, token: &str, tag: &str) -> anyhow::Result<Outcome> {
        let Some(apns) = &self.keys.apns else {
            anyhow::bail!("no APNs credentials configured (phc.push.apns)");
        };
        if token.is_empty() || token.len() > 200 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Ok(Outcome::Rejected);
        }
        let host = if apns.config.sandbox {
            "api.sandbox.push.apple.com"
        } else {
            "api.push.apple.com"
        };
        let body = serde_json::json!({
            "aps": {
                "alert": {"title-loc-key": TITLE_LOC_KEY, "loc-key": BODY_LOC_KEY},
                "sound": "default",
            },
            "tag": tag,
        });
        let mut resp = self
            .http
            .post(format!("https://{host}/3/device/{token}"))
            .insert_header((
                "authorization",
                format!("bearer {}", self.apns_token(apns)?),
            ))
            .insert_header(("apns-topic", apns.config.topic.as_str()))
            .insert_header(("apns-push-type", "alert"))
            // Always urgent: iOS may hold back non-urgent alerts for a long time.
            .insert_header(("apns-priority", "10"))
            .insert_header((
                "apns-expiration",
                (jwt::get_current_timestamp() + PUSH_TTL_SECS).to_string(),
            ))
            .send_json(&body)
            .await
            .map_err(|err| anyhow::anyhow!("APNs: {err}"))?;

        let status = resp.status();
        if status.is_success() {
            return Ok(Outcome::Delivered);
        }
        let reason = resp
            .json::<serde_json::Value>()
            .await
            .ok()
            .and_then(|v| v["reason"].as_str().map(str::to_owned))
            .unwrap_or_default();
        match (status.as_u16(), reason.as_str()) {
            (410, _) | (400, "BadDeviceToken" | "DeviceTokenNotForTopic") => Ok(Outcome::Rejected),
            (403, _) => {
                self.apns_token.replace(None);
                anyhow::bail!("APNs refused our provider token: {reason}")
            }
            _ => anyhow::bail!("APNs answered {status} {reason}"),
        }
    }

    async fn fcm_token(&self, fcm: &Fcm) -> anyhow::Result<String> {
        let now = jwt::get_current_timestamp();
        if let Some((token, expires)) = &*self.fcm_token.borrow()
            && now + 5 * 60 < *expires
        {
            return Ok(token.clone());
        }
        let assertion = compact_jwt(
            &serde_json::json!({"alg": "RS256", "typ": "JWT"}),
            &serde_json::json!({
                "iss": fcm.config.client_email,
                "scope": "https://www.googleapis.com/auth/firebase.messaging",
                "aud": "https://oauth2.googleapis.com/token",
                "iat": now,
                "exp": now + 3600,
            }),
            |msg| Ok(fcm.key.sign(msg)?.as_ref().to_vec()),
        )?;

        #[derive(Deserialize)]
        struct TokenResp {
            access_token: String,
            expires_in: u64,
        }
        let mut resp = self
            .http
            .post("https://oauth2.googleapis.com/token")
            .send_form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
                ("assertion", assertion.as_str()),
            ])
            .await
            .map_err(|err| anyhow::anyhow!("Google OAuth: {err}"))?;
        if !resp.status().is_success() {
            anyhow::bail!(
                "Google refused PHC's FCM service account: {}",
                resp.status()
            );
        }
        let token: TokenResp = resp.json().await?;
        *self.fcm_token.borrow_mut() = Some((token.access_token.clone(), now + token.expires_in));
        Ok(token.access_token)
    }

    async fn send_fcm(&self, token: &str, tag: &str, high_prio: bool) -> anyhow::Result<Outcome> {
        let Some(fcm) = &self.keys.fcm else {
            anyhow::bail!("no FCM credentials configured (phc.push.fcm)");
        };
        if token.is_empty() || token.len() > 4096 {
            return Ok(Outcome::Rejected);
        }
        // Data only: the app shows the notification itself (LocalNotifier.java), as for UnifiedPush.
        let body = serde_json::json!({
            "message": {
                "token": token,
                "data": {"tag": tag},
                "android": {
                    "priority": if high_prio { "HIGH" } else { "NORMAL" },
                    "ttl": format!("{PUSH_TTL_SECS}s"),
                },
            }
        });
        let mut resp = self
            .http
            .post(format!(
                "https://fcm.googleapis.com/v1/projects/{}/messages:send",
                fcm.config.project_id
            ))
            .bearer_auth(self.fcm_token(fcm).await?)
            .send_json(&body)
            .await
            .map_err(|err| anyhow::anyhow!("FCM: {err}"))?;

        let status = resp.status();
        if status.is_success() {
            return Ok(Outcome::Delivered);
        }
        let error = String::from_utf8_lossy(&resp.body().await.unwrap_or_default()).into_owned();
        match status.as_u16() {
            404 => Ok(Outcome::Rejected),
            400 if error.contains("UNREGISTERED") || error.contains("registration token") => {
                Ok(Outcome::Rejected)
            }
            401 => {
                self.fcm_token.replace(None);
                anyhow::bail!("FCM refused our access token")
            }
            _ => anyhow::bail!("FCM answered {status}: {error}"),
        }
    }

    async fn send_webpush(
        &self,
        endpoint: &str,
        p256dh: &str,
        auth: &str,
        tag: &str,
        high_prio: bool,
    ) -> anyhow::Result<Outcome> {
        let Some(origin) = webpush_origin(endpoint) else {
            return Ok(Outcome::Rejected);
        };
        let (Ok(ua_public), Ok(auth)) = (
            Base64UrlUnpadded::decode_vec(p256dh.trim_end_matches('=')),
            Base64UrlUnpadded::decode_vec(auth.trim_end_matches('=')),
        ) else {
            return Ok(Outcome::Rejected);
        };
        if ua_public.len() != 65 || auth.len() != 16 {
            return Ok(Outcome::Rejected);
        }

        let payload = serde_json::to_vec(&serde_json::json!({"tag": tag}))?;
        let as_private = agreement::PrivateKey::generate(&agreement::ECDH_P256)
            .map_err(|_| anyhow::anyhow!("generating P-256 key"))?;
        let salt: [u8; 16] = crate::misc::crypto::random_32_bytes()[..16].try_into()?;
        let Some(body) = webpush_encrypt(&as_private, &salt, &ua_public, &auth, &payload) else {
            return Ok(Outcome::Rejected);
        };

        let vapid = compact_jwt(
            &serde_json::json!({"typ": "JWT", "alg": "ES256"}),
            &serde_json::json!({
                "aud": origin,
                "exp": jwt::get_current_timestamp() + 12 * 60 * 60,
                "sub": self.vapid_subject,
            }),
            |msg| es256_sign(&self.keys.vapid_key, msg),
        )?;
        use signature::KeyPair as _;
        let vapid_public =
            Base64UrlUnpadded::encode_string(self.keys.vapid_key.public_key().as_ref());

        let resp = self
            .http
            .post(endpoint)
            .insert_header((
                "authorization",
                format!("vapid t={vapid}, k={vapid_public}"),
            ))
            .insert_header(("content-encoding", "aes128gcm"))
            .insert_header(("content-type", "application/octet-stream"))
            .insert_header(("ttl", PUSH_TTL_SECS.to_string()))
            .insert_header(("urgency", if high_prio { "high" } else { "normal" }))
            .send_body(body)
            .await
            .map_err(|err| anyhow::anyhow!("Web Push to {origin}: {err}"))?;

        match resp.status().as_u16() {
            200..=299 => Ok(Outcome::Delivered),
            404 | 410 => Ok(Outcome::Rejected),
            status => anyhow::bail!("Web Push to {origin} answered {status}"),
        }
    }
}

/// The origin (for VAPID's `aud`) of a UnifiedPush endpoint, or `None` if PHC shouldn't post to
/// it: these come from devices, so only https to a named host on the default port, never to
/// localhost or an IP address.
fn webpush_origin(endpoint: &str) -> Option<String> {
    if endpoint.len() > 2048 {
        return None;
    }
    let url = url::Url::parse(endpoint).ok()?;
    if url.scheme() != "https" || url.port().is_some() || !url.username().is_empty() {
        return None;
    }
    let url::Host::Domain(host) = url.host()? else {
        return None;
    };
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    if !host.contains('.')
        || host == "localhost"
        || [".localhost", ".local", ".internal", ".lan", ".home.arpa"]
            .iter()
            .any(|suffix| host.ends_with(suffix))
    {
        return None;
    }
    Some(format!("https://{host}"))
}

/// Encrypts a Web Push message (RFC 8291, `aes128gcm` content encoding of RFC 8188, one record).
fn webpush_encrypt(
    as_private: &agreement::PrivateKey,
    salt: &[u8; 16],
    ua_public: &[u8],
    auth: &[u8],
    plaintext: &[u8],
) -> Option<Vec<u8>> {
    let as_public = as_private.compute_public_key().ok()?.as_ref().to_vec();

    let mut ikm = [0u8; 32];
    agreement::agree(
        as_private,
        agreement::UnparsedPublicKey::new(&agreement::ECDH_P256, ua_public),
        (),
        |ecdh_secret| {
            hkdf_into(
                auth,
                ecdh_secret,
                &[b"WebPush: info\0", ua_public, &as_public],
                &mut ikm,
            );
            Ok(())
        },
    )
    .ok()?;

    let mut cek = [0u8; 16];
    let mut nonce = [0u8; 12];
    hkdf_into(salt, &ikm, &[b"Content-Encoding: aes128gcm\0"], &mut cek);
    hkdf_into(salt, &ikm, &[b"Content-Encoding: nonce\0"], &mut nonce);

    let mut record = plaintext.to_vec();
    record.push(2); // padding delimiter of the last record
    aead::LessSafeKey::new(aead::UnboundKey::new(&aead::AES_128_GCM, &cek).ok()?)
        .seal_in_place_append_tag(
            aead::Nonce::assume_unique_for_key(nonce),
            aead::Aad::empty(),
            &mut record,
        )
        .ok()?;

    let mut body = Vec::with_capacity(16 + 4 + 1 + 65 + record.len());
    body.extend_from_slice(salt);
    body.extend_from_slice(&4096u32.to_be_bytes()); // record size
    body.push(as_public.len() as u8);
    body.extend_from_slice(&as_public);
    body.extend_from_slice(&record);
    Some(body)
}

impl App {
    /// Implements [`InfoEP`].
    pub(super) async fn handle_push_info(app: Rc<Self>) -> api::Result<InfoResp> {
        use signature::KeyPair as _;
        let keys = &app.push.keys;
        Ok(InfoResp {
            blob_key: Base64UrlUnpadded::encode_string(&keys.blob_key.public),
            blob_key_id: keys.blob_key.id(),
            vapid_key: Base64UrlUnpadded::encode_string(keys.vapid_key.public_key().as_ref()),
        })
    }

    /// Implements [`SendEP`].
    pub(super) async fn handle_push_send(
        app: Rc<Self>,
        req: web::Json<api::Sealed<SendReq>>,
    ) -> api::Result<SendResp> {
        let running_state = app.running_state_or_please_retry()?;
        let Ok(req) = req.into_inner().open(&running_state.t_sealing_secret) else {
            return Ok(SendResp::RetryWithNewSecret);
        };
        if req.pushes.len() > MAX_PUSHES_PER_REQ {
            return Err(api::ErrorCode::BadRequest);
        }

        let mut resp = PushResp::default();
        for (i, push) in req.pushes.iter().enumerate() {
            match app.push.deliver(push).await {
                Outcome::Delivered => {}
                Outcome::Rejected => resp.rejected.push(i),
                Outcome::Failed => resp.failed.push(i),
            }
        }
        Ok(SendResp::Success(resp))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_keys() -> Arc<PushKeys> {
        PushKeys::new(b"test seed", &PushConfig::default()).unwrap()
    }

    #[test]
    fn blob_roundtrip() {
        let keys = test_keys();
        let plaintext = br#"{"transport":"apns","token":"00ff","tag":"abc"}"#;
        let blob = BlobKey::seal(&keys.blob_key.public, plaintext);
        assert_eq!(keys.blob_key.open(&blob).unwrap(), plaintext);

        // Each blob is different, even for the same token: that's what keeps hubs from linking.
        assert_ne!(blob, BlobKey::seal(&keys.blob_key.public, plaintext));

        // Tampering, or another key, fails.
        let mut tampered = Base64UrlUnpadded::decode_vec(&blob).unwrap();
        *tampered.last_mut().unwrap() ^= 1;
        assert!(
            keys.blob_key
                .open(&Base64UrlUnpadded::encode_string(&tampered))
                .is_none()
        );
        let other = PushKeys::new(b"other seed", &PushConfig::default()).unwrap();
        assert!(other.blob_key.open(&blob).is_none());
        assert_ne!(keys.blob_key.id(), other.blob_key.id());
    }

    /// A blob made by global-client/src/logic/pushBlob.ts for the key of [`test_keys`].
    #[test]
    fn opens_blob_from_the_app() {
        let keys = test_keys();
        assert_eq!(
            Base64UrlUnpadded::encode_string(&keys.blob_key.public),
            "BLZMLX_8XOhUFE8dd02V9JSq2lggRK_rVZW_aHP8S_MUzU_6FDbpOPfjHMcAKMz1G8K-yrxXea3OtCEKDCa19LI"
        );
        let plaintext = keys
            .blob_key
            .open("AQRZDfa6AytsGvhT4rBzF0l1lTftGDz5sr_xxWzKf7MkTHwVMD6N5s0Pv4mDsFzGHEp_pApBnoAG5CEgzdcQ2qpuPMdfLTkBWDlsJDZkoyrayLM81q2lEozjqdJBizQ7I-adIfVyDmdMpsKVfWyw_lEU2yzcDr4piuXePWtyxBjmdhVwHrcT4XyraQQ505lnWzsVM6iKFrIE6k1q66-CGXSzfBYCYklFDzZLh4XLPcadZWyadWLHHy8gU5tTId3RYs1zqHk")
            .unwrap();
        let Target::Webpush { endpoint, tag, .. } = serde_json::from_slice(&plaintext).unwrap()
        else {
            panic!("expected a webpush target");
        };
        assert_eq!(endpoint, "https://ntfy.sh/upTEST");
        assert_eq!(tag, "tag-from-js");
    }

    #[test]
    fn keys_are_stable() {
        use signature::KeyPair as _;
        let (a, b) = (test_keys(), test_keys());
        assert_eq!(a.blob_key.public, b.blob_key.public);
        assert_eq!(
            a.vapid_key.public_key().as_ref(),
            b.vapid_key.public_key().as_ref()
        );
        assert_ne!(a.blob_key.public, a.vapid_key.public_key().as_ref());
        assert_eq!(a.blob_key.public.len(), 65);
    }

    #[test]
    fn targets_parse() {
        let target: Target = serde_json::from_str(
            r#"{"transport":"webpush","endpoint":"https://ntfy.sh/up1","p256dh":"x","auth":"y","tag":"t"}"#,
        )
        .unwrap();
        assert_eq!(target.tag(), "t");
        assert!(serde_json::from_str::<Target>(r#"{"transport":"sms","tag":"t"}"#).is_err());
    }

    #[test]
    fn webpush_origins() {
        assert_eq!(
            webpush_origin("https://ntfy.sh/upAbC?up=1").as_deref(),
            Some("https://ntfy.sh")
        );
        for bad in [
            "http://ntfy.sh/up",
            "https://localhost/up",
            "https://127.0.0.1/up",
            "https://[::1]/up",
            "https://ntfy.sh:8443/up",
            "https://intranet/up",
            "https://push.corp.internal/up",
            "https://user@ntfy.sh/up",
            "not a url",
        ] {
            assert_eq!(webpush_origin(bad), None, "{bad}");
        }
    }

    /// The example of RFC 8291, section 5.
    #[test]
    fn webpush_rfc8291_example() {
        let d = |s: &str| Base64UrlUnpadded::decode_vec(s).unwrap();
        let as_private = agreement::PrivateKey::from_private_key(
            &agreement::ECDH_P256,
            &d("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"),
        )
        .unwrap();
        let ua_public = d(
            "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
        );
        let auth = d("BTBZMqHH6r4Tts7J_aSIgg");
        let salt: [u8; 16] = d("DGv6ra1nlYgDCS1FRnbzlw").try_into().unwrap();

        let body = webpush_encrypt(
            &as_private,
            &salt,
            &ua_public,
            &auth,
            b"When I grow up, I want to be a watermelon",
        )
        .unwrap();
        assert_eq!(
            Base64UrlUnpadded::encode_string(&body),
            "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
        );
    }

    #[test]
    fn compact_jwt_signs_header_and_claims() {
        use aws_lc_rs::signature::{KeyPair as _, UnparsedPublicKey};
        let keys = test_keys();
        let token = compact_jwt(
            &serde_json::json!({"alg": "ES256", "kid": "K"}),
            &serde_json::json!({"iss": "T"}),
            |msg| es256_sign(&keys.vapid_key, msg),
        )
        .unwrap();
        let (signed, signature) = token.rsplit_once('.').unwrap();
        UnparsedPublicKey::new(
            &signature::ECDSA_P256_SHA256_FIXED,
            keys.vapid_key.public_key().as_ref(),
        )
        .verify(
            signed.as_bytes(),
            &Base64UrlUnpadded::decode_vec(signature).unwrap(),
        )
        .unwrap();
        let header = Base64UrlUnpadded::decode_vec(signed.split('.').next().unwrap()).unwrap();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&header).unwrap(),
            serde_json::json!({"alg": "ES256", "kid": "K"})
        );
    }
}
