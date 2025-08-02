/// PubHubs servers version  (e.g. `"v2.2.0"`), extracted from `PH_VERSION` compile
/// time environmental variable if set, and otherwise from the git repository
/// if available.  Set to `"n/a"` when not available.
pub const VERSION: &str = match std::option_env!("PH_VERSION") {
    Some(version) => version,
    None => git_version::git_version!(args = ["--tags"], fallback = "n/a"),
}; // Note:  Option::unwrap_or_(else) is not const

/// Returns the PubHubs servers version when available.
pub fn version() -> Option<&'static str> {
    if VERSION == "n/a" {
        return None;
    }

    Some(VERSION)
}

/// Attempts to parse `version` as `semver::Version` after stripping off the leading `v`.
pub fn to_semver(version: impl AsRef<str>) -> anyhow::Result<semver::Version> {
    let version = version.as_ref();

    if version.is_empty() || version[0..1] != *"v" {
        anyhow::bail!("missing leading 'v'");
    }

    Ok(semver::Version::parse(&version[1..])?)
}
