//! [`Handle`]s for PubHubs objects like [hub](crate::hub::BasicInfo)s and
//! [attribute types](crate::attr::Type).
use std::cell::OnceCell;

/// A handle used to refer to hubs, attributes, etc. - a string that matches [HANDLE_REGEX]
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

/// When a handle does not match [HANDLE_REGEX].
#[derive(thiserror::Error, Debug)]
#[error("a handle must be a non-empty string of lower-case alphanumeric characters and underscore")]
pub struct HubHandleError();

impl std::ops::Deref for Handle {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl Handle {
    /// Returns the undelying string.
    ///
    /// Has the sam effect as `deref`, but `as_str` is more readable.
    pub fn as_str(&self) -> &str {
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

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(transparent)]
#[serde(remote = "Self")]
// We use serde(remote... to check the invariant handles.len()>0, see
//   https://github.com/serde-rs/serde/issues/1220
pub struct Handles {
    inner: Vec<Handle>,
}

impl Handles {
    pub fn preferred(&self) -> &Handle {
        &self.inner[0]
    }
}

impl std::ops::Deref for Handles {
    type Target = [Handle];

    fn deref(&self) -> &[Handle] {
        &self.inner
    }
}

impl From<Vec<Handle>> for Handles {
    fn from(handles: Vec<Handle>) -> Handles {
        Self { inner: handles }
    }
}

impl<'de> serde::Deserialize<'de> for Handles {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let unchecked = Self::deserialize(deserializer)?;
        if unchecked.inner.is_empty() {
            return Err(serde::de::Error::custom("must have at least one handle"));
        }
        Ok(unchecked)
    }
}

impl serde::Serialize for Handles {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        Self::serialize(self, serializer)
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
}
