//! Tools for (de)serialization
use base64ct::{Base64, Encoding as _};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// Wrapper around `Vec<u8>` that serializes as base64.
/// ```
/// use serde::{Serialize, Deserialize};
/// use pubhubs::serde_ext::B64;
///
/// #[derive(Serialize,Deserialize)]
/// struct Data {
///     data: B64,
/// }
///
/// let d = Data{data: b"hello!".into()};
///
/// let s = serde_json::to_string(&d).unwrap();
///
/// assert_eq!(s, r#"{"data":"aGVsbG8h"}"#);
///
/// assert_eq!(serde_json::from_str::<Data>(&s).unwrap().data, d.data);
///
/// ```
#[derive(PartialEq, Eq, Debug)]
pub struct B64 {
    inner: Vec<u8>,
}

impl From<Vec<u8>> for B64 {
    fn from(v: Vec<u8>) -> Self {
        B64 { inner: v }
    }
}

impl<const N: usize> From<&[u8; N]> for B64 {
    fn from(v: &[u8; N]) -> Self {
        Vec::<u8>::from(v.as_slice()).into()
    }
}

impl AsRef<[u8]> for B64 {
    fn as_ref(&self) -> &[u8] {
        self
    }
}

impl std::ops::Deref for B64 {
    type Target = Vec<u8>;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl std::ops::DerefMut for B64 {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.inner
    }
}

impl Serialize for B64 {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&Base64::encode_string(self))
    }
}

impl<'de> Deserialize<'de> for B64 {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        Base64::decode_vec(&String::deserialize(d)?)
            .map_err(serde::de::Error::custom)
            .map(|v| v.into())
    }
}
