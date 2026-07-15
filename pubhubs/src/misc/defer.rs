//! Implementation of [`defer`]

/// Defers the execution of `f` until the return value is dropped.
#[must_use]
pub fn defer(f: impl FnOnce()) -> impl Drop {
    crate::misc::drop_ext::Bomb::new(f)
}
