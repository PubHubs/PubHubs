//! Tools for dealing with time.
use std::fmt;
use std::time;

/// Returned by [format_time_wrt].
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
            jiff::Timestamp::try_from(self.t)
                .map(|t| t
                    .round(jiff::Unit::Second)
                    .expect("should never fail with Unit::Second as argument")
                    .to_string())
                .unwrap_or_else(|_| "<overflowing timestamp>".to_string()),
            self.prefix,
            jiff::Span::try_from(self.duration)
                .map(|s| format!(
                    "{:#}",
                    s.round(
                        jiff::SpanRound::new()
                            .smallest(jiff::Unit::Second)
                            .largest(jiff::Unit::Week)
                            .days_are_24_hours()
                    )
                    .unwrap()
                ))
                .unwrap_or_else(|_| "<overflowing time span>".to_string()),
            self.suffix
        )
    }
}

/// Like [format_time_wrt], but computes `now` itself.
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
            "1970-01-01T00:00:00Z (2810w 13h 13m 23s ago)".to_string()
        );
        assert_eq!(
            format_time_wrt(t2, epoch).to_string(),
            "2023-11-09T13:13:24Z (in 2810w 13h 13m 23s)".to_string()
        );
    }
}
