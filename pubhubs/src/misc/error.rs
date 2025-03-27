/// An opaque error.  Useful for crypto operations that do not wish to leak
/// any information via error details.
#[derive(thiserror::Error, Debug)]
pub enum Opaque {
    #[error("opaque error")]
    Error,
}

/// An opaque error
pub const OPAQUE: Opaque = Opaque::Error;
