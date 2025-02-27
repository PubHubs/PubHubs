//! Attributes, for identifying (and/or banning) end-users

use crate::common::secret;
use crate::handle::{Handle, Handles};
use crate::id::Id;

use digest::Digest as _;

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
pub struct Type {
    /// Immutable
    pub id: Id,

    /// For referring to this attribute type from code - only add handles; don't remove them
    pub handles: Handles,

    /// Whether [`Attr`]ibutes of this type can be used to ban users.  Users must provide such a
    /// bannable attribute.
    pub bannable: bool,

    /// Whether [`Attr`]ibutes of this type can be used to identify a users.
    pub identifying: bool,

    /// The different ways this attribute can be obtained
    pub sources: Vec<SourceDetails>,
}

impl std::fmt::Display for Type {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.handles.preferred())
    }
}

/// Instructions on how to obtain an [`Attr`]ibute of a particular [`Type`].
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum SourceDetails {
    Yivi {
        /// The yivi attribute type identifier
        attr_type_id: String,
    },
}

impl SourceDetails {
    pub fn source(&self) -> Source {
        match &self {
            SourceDetails::Yivi { .. } => Source::Yivi,
        }
    }
}

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    Yivi,
}

impl crate::map::Handled for Type {
    fn handles(&self) -> &[Handle] {
        &self.handles
    }

    fn id(&self) -> &Id {
        &self.id
    }
}

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
pub struct Attr {
    /// Refers to the this attribute's [`attr::Type`] via the type's `[Id]`.
    attr_type: Id,

    /// Actual value of this attribute, in a format that is [`attr::Type`] dependent.
    value: String,
}

impl Attr {
    /// Derives an identifier for this attribute from [`Attr.value`] and [`Attr.attr_type`],
    /// and the given digestible secret.
    #[expect(dead_code)]
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

/// State of an [Attr] according to pubhubs central.
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
pub struct AttrState {
    attr: Id,

    /// Whether this attribute has been banned.
    #[serde(default)]
    banned: bool,

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
}
