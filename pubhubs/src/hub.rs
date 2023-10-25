//! Information about hubs
use core::cell::OnceCell;
use regex;

/// Basic details about hub, as stored by PubHubs
pub struct BasicInfo {
    /// The names for this hub.
    names: Vec<Name>,

    /// Short description for this hub.  This is stored centrally to facilitate searching.
    description: String,

    /// Hub info endpoint
    info_url: url::Url,
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
pub struct Name {
    inner: String,
}

impl TryFrom<String> for Name {
    type Error = String;

    fn try_from(s: String) -> Result<Self, Self::Error> {
        if !with_name_regex(|r: &regex::Regex| r.is_match(&s)) {
            return Err(s);
        }

        Ok(Name { inner: s })
    }
}

impl core::str::FromStr for Name {
    type Err = ();

    fn from_str(s: &str) -> Result<Name, Self::Err> {
        if !with_name_regex(|r: &regex::Regex| r.is_match(&s)) {
            return Err(());
        }

        Ok(Name {
            inner: s.to_string(),
        })
    }
}

impl Into<String> for Name {
    fn into(self) -> String {
        self.inner
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
}
