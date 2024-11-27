//! Information about hubs
use core::cell::OnceCell;
use rand::RngCore as _;
use regex;

use crate::misc::serde_ext::{self, bytes_wrapper};

/// Basic details about hub, as provided by PubHubs Central.
#[derive(serde::Serialize, serde::Deserialize, Debug, Eq, PartialEq, Clone)]
#[serde(remote = "Self")]
// We use serde(remote... to check the invariant handles.len()>0, see
//   https://github.com/serde-rs/serde/issues/1220
pub struct BasicInfo {
    /// The handles for this hub, using in URLs and other places to be understood by both human and
    /// machine. The first one is the one that's used by default.
    /// **WARNING:**  Handles may be added, but should not be removed.
    pub handles: Vec<Handle>,

    /// Human-readable short name for this hub
    pub name: String,

    /// Short description for this hub.  This is stored centrally to facilitate searching.
    /// May be changed freely.
    pub description: String,

    /// Hub info endpoint
    /// May be changed freely.
    pub info_url: url::Url,

    /// Immutable and unique identifier
    pub id: Id,
}

impl<'de> serde::Deserialize<'de> for BasicInfo {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let unchecked = Self::deserialize(deserializer)?;
        if unchecked.handles.is_empty() {
            return Err(serde::de::Error::custom(
                "a hub must have at least one handle",
            ));
        }
        Ok(unchecked)
    }
}

impl serde::Serialize for BasicInfo {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        Self::serialize(self, serializer)
    }
}

/// The regex pattern for a hub handle
pub const HANDLE_REGEX: &str = r"^[a-z0-9_]+$";

thread_local! {
    /// Thread local compiled version of [HANDLE_REGEX]
    static HANDLE_REGEX_TLK: OnceCell<regex::Regex> = const { OnceCell::new() };
}

/// Runs `f` with as argument a reference to a compiled [HANDLE_REGEX]
/// that is cached thread locally.
pub fn with_handle_regex<R>(f: impl FnOnce(&regex::Regex) -> R) -> R {
    HANDLE_REGEX_TLK.with(|oc: &OnceCell<regex::Regex>| {
        f(oc.get_or_init(|| regex::Regex::new(HANDLE_REGEX).unwrap()))
    })
}

/// A hub handle - a string that matches [HANDLE_REGEX]
#[derive(Clone, PartialEq, Eq, Hash, Debug)]
pub struct Handle {
    inner: String,
}

impl serde::Serialize for Handle {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.collect_str(self)
    }
}

impl<'de> serde::Deserialize<'de> for Handle {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        String::deserialize(d)?
            .parse()
            .map_err(serde::de::Error::custom)
    }
}

/// When a hub handle does not match [HANDLE_REGEX].
#[derive(thiserror::Error, Debug)]
#[error(
    "a hub handle must be a non-empty string of lower-case alphanumeric characters and underscore"
)]
pub struct HubHandleError();

impl std::ops::Deref for Handle {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl TryFrom<String> for Handle {
    type Error = HubHandleError;

    fn try_from(s: String) -> Result<Self, Self::Error> {
        if !with_handle_regex(|r: &regex::Regex| r.is_match(&s)) {
            return Err(HubHandleError());
        }

        Ok(Handle { inner: s })
    }
}

impl core::str::FromStr for Handle {
    type Err = HubHandleError;

    fn from_str(s: &str) -> Result<Handle, Self::Err> {
        if !with_handle_regex(|r: &regex::Regex| r.is_match(s)) {
            return Err(HubHandleError());
        }

        Ok(Handle {
            inner: s.to_string(),
        })
    }
}

impl std::fmt::Display for Handle {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}", self.inner)
    }
}

impl From<Handle> for String {
    fn from(n: Handle) -> Self {
        n.inner
    }
}

/// A hub identifier, a random 256-bit number, which is encoded
/// using unpadded url-safe base64
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(transparent)]
pub struct Id {
    inner: bytes_wrapper::B64UU<serde_ext::ByteArray<32>>,
}

impl Id {
    /// Creates a new random hub id
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hub_handle() {
        assert!(Handle::try_from("no_Capical".to_string()).is_err());
        assert!(Handle::try_from("no space".to_string()).is_err());
        assert!(Handle::try_from("no_ümlaut".to_string()).is_err());
        assert!(Handle::try_from("this_is_fine".to_string()).is_ok());
        assert!(Handle::try_from("th1s_t00".to_string()).is_ok());
        assert!(Handle::try_from("".to_string()).is_err());
    }

    #[test]
    fn basic_info_serde() {
        assert_eq!(
            serde_json::from_str::<BasicInfo>(
                r#"{"handles": [], "name": "Hub 1", "info_url": "https://example.com", "description": "some hub",
                "id": "bLAPDnkcYj8S5hZ8NuH9OFTWKzypLqSakexoRvlZ_aA"}"#,
            )
            .unwrap_err()
            .to_string(),
            "a hub must have at least one handle",
        );
        assert_eq!(
            serde_json::from_str::<BasicInfo>(
                r#"{"handles": ["hub_1"], "name": "Hub 1", "info_url": "https://example.com", "description": "some hub", "id": "bLAPDnkcYj8S5hZ8NuH9OFTWKzypLqSakexoRvlZ_aA"}"#,
            )
            .unwrap(),
            BasicInfo{
                handles: vec!["hub_1".parse().unwrap()],
                name: "Hub 1".to_string(),
                info_url: "https://example.com".parse().unwrap(),
                description: "some hub".to_string(),
                id: "bLAPDnkcYj8S5hZ8NuH9OFTWKzypLqSakexoRvlZ_aA".parse().unwrap(),
            }
        );
    }
}
