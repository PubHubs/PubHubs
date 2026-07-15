//! Implementation of [`defer`]

/// Defers the execution of `f` until the return value is dropped.
#[must_use]
pub fn defer(f: impl FnOnce()) -> impl Drop {
    Deferred { callback: Some(f) }
}

struct Deferred<F: FnOnce()> {
    callback: Option<F>,
}

impl<F: FnOnce()> Drop for Deferred<F> {
    fn drop(&mut self) {
        let f = self
            .callback
            .take()
            .expect("drop called twice, or `Deferred` initialized with `None`");
        f();
    }
}
