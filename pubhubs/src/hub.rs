//! Information about hubs
use core::cell::OnceCell;
use rand::RngCore as _;
use regex;

use crate::misc::serde_ext;

/// Basic details about hub, as provided by PubHubs Central.
#[derive(serde::Serialize, serde::Deserialize, Debug, Eq, PartialEq, Clone)]
#[serde(remote = "Self")]
// We use serde(remote... to check the invariant names.len()>0, see
//   https://github.com/serde-rs/serde/issues/1220
pub struct BasicInfo {
    /// The names for this hub.  The first one is the one that's used by default.
    /// Names may be added, but should not be removed.
    names: Vec<Name>,

    /// Short description for this hub.  This is stored centrally to facilitate searching.
    /// May be changed freely.
    description: String,

    /// Hub info endpoint
    /// May be changed freely.
    info_url: url::Url,

    /// Immutable and unique identifier
    id: Id,
}

impl<'de> serde::Deserialize<'de> for BasicInfo {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let unchecked = Self::deserialize(deserializer)?;
        if unchecked.names.is_empty() {
            return Err(serde::de::Error::custom(
                "a hub must have at least one name",
            ));
        }
        Ok(unchecked)
    }
}

/// The regex pattern for a hub name
pub const NAME_REGEX: &str = r"^[a-z0-9_]+$";

thread_local! {
    /// Thread local compiled version of [NAME_REGEX]
    static NAME_REGEX_TLK: OnceCell<regex::Regex> = OnceCell::new();
}

/// Runs `f` with as argument a reference to a compiled [NAME_REGEX]
/// that is cached thread locally.
pub fn with_name_regex<R>(f: impl FnOnce(&regex::Regex) -> R) -> R {
    NAME_REGEX_TLK.with(|oc: &OnceCell<regex::Regex>| {
        f(oc.get_or_init(|| regex::Regex::new(NAME_REGEX).unwrap()))
    })
}

/// A hub name - a string that matches [NAME_REGEX]
#[derive(Clone, PartialEq, Eq, Hash, Debug)]
pub struct Name {
    inner: String,
}

impl serde::Serialize for Name {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.collect_str(self)
    }
}

impl<'de> serde::Deserialize<'de> for Name {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        String::deserialize(d)?
            .parse()
            .map_err(serde::de::Error::custom)
    }
}

/// When a hub name does not match [NAME_REGEX].
#[derive(thiserror::Error, Debug)]
#[error(
    "a hub name must be a non-empty string of lower-case alphanumeric characters and underscore"
)]
pub struct HubNameError();

impl TryFrom<String> for Name {
    type Error = HubNameError;

    fn try_from(s: String) -> Result<Self, Self::Error> {
        if !with_name_regex(|r: &regex::Regex| r.is_match(&s)) {
            return Err(HubNameError());
        }

        Ok(Name { inner: s })
    }
}

impl core::str::FromStr for Name {
    type Err = HubNameError;

    fn from_str(s: &str) -> Result<Name, Self::Err> {
        if !with_name_regex(|r: &regex::Regex| r.is_match(&s)) {
            return Err(HubNameError());
        }

        Ok(Name {
            inner: s.to_string(),
        })
    }
}

impl std::fmt::Display for Name {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}", self.inner)
    }
}

impl Into<String> for Name {
    fn into(self) -> String {
        self.inner
    }
}

/// A hub identifier, a random 256-bit number, which is encoded
/// using unpadded url-safe base64
#[derive(Clone, Copy, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(transparent)]
pub struct Id {
    inner: serde_ext::B64UU<serde_ext::ByteArray<32>>,
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
    type Err = <serde_ext::B64UU<[u8; 32]> as core::str::FromStr>::Err;

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
    fn test_hub_name() {
        assert!(Name::try_from("no_Capical".to_string()).is_err());
        assert!(Name::try_from("no space".to_string()).is_err());
        assert!(Name::try_from("no_ümlaut".to_string()).is_err());
        assert!(Name::try_from("this_is_fine".to_string()).is_ok());
        assert!(Name::try_from("th1s_t00".to_string()).is_ok());
        assert!(Name::try_from("".to_string()).is_err());
    }

    #[test]
    fn basic_info_serde() {
        assert_eq!(
            serde_json::from_str::<BasicInfo>(
                r#"{"names": [], "info_url": "https://example.com", "description": "some hub",
                "id": "bLAPDnkcYj8S5hZ8NuH9OFTWKzypLqSakexoRvlZ_aA"}"#,
            )
            .unwrap_err()
            .to_string(),
            "a hub must have at least one name"
        );
        assert_eq!(
            serde_json::from_str::<BasicInfo>(
                r#"{"names": ["hub_1"], "info_url": "https://example.com", "description": "some hub", "id": "bLAPDnkcYj8S5hZ8NuH9OFTWKzypLqSakexoRvlZ_aA"}"#,
            )
            .unwrap(),
            BasicInfo{
                names: vec!["hub_1".parse().unwrap()],
                info_url: "https://example.com".parse().unwrap(),
                description: "some hub".to_string(),
                id: "bLAPDnkcYj8S5hZ8NuH9OFTWKzypLqSakexoRvlZ_aA".parse().unwrap(),
            }
        );
    }
}
