//! Tools for dealing with tokio tasks.

use std::future::Future;
use tokio::time::Duration;

/// Options for [retry].
pub struct RetryOptions {
    /// Wait this amount of time after the first `Ok(None)` is returned.
    pub initial_wait_time: Duration,

    /// Increase the wait time by this factor each time `Ok(None)` is returned.
    pub backoff_factor: f32,

    /// Try `max_retries+1` number of times to get a non-`Ok(None)` answer.
    pub max_retries: Option<usize>,
}

impl Default for RetryOptions {
    fn default() -> Self {
        Self {
            initial_wait_time: Duration::from_millis(100),
            backoff_factor: 2f32,
            max_retries: None,
        }
    }
}

impl RetryOptions {
    pub async fn retry<T, E, Fut: Future<Output = Result<Option<T>, E>>>(
        &self,
        f: impl Fn() -> Fut,
    ) -> Result<Option<T>, E> {
        let mut retries_left: usize = self.max_retries.unwrap_or(usize::MAX);
        let mut wait_time: Duration = self.initial_wait_time;
        let backoff_factor = self.backoff_factor;

        loop {
            let res = f().await;

            // return when res is Ok(Some(v)) or Err(ec)
            match res.as_ref() {
                Ok(None) => {}
                _ => return res,
            };

            if retries_left == 0 {
                return Ok(None);
            }

            retries_left -= 1;

            tokio::time::sleep(wait_time).await;
            wait_time = wait_time.mul_f32(backoff_factor);
        }
    }
}

/// Calls the given function `f` until it no longer returns `Ok(None)`, and returns the last result
/// which is thus either an `Ok(Some(value))` or an `Err(err)`.
///
/// When a maximal number of retries is reached (see [RetryOptions::max_retries]), `Ok(None)` is returned.
///
/// See [RetryOptions::retry] for more options.
pub async fn retry<T, E, Fut: Future<Output = Result<Option<T>, E>>>(
    f: impl Fn() -> Fut,
) -> Result<Option<T>, E> {
    RetryOptions::default().retry(f).await
}
