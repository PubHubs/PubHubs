//! Telling hubs which of their users deleted their PubHubs account, see [`DeletedPseudonymsEP`].
use std::rc::Rc;

use actix_web::web;

use crate::api::{self, ApiResultExt as _};
use crate::servers::object_store::IfChanged;

use super::server::*;
use super::user_sso::hash_hub_pseudonym;
use api::phc::hub::*;

/// The pseudonyms deleted at all hubs, as kept in the object store.
///
/// A single object rather than one per hub, because PHC must not know which hub a pseudonym
/// belongs to; see [`api::tr::EhpsEP`].
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct DeletedPseudonyms {
    /// Ordered by [`DeletedPseudonym::deleted_at`], oldest first.
    pub entries: Vec<DeletedPseudonym>,
}

impl DeletedPseudonyms {
    /// The id of the one [`DeletedPseudonyms`] object.
    pub const OBJECT_ID: &str = "all";
}

impl App {
    /// Implements [`DeletedPseudonymsEP`].
    pub(super) async fn handle_hub_deleted_pseudonyms(
        app: Rc<Self>,
        req: web::Json<DeletedPseudonymsReq>,
    ) -> api::Result<DeletedPseudonymsResp> {
        let DeletedPseudonymsReq { since } = req.into_inner();

        let Some(deleted_pseudonyms) = app.deleted_pseudonyms().await? else {
            return Ok(DeletedPseudonymsResp::Success { deleted: vec![] });
        };

        // Entries past retention are only pruned on the next deletion, so filter them here too.
        let from = since
            .unwrap_or_default()
            .max(app.deleted_pseudonym_retention_start());

        Ok(DeletedPseudonymsResp::Success {
            deleted: deleted_pseudonyms
                .entries
                .iter()
                .filter(|entry| entry.deleted_at >= from)
                .cloned()
                .collect(),
        })
    }

    /// The deleted pseudonyms list, taken from [`App::cached_deleted_pseudonyms`] when the
    /// object store has no newer version.  `None` when nobody deleted their account yet.
    async fn deleted_pseudonyms(&self) -> api::Result<Option<Rc<DeletedPseudonyms>>> {
        // Not borrowed across the `await`: other requests to this app may use the cache meanwhile.
        let known = self
            .cached_deleted_pseudonyms
            .borrow()
            .as_ref()
            .map(|(_, version)| version.clone());

        match self
            .get_object_if_changed::<DeletedPseudonyms>(
                &DeletedPseudonyms::OBJECT_ID,
                known.as_ref(),
            )
            .await?
        {
            // Should the cache have changed in the meantime, it changed to a newer version.
            IfChanged::Unchanged => Ok(self
                .cached_deleted_pseudonyms
                .borrow()
                .as_ref()
                .map(|(deleted_pseudonyms, _)| deleted_pseudonyms.clone())),
            IfChanged::Changed(Some((deleted_pseudonyms, version))) => {
                let deleted_pseudonyms = Rc::new(deleted_pseudonyms);
                self.cached_deleted_pseudonyms
                    .replace(Some((deleted_pseudonyms.clone(), version)));
                Ok(Some(deleted_pseudonyms))
            }
            IfChanged::Changed(None) => {
                self.cached_deleted_pseudonyms.replace(None);
                Ok(None)
            }
        }
    }

    /// Lists the user's hashed pseudonym at every hub as deleted, for [`DeletedPseudonymsEP`].
    ///
    /// Every hub, not just the ones the user entered: we do not know those, and listing only
    /// some would tell each of them where else the user had been.
    ///
    /// Returns `Ok(false)` when other deletions kept getting in the way; the caller should have
    /// the client retry.  Nothing is listed then.
    pub(super) async fn list_deleted_pseudonyms(
        &self,
        user_state: &super::UserState,
    ) -> api::Result<bool> {
        let hashed_hub_pseudonyms = self.hashed_hub_pseudonyms(user_state).await?;

        if hashed_hub_pseudonyms.is_empty() {
            return Ok(true);
        }

        if !self.add_deleted_pseudonyms(hashed_hub_pseudonyms).await? {
            log::info!(
                "could not list deleted pseudonyms of account {}: \
                the list kept changing from under us",
                user_state.id
            );
            return Ok(false);
        }

        Ok(true)
    }

