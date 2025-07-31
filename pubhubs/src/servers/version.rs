/// PubHubs servers version  (e.g. `"v2.2.0"`), extracted from the git repository,
/// and set to `"n/a"` when not available.
pub const VERSION: &str = git_version::git_version!(args = ["--tags"], fallback = "n/a");

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
