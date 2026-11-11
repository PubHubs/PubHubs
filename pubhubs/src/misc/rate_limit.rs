//! A token bucket per key, kept in memory.

use std::collections::HashMap;
use std::hash::Hash;
use std::time::{Duration, Instant};

/// How fast one key may go: at most `burst` at once, and on average `per_minute`.
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone, Copy, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Rate {
    pub burst: u32,
    pub per_minute: u32,
}

/// A token bucket per key.  Keys whose bucket is full again are forgotten, so the memory used
/// depends on the keys that were active recently.
pub struct RateLimiter<K> {
    rate: Rate,
    buckets: HashMap<K, Bucket>,
    last_prune: Instant,
}

struct Bucket {
    tokens: f64,
    last: Instant,
}

/// Forget full buckets at most this often.
const PRUNE_INTERVAL: Duration = Duration::from_secs(60);

impl<K: Hash + Eq> RateLimiter<K> {
    pub fn new(rate: Rate) -> Self {
        Self {
            rate,
            buckets: HashMap::new(),
            last_prune: Instant::now(),
        }
    }

    /// Takes a token for `key`, if there is one.
    pub fn allow(&mut self, key: K) -> bool {
        self.allow_n(key, 1)
    }

    /// Takes `n` tokens for `key` if there are that many, and none otherwise.
    pub fn allow_n(&mut self, key: K, n: u32) -> bool {
        self.allow_n_at(key, n, Instant::now())
    }

    /// Gives back a token taken for `key`, e.g. when what it was taken for didn't happen after all.
    pub fn refund(&mut self, key: &K) {
        let burst = self.rate.burst as f64;
        if let Some(bucket) = self.buckets.get_mut(key) {
            bucket.tokens = (bucket.tokens + 1.0).min(burst);
        }
    }

    #[cfg(test)]
    fn allow_at(&mut self, key: K, now: Instant) -> bool {
        self.allow_n_at(key, 1, now)
    }

    fn allow_n_at(&mut self, key: K, n: u32, now: Instant) -> bool {
        if now.duration_since(self.last_prune) >= PRUNE_INTERVAL {
            self.prune(now);
        }

        let burst = self.rate.burst as f64;
        let per_second = self.rate.per_minute as f64 / 60.0;
        let bucket = self.buckets.entry(key).or_insert(Bucket {
            tokens: burst,
            last: now,
        });
        let elapsed = now.duration_since(bucket.last).as_secs_f64();
        bucket.tokens = (bucket.tokens + elapsed * per_second).min(burst);
        bucket.last = now;

        let n = n as f64;
        if bucket.tokens >= n {
            bucket.tokens -= n;
            true
        } else {
            false
        }
    }

    fn prune(&mut self, now: Instant) {
        let burst = self.rate.burst as f64;
        let rate = self.rate;
        self.buckets.retain(|_, bucket| {
            let elapsed = now.duration_since(bucket.last).as_secs_f64();
            bucket.tokens + elapsed * rate.per_minute as f64 / 60.0 < burst
        });
        self.last_prune = now;
    }

    #[cfg(test)]
    fn len(&self) -> usize {
        self.buckets.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn burst_then_refill() {
        let mut rl = RateLimiter::new(Rate {
            burst: 2,
            per_minute: 60,
        });
        let t0 = Instant::now();
        assert!(rl.allow_at("a", t0));
        assert!(rl.allow_at("a", t0));
        assert!(!rl.allow_at("a", t0));
        // other keys have their own bucket
        assert!(rl.allow_at("b", t0));
        // one token per second
        assert!(rl.allow_at("a", t0 + Duration::from_secs(1)));
        assert!(!rl.allow_at("a", t0 + Duration::from_secs(1)));
    }

    #[test]
    fn several_at_once_and_refunds() {
        let mut rl = RateLimiter::new(Rate {
            burst: 5,
            per_minute: 60,
        });
        let t0 = Instant::now();
        assert!(rl.allow_n_at("a", 3, t0));
        assert!(!rl.allow_n_at("a", 3, t0), "only 2 left: takes none");
        assert!(rl.allow_n_at("a", 2, t0));
        assert!(!rl.allow_at("a", t0));
        rl.refund(&"a");
        assert!(rl.allow_at("a", t0));
        // refunds never go over the burst
        for _ in 0..10 {
            rl.refund(&"a");
        }
        assert!(rl.allow_n_at("a", 5, t0));
        assert!(!rl.allow_at("a", t0));
    }

    #[test]
    fn forgets_full_buckets() {
        let mut rl = RateLimiter::new(Rate {
            burst: 2,
            per_minute: 60,
        });
        let t0 = Instant::now();
        assert!(rl.allow_at("a", t0));
        assert_eq!(rl.len(), 1);
        assert!(rl.allow_at("b", t0 + PRUNE_INTERVAL + Duration::from_secs(1)));
        assert_eq!(rl.len(), 1, "a's bucket is full again, so it's forgotten");
    }
}
