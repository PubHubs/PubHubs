//! A [`Bomb`] runs a callback when dropped, unless it is [`defuse`](Bomb::defuse)d first.

/// Runs `f` when dropped — like [`defer`](crate::misc::defer()) — unless it has been
/// [`defuse`](Bomb::defuse)d first.
///
/// Handy for "do this *unless* we get there cleanly": arm the bomb, then [`defuse`](Bomb::defuse)
/// it on every success path, so `f` runs only when the bomb is dropped early — e.g. an owning task is
/// cancelled, or a `?`/panic unwinds past it.
///
/// For the common "this *must* happen before drop, or it is a bug" case, see [`Bomb::panic`].
#[must_use = "a Bomb fires at once unless bound to a variable"]
pub struct Bomb<F: FnOnce()> {
    callback: Option<F>,
}

impl<F: FnOnce()> Bomb<F> {
    /// Arms a bomb that runs `f` when dropped.
    pub fn new(f: F) -> Self {
        Self { callback: Some(f) }
    }

    /// Defuses the bomb so `f` will not run (dropping `f`, and so releasing whatever it captured).
    pub fn defuse(&mut self) {
        self.callback = None;
    }
}

impl Bomb<Box<dyn FnOnce()>> {
    /// Arms a bomb that logs `msg` and then panics when dropped (unless the thread is already
    /// panicking) — i.e. asserts that the bomb is [`defuse`](Bomb::defuse)d before it is dropped.
    pub fn panic(msg: impl FnOnce() -> String + 'static) -> Self {
        Self::new(Box::new(move || {
            let message = msg();

            log::error!("{message}");

            if !std::thread::panicking() {
                panic!("{message}");
            }
        }))
    }
}

impl<F: FnOnce()> Drop for Bomb<F> {
    fn drop(&mut self) {
        if let Some(f) = self.callback.take() {
            f();
        }
    }
}
