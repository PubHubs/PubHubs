//! [`Id`]s for PubHubs objects like [hub](crate::hub::BasicInfo)s and [attrbute
//! types](crate::attr::Type).
use crate::misc::serde_ext::{self, bytes_wrapper};

/// An identifier, a random 256-bit number, which is encoded
/// using unpadded url-safe base64
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(transparent)]
pub struct Id {
    inner: bytes_wrapper::B64UU<serde_ext::ByteArray<32>>,
}

impl Id {
    /// Creates a new random id
    pub fn random() -> Self {
        crate::misc::crypto::random_32_bytes().into()
    }

    /// Returns byte slice to underlying `[u8; 32]`.
    pub fn as_slice(&self) -> &[u8] {
        self.inner.as_slice()
    }
}

impl From<[u8; 32]> for Id {
    fn from(bytes: [u8; 32]) -> Self {
        Id {
            inner: serde_ext::ByteArray::<32>::from(bytes).into(),
        }
    }
}

impl core::str::FromStr for Id {
    type Err = <bytes_wrapper::B64UU<[u8; 32]> as core::str::FromStr>::Err;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(Id { inner: s.parse()? })
    }
}

impl std::fmt::Display for Id {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}", self.inner)
    }
}
