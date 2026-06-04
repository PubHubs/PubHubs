/// An opaque error.  Useful for crypto operations that do not wish to leak
/// any information via error details.
///
/// Deliberately does NOT implement [`std::error::Error`]: the blanket [`From`] below
/// would otherwise collide with std's `impl<T> From<T> for T`.  Same trick as
/// [`anyhow::Error`](https://docs.rs/anyhow/latest/anyhow/struct.Error.html).
#[derive(Debug)]
pub enum Opaque {
    Error,
}

/// An opaque error
pub const OPAQUE: Opaque = Opaque::Error;

impl<E> From<E> for Opaque
where
    E: std::error::Error,
{
    fn from(_: E) -> Self {
        OPAQUE
    }
}
