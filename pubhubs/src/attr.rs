//! Attributes, for identifying (and/or banning) end-users

use std::collections::HashSet;

use crate::common::secret;
use crate::handle::{Handle, Handles};
use crate::id::Id;
use crate::phcrypto;
use crate::servers::yivi;

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

    /// The different 'regular' ways this attribute can be obtained via [`crate::api::auths::AuthStartEP`].
    ///
    /// Some attributes, like the pubhubs card attribute, can also be obtained in irregular ways.
    pub sources: Vec<SourceDetails>,

    #[serde(default)]
    /// If set, an instance of this attribute obtained by [`crate::api::auths::AuthStartEP`] can not be
    /// added to a user account.  Pubhubs card attribute types have this flag set - to get an
    /// pubhubs card attribute instance that is addable, use [`crate::api::auths::CardEP`].
    pub not_addable_by_default: bool,
}

impl std::fmt::Display for Type {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.handles.preferred())
    }
}

impl Type {
    /// Iterates over all the [`yivi::AttributeTypeIdentifier`]s that can be used to obtain this
    /// attribite type.
    pub fn yivi_attr_type_ids(&self) -> impl Iterator<Item = &yivi::AttributeTypeIdentifier> {
        #[expect(clippy::unnecessary_filter_map)] // remove when we get more sources
        self.sources.iter().filter_map(|source| match source {
            SourceDetails::Yivi { attr_type_id } => Some(attr_type_id),
        })
    }

    /// Removes the [`SourceDetails`] from [`Source`]s not accepted by `accept_source`.
    pub(crate) fn filter_sources(&mut self, accept_source: impl Fn(Source) -> bool) {
        self.sources
            .retain(|source_details| accept_source(source_details.source()))
    }
}

/// Instructions on how to obtain an [`Attr`]ibute of a particular [`Type`].
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum SourceDetails {
    Yivi {
        /// The yivi attribute type identifier
        attr_type_id: yivi::AttributeTypeIdentifier,
    },
}

impl SourceDetails {
    pub fn source(&self) -> Source {
        match &self {
            SourceDetails::Yivi { .. } => Source::Yivi,
        }
    }
}

#[derive(serde::Deserialize, serde::Serialize, Hash, Debug, Clone, Copy, PartialEq, Eq)]
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
    /// Refers to the this attribute's [`Type`] via the type's [`Id`].
    #[serde(rename = "t")]
    pub attr_type: Id,

    /// Actual value of this attribute, in a format that is [`Type`] dependent.
    #[serde(rename = "v")]
    pub value: String,

    #[serde(skip_serializing_if = "std::ops::Not::not")]
    #[serde(default)]
    #[serde(rename = "b")]
    pub bannable: bool,

    /// Whether the attribute is not identifying.  We use the negation so that the default will be
    /// that the attribute _is_ identifying, which most attributes are.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    #[serde(default)]
    #[serde(rename = "n")]
    pub not_identifying: bool,

    /// Whether this particular attribute can _not_ be added to a user account.
    ///
    /// A pubhubs card attribute obtained via Yivi disclosure is not addable, for example.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    #[serde(default)]
    #[serde(rename = "a")]
    pub not_addable: bool,
}

impl Attr {
    /// Derives an identifier for this attribute from [`Attr::value`] and [`Attr::attr_type`],
    /// and the given digestible secret.
    pub fn id(&self, secret: impl secret::DigestibleSecret) -> Id {
        phcrypto::attr_id(self, secret)
    }
}

// So Signed<Attr> can be used.
crate::api::having_message_code! {Attr, Attr}

/// State of an [`Attr`] according to pubhubs central.
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
pub struct AttrState {
    pub attr: Id,

    /// Whether this attribute has been banned.
    #[serde(default)]
    pub banned: bool,

    /// The user, if any, that this attribute can identify.
    ///
    /// Only identifies the user if the user lists this attribute among its identifying attributes.
    ///
    /// Once set, this should never be unset.  This prevents impersonation of a user when
    /// they remove their id.
    #[serde(default)]
    pub may_identify_user: Option<Id>,

    // TODO: limit size of this set
    /// The users that provided this attribute as bannable attribute.
    /// If this attribute gets banned, so will they.
    #[serde(default)]
    pub bans_users: HashSet<Id>,
}

impl AttrState {
    pub fn new(attr_id: Id, attr: &Attr, user_id: Id) -> Self {
        Self {
            attr: attr_id,
            banned: false,
            may_identify_user: if attr.not_identifying {
                None
            } else {
                Some(user_id)
            },
            bans_users: if attr.bannable {
                std::iter::once(user_id).collect()
            } else {
                Default::default()
            },
        }
    }
}
