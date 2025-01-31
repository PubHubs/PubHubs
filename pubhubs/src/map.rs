use crate::handle::Handle;
use crate::id::Id;

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
        case_id: impl FnOnce(&Id) -> T,
        case_handle: impl FnOnce(&Handle) -> T,
    ) -> T {
        case_handle(self)
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
            |id| self.value_by_id.get(&id),
            |handle| self.value_by_id.get(self.id_by_handle.get(&handle)?),
        )
    }

    /// Inserts `value` into [`Map`] unless its `id` or one of its `handle`s is already
    /// present in the map.  In that case the `id` or one of the conflicting handles is returned.
    pub fn insert_new(&mut self, value: T) -> Option<HandleOrId> {
        let id: Id = *value.id();

        // before inserting anything check for duplicates
        if self.value_by_id.contains_key(&id) {
            return Some(id.into());
        }

        for handle in value.handles() {
            if self.id_by_handle.contains_key(&handle) {
                return Some(handle.clone().into());
            }
        }

        for handle in value.handles() {
            assert!(self.id_by_handle.insert(handle.clone(), id).is_none());
        }

        assert!(self.value_by_id.insert(id, value).is_none());

        return None;
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
    fn fmt(&self, mut f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self {
            HandleOrId::Handle(ref handle) => handle.fmt(&mut f),
            HandleOrId::Id(ref id) => id.fmt(&mut f),
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