    /// The user's hashed pseudonym at every hub, in an order that does not tell which hub each
    /// belongs to.  Made the way the global client makes one via [`api::phc::user::PppEP`],
    /// [`api::tr::EhppEP`] and [`api::phc::user::HhppEP`], but via [`api::tr::EhpsEP`] instead, so
    /// that we do not learn the hubs.
    async fn hashed_hub_pseudonyms(
        &self,
        user_state: &super::UserState,
    ) -> api::Result<Vec<api::CurvePoint>> {
        let running_state = self.running_state_or_please_retry()?;

        let hubs: Vec<crate::id::Id> = self.shared.hubs.values().map(|hub| hub.id).collect();

        if hubs.is_empty() {
            return Ok(vec![]);
        }

        let resp = self
            .client
            .query::<api::tr::EhpsEP>(
                &self.transcryptor_url,
                api::tr::EhpsReq {
                    hubs: hubs.clone(),
                    ppp: self.seal_ppp(user_state, running_state)?,
                },
            )
            .await
            .into_server_result()?;

        let api::tr::EhpsResp::Success(ehps) = resp else {
            // We sealed the ppp just now, so only a change of sealing key in between explains this.
            return Err(api::ErrorCode::PleaseRetry);
        };

        let Ok(api::sso::EncryptedHubPseudonymsPackage {
            encrypted_hub_pseudonyms,
        }) = ehps.open(&running_state.t_sealing_secret)
        else {
            return Err(api::ErrorCode::PleaseRetry);
        };

        if encrypted_hub_pseudonyms.len() != hubs.len() {
            log::error!(
                "transcryptor returned {} hub pseudonyms for {} hubs",
                encrypted_hub_pseudonyms.len(),
                hubs.len()
            );
            return Err(api::ErrorCode::InternalError);
        }

        encrypted_hub_pseudonyms
            .into_iter()
            .map(|encrypted_hub_pseudonym| {
                let Some(hub_pseudonym) =
                    encrypted_hub_pseudonym.decrypt_and_check_pk(&self.master_enc_key_part)
                else {
                    log::error!("transcryptor encrypted hub pseudonym for the wrong public key");
                    return Err(api::ErrorCode::InternalError);
                };

                Ok(hash_hub_pseudonym(&hub_pseudonym))
            })
            .collect()
    }

    /// Adds `hashed_hub_pseudonyms` to the list, all at once, pruning entries past retention on
    /// the way.  Returns `Ok(false)` when the list kept changing from under us.
    async fn add_deleted_pseudonyms(
        &self,
        hashed_hub_pseudonyms: Vec<api::CurvePoint>,
    ) -> api::Result<bool> {
        const MAX_ATTEMPTS: usize = 5;

        for _ in 0..MAX_ATTEMPTS {
            let (mut deleted_pseudonyms, version) = match self
                .get_object::<DeletedPseudonyms>(&DeletedPseudonyms::OBJECT_ID)
                .await?
            {
                Some((deleted_pseudonyms, version)) => (deleted_pseudonyms, Some(version)),
                None => (DeletedPseudonyms { entries: vec![] }, None),
            };

            let retention_start = self.deleted_pseudonym_retention_start();
            deleted_pseudonyms.entries.retain(|entry| {
                entry.deleted_at >= retention_start
                    && !hashed_hub_pseudonyms.contains(&entry.hashed_hub_pseudonym)
            });

            // Never before the last entry: a hub asks for everything since the latest
            // `deleted_at` it saw, so an entry stamped earlier than one it already got - by a
            // deletion that read the clock first but wrote last - would never reach it.
            let deleted_at = deleted_pseudonyms
                .entries
                .last()
                .map_or(api::NumericDate::now(), |last| {
                    last.deleted_at.max(api::NumericDate::now())
                });

            deleted_pseudonyms
                .entries
                .extend(hashed_hub_pseudonyms.iter().map(|hashed_hub_pseudonym| {
                    DeletedPseudonym {
                        hashed_hub_pseudonym: hashed_hub_pseudonym.clone(),
                        deleted_at,
                    }
                }));

            if let Some(version) = self
                .put_object::<DeletedPseudonyms>(&deleted_pseudonyms, version)
                .await?
            {
                // Saves the next poll at this app a get.
                self.cached_deleted_pseudonyms
                    .replace(Some((Rc::new(deleted_pseudonyms), version)));
                return Ok(true);
            }
        }

        Ok(false)
    }

    /// Entries deleted before this moment are forgotten.
    fn deleted_pseudonym_retention_start(&self) -> api::NumericDate {
        api::NumericDate::now().sub_clamp(self.deleted_pseudonym_retention.as_secs())
    }
}
