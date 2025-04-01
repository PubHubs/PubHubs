//! [`Map`]: look up objects by their [`Id`] or [`Handle`].
use crate::handle::Handle;
use crate::id::Id;

/// Objects that have a unique [`Id`], and at least one [`Handle`].
pub trait Handled {
    fn handles(&self) -> &[Handle];
    fn id(&self) -> &Id;
}

pub trait AsHandleOrId {
    fn match_case<T>(
        &self,
        case_id: impl FnOnce(&Id) -> T,
        case_handle: impl FnOnce(&Handle) -> T,
    ) -> T;
}

impl AsHandleOrId for Handle {
    fn match_case<T>(
        &self,
        _case_id: impl FnOnce(&Id) -> T,
        case_handle: impl FnOnce(&Handle) -> T,
    ) -> T {
        case_handle(self)
    }
}

impl AsHandleOrId for Id {
    fn match_case<T>(
        &self,
        case_id: impl FnOnce(&Id) -> T,
        _case_handle: impl FnOnce(&Handle) -> T,
    ) -> T {
        case_id(self)
    }
}

#[derive(Clone)]
pub struct Map<T: Handled> {
    value_by_id: std::collections::HashMap<Id, T>,
    id_by_handle: std::collections::HashMap<Handle, Id>,
}

impl<T: Handled> Map<T> {
    pub fn get<Q>(&self, k: &Q) -> Option<&T>
    where
        Q: AsHandleOrId,
    {
        k.match_case::<Option<&T>>(
            |id| self.value_by_id.get(id),
            |handle| self.value_by_id.get(self.id_by_handle.get(handle)?),
        )
    }

    /// Inserts `value` into [`Map`] unless its `id` or one of its `handle`s is already
    /// present in the map.  In that case the `id` or one of the conflicting handles is returned.
    #[must_use]
    pub fn insert_new(&mut self, value: T) -> Option<HandleOrId> {
        let id: Id = *value.id();

        // before inserting anything check for duplicates
        if self.value_by_id.contains_key(&id) {
            return Some(id.into());
        }

        for handle in value.handles() {
            if self.id_by_handle.contains_key(handle) {
                return Some(handle.clone().into());
            }
        }

        for handle in value.handles() {
            assert!(self.id_by_handle.insert(handle.clone(), id).is_none());
        }

        assert!(self.value_by_id.insert(id, value).is_none());

        None
    }
}

// This cannot be derived using 'derive(Default)' without requiring that T: Default,
// which we neither want nor need.
impl<T: Handled> Default for Map<T> {
    fn default() -> Self {
        Map {
            value_by_id: Default::default(),
            id_by_handle: Default::default(),
        }
    }
}

pub enum HandleOrId {
    Handle(Handle),
    Id(Id),
}

impl std::fmt::Display for HandleOrId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self {
            HandleOrId::Handle(handle) => handle.fmt(f),
            HandleOrId::Id(id) => id.fmt(f),
        }
    }
}

impl From<Id> for HandleOrId {
    fn from(id: Id) -> Self {
        HandleOrId::Id(id)
    }
}

impl From<Handle> for HandleOrId {
    fn from(handle: Handle) -> Self {
        HandleOrId::Handle(handle)
    }
}
