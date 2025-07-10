//! Tools for dealing with time.
use std::fmt;
use std::time;

/// Returned by [`format_time_wrt`].
#[derive(Clone, Debug)]
pub struct FormattedTime {
    prefix: &'static str,
    suffix: &'static str,
    duration: time::Duration,
    t: time::SystemTime,
}

impl fmt::Display for FormattedTime {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(
            f,
            "{} ({}{}{})",
            humantime::format_rfc3339_seconds(self.t),
            self.prefix,
            humantime::format_duration(self.duration),
            self.suffix
        )
    }
}

/// Like [`format_time_wrt`], but computes `now` itself.
pub fn format_time(t: time::SystemTime) -> FormattedTime {
    format_time_wrt(t, time::SystemTime::now())
}

/// Formats the given time in UTC using RFC3339 and, to aid interpretation, adds
/// a human readable time delta.
///
/// Both time and time delta are rounded to seconds.
///
/// For example, at the time of writing the unix epoch is displayed thusly:
/// `1970-01-01T00:00:00Z (2810w 13h 13m 23s ago)`
pub fn format_time_wrt(t: time::SystemTime, now: time::SystemTime) -> FormattedTime {
    let (prefix, suffix, duration) = match now.duration_since(t) {
        Ok(duration) => ("", " ago", duration),
        Err(err) => ("in ", "", err.duration()),
    };

    let duration = time::Duration::from_secs(duration.as_secs());

    FormattedTime {
        prefix,
        suffix,
        duration,
        t,
    }
}

pub mod human_duration {
    use serde::{Deserialize as _, de::Error as _};

    pub fn deserialize<'de, D>(d: D) -> Result<core::time::Duration, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        // Could be more efficient with something like serde_cow::CowStr, but that'd require
        // another dependency
        let s = String::deserialize(d)?;

        humantime::parse_duration(&s).map_err(D::Error::custom)
    }

    pub fn serialize<S>(duration: &core::time::Duration, s: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        s.collect_str(&humantime::format_duration(*duration))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_time() {
        let epoch = time::UNIX_EPOCH;
        let t = epoch + time::Duration::from_secs_f64(0.002003004);
        assert_eq!(
            format_time_wrt(t, epoch).to_string(),
            "1970-01-01T00:00:00Z (in 0s)".to_string()
        );
        assert_eq!(
            format_time_wrt(epoch, t).to_string(),
            "1970-01-01T00:00:00Z (0s ago)".to_string()
        );
        let t2 = epoch + time::Duration::from_secs_f64(1699535603.723209);
        assert_eq!(
            format_time_wrt(epoch, t2).to_string(),
            "1970-01-01T00:00:00Z (53years 10months 7days 21h 37m 23s ago)".to_string()
        );
        assert_eq!(
            format_time_wrt(t2, epoch).to_string(),
            "2023-11-09T13:13:23Z (in 53years 10months 7days 21h 37m 23s)".to_string()
        );
    }

    #[derive(serde::Deserialize, serde::Serialize)]
    struct TestStruct {
        #[serde(with = "human_duration")]
        duration: core::time::Duration,
    }

    #[test]
    fn test_human_duration() {
        let ts: TestStruct = serde_json::from_str(r#"{"duration": "1w 5s"}"#).unwrap();
        assert_eq!(
            ts.duration,
            core::time::Duration::from_secs(5 + 7 * 24 * 60 * 60)
        );
        assert_eq!(
            serde_json::to_string(&ts).unwrap(),
            r#"{"duration":"7days 5s"}"#.to_string()
        );
    }
}
