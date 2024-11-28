//! Attributes, for identifying (and/or banning) end-users

use crate::handle::Handles;
use crate::id::Id;

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
pub struct Type {
    /// Immutable
    id: Id,
    /// For referring to this attribute type from code - only add handles; don't remove them
    handles: Handles,
    bannable: bool,
    identifying: bool,

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
    attr_type: Id,

    /// The user, if any, that this attribute can identify.
    ///
    /// Only identifies the user if the user lists this attribute among its id_attributes.
    ///
    /// Once set, this should never be unset.  This prevents impersonation of a user when
    /// they remove their id.
    #[serde(default)]
    identifies_user: Option<Id>,

    /// The users that provided this attribute as bannable attribute.
    /// If this attribute gets banned, so will they.
    #[serde(default)]
    bans_users: Vec<Id>,

    /// Whether this attribute has been banned.
    #[serde(default)]
    banned: bool,

    /// Actual value of this attribute.
    value: String,
}

impl Attr {
    /// Derives an identifier for this attribute from [`Attr.value`] and [`Attr.attr_type`].
    fn id(&self) -> Id {
        /// TODO: should also take a secret to that the ID does not reveal private information
        todo! {}
    }
}
