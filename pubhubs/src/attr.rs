//! Attributes, for identifying (and/or banning) end-users

use crate::common::secret;
use crate::handle::Handles;
use crate::id::Id;

use digest::Digest as _;

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
pub struct Type {
    /// Immutable
    id: Id,

    /// For referring to this attribute type from code - only add handles; don't remove them
    handles: Handles,

    /// Whether [`Attr`]ibutes of this type can used to ban users.  Users must provide such a
    /// bannable attribute.
    bannable: bool,

    /// Whether [`Attr`]ibutes of this type can be used to identify a users.
    identifying: bool,

    /// Details on how  users can obtain this attribute, e.g. via Yivi.
    source: AttrSource,
}

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
pub enum AttrSource {
    Yivi {
        credential_id: String,
        attr_ids: Vec<String>,
    },
}

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
pub struct Attr {
    /// Refers to the this attribute's [`attr::Type`] via the type's `[Id]`.
    attr_type: Id,

    /// The user, if any, that this attribute can identify.
    ///
    /// Only identifies the user if the user lists this attribute among its [`Id::id_attributes`].
    ///
    /// Once set, this should never be unset.  This prevents impersonation of a user when
    /// they remove their id.
    #[serde(default)]
    may_identify_user: Option<Id>,

    /// The users that provided this attribute as bannable attribute.
    /// If this attribute gets banned, so will they.
    #[serde(default)]
    bans_users: Vec<Id>,

    /// Whether this attribute has been banned.
    #[serde(default)]
    banned: bool,

    /// Actual value of this attribute, in a format that is [`attr::Type`] dependent.
    value: String,
}

impl Attr {
    /// Derives an identifier for this attribute from [`Attr.value`] and [`Attr.attr_type`],
    /// and the given digestible secret.
    fn id(&self, secret: impl secret::DigestibleSecret) -> Id {
        let bytes: [u8; 32] = secret
            .derive_bytes(
                sha2::Sha256::new()
                    .chain_update(self.attr_type.as_slice())
                    .chain_update(secret::encode_usize(self.value.len()))
                    .chain_update(self.value.as_bytes()),
                "pubhubs-attr-id",
            )
            .try_into()
            .expect("sha256 did not yield 32 bytes");

        bytes.into()
    }
}
