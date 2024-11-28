use crate::misc::serde_ext::{self, bytes_wrapper};
use rand::RngCore as _;

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
        let mut bytes: [u8; 32] = [0; 32];

        rand::rngs::OsRng::fill_bytes(&mut rand::rngs::OsRng, bytes.as_mut_slice());

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
