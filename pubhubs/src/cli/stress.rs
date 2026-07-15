//! Load/stress testing: `cargo run stress <subcommand>`.
//!
//! These commands hammer a running PubHubs deployment to surface performance problems.  They forge
//! the Yivi disclosure step locally (see [`enter`]), so no Yivi app/server is involved — they only
//! need the Yivi server's signing key, which the auth server trusts.

use anyhow::Result;

#[derive(clap::Args, Debug)]
pub struct StressArgs {
    #[command(subcommand)]
    command: Commands,
}

impl StressArgs {
    pub fn run(self, _spec: &mut clap::Command) -> Result<()> {
        match self.command {
            Commands::Enter(args) => args.run(),
        }
    }
}

#[derive(clap::Subcommand, Debug)]
enum Commands {
    /// Hammer PHC's enter (login/registration) endpoint.
    Enter(enter::Args),
}

/// `cargo run stress enter`: run many login/registration flows against PHC.
///
/// Each iteration runs the real auth + enter flow — [`AuthStartEP`](crate::api::auths::AuthStartEP),
/// [`AuthCompleteEP`](crate::api::auths::AuthCompleteEP), [`EnterEP`](crate::api::phc::user::EnterEP) —
/// but forges the Yivi disclosure that normally comes from the user's Yivi app: we mint the
/// [`SessionResult`] the Yivi server would have returned and sign it with the Yivi server signing key
/// (the auth server only checks that signature, so a locally-signed one is accepted).  The `EnterEP`
/// call is what reads and writes PHC's object_store, so this stresses that store under realistic load.
///
/// [`SessionResult`]: crate::servers::yivi::SessionResult
mod enter {
    use std::num::NonZeroUsize;
    use std::time::{Duration, Instant};

    use anyhow::{Context as _, Result};
    use base64ct::{Base64UrlUnpadded, Encoding as _};
    use futures::stream::StreamExt as _;

    use crate::api;
    use crate::attr;
    use crate::cli::common::{self, Environment};
    use crate::client;
    use crate::handle;
    use crate::misc::jwt;
    use crate::servers::yivi;

    #[derive(clap::Args, Debug)]
    pub(super) struct Args {
        /// Stress this PubHubs environment.  Defaults to `local` so you can't accidentally hammer a
        /// real deployment.
        #[arg(short, long, value_name = "ENVIRONMENT", default_value = "local")]
        environment: Environment,

        /// Contact PHC at this url, overriding `--environment`.
        #[arg(short, long, value_name = "PHC_URL")]
        url: Option<url::Url>,

        /// Yivi server signing key (PKCS#8 PEM) used to forge accepted disclosures.
        #[arg(long, value_name = "PATH", default_value = "yivi_jwt.pem")]
        yivi_sk: std::path::PathBuf,

        /// Issuer (`iss`) the forged disclosure claims; must equal the auth server's configured Yivi
        /// server name (`auths.yivi.server_name`; `local-yivi` for the local dev stack).
        #[arg(long, value_name = "NAME", default_value = "local-yivi")]
        yivi_server_name: String,

        /// Number of enter flows kept in flight at once.
        #[arg(short, long, default_value_t = NonZeroUsize::new(16).unwrap())]
        concurrency: NonZeroUsize,

        /// Total number of enter flows to run.
        #[arg(short, long, default_value_t = 100)]
        total: u64,

        /// Whether each flow registers a new account, logs into an existing one, or either.
        #[arg(long, value_enum, default_value_t = Mode::LoginOrRegister)]
        mode: Mode,
    }

    // The attribute types each enter flow discloses: an identifying one and a bannable one.
    //
    // These are constants rather than command-line flags on purpose.  Which attributes are used makes
    // no difference to what this command measures — load on PHC's object_store — and supporting an
    // arbitrary attribute would mean teaching `forged_enter` how to generate a valid value for it.
    // The first must be an identifying attribute; the second must be *bannable* (phone is), otherwise
    // PHC rejects the registration with `NoBannableAttribute`.
    const IDENTIFYING_ATTR: &str = "email";
    const BANNABLE_ATTR: &str = "phone";

    /// What an enter flow does once it has its attributes.  `Login` expects the account to already
    /// exist, so run a `Register` pass with the same `--total` first: identities are deterministic in
    /// the iteration index, so the same range logs back in.
    #[derive(clap::ValueEnum, Debug, Clone, Copy)]
    enum Mode {
        Register,
        Login,
        LoginOrRegister,
    }

    impl From<Mode> for api::phc::user::EnterMode {
        fn from(mode: Mode) -> Self {
            match mode {
                Mode::Register => api::phc::user::EnterMode::Register,
                Mode::Login => api::phc::user::EnterMode::Login,
                Mode::LoginOrRegister => api::phc::user::EnterMode::LoginOrRegister,
            }
        }
    }

    impl Args {
        pub(super) fn run(self) -> Result<()> {
            env_logger::init();

            // The HTTP client (awc) is single-threaded, so drive everything on one thread; the
            // concurrency below is many in-flight futures on that thread, which is plenty for IO load.
            tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()?
                .block_on(tokio::task::LocalSet::new().run_until(self.run_async()))
        }

        fn url(&self) -> std::borrow::Cow<'_, url::Url> {
            common::phc_url(self.environment, &self.url)
        }

        async fn run_async(self) -> Result<()> {
            let client = client::Client::builder().agent(client::Agent::Cli).finish();

            let url = self.url();

            let constellation = client
                .get_constellation(url.as_ref())
                .await
                .context("fetching the constellation from PHC")?
                .into_constellation()
                .context("PHC is not done with discovery yet (no constellation)")?;

            // Load the Yivi server signing key and wrap it as the credentials whose `name` the auth
            // server checks against its configured Yivi server name.
            let pem = std::fs::read_to_string(&self.yivi_sk)
                .with_context(|| format!("reading Yivi signing key {}", self.yivi_sk.display()))?;
            let key: yivi::SigningKey = serde_json::from_value(serde_json::json!({ "rs256": pem }))
                .context("parsing Yivi signing key (expected a PKCS#8 PEM)")?;
            let creds = yivi::Credentials {
                name: self.yivi_server_name.clone(),
                key,
            };

            let mode: api::phc::user::EnterMode = self.mode.into();
            let total = self.total as usize;

            // Learn the disclosure session request once (identical for every flow), then precompute
            // and sign one disclosure per identity.  RSA signing is the heavy part and would otherwise
            // bottleneck this single-threaded load generator instead of the server, so we do it up
            // front (untimed) and spread it across all cores.
            let sprequest = fetch_sprequest(&client, &constellation).await?;
            log::info!("precomputing {total} signed disclosures (RSA) across all cores…");
            let precompute_start = Instant::now();
            let disclosures = precompute_disclosures(&sprequest, &creds, total);
            log::info!("…precomputed in {:.1?}", precompute_start.elapsed());

            log::info!(
                "stressing enter at {url} — {total} flows, {} in flight, mode {:?}",
                self.concurrency,
                self.mode,
            );

            // The AuthStart request is identical for every flow (a pure function of constants); build
            // it once here, not inside each timed flow.
            let auth_start_req = auth_start_req();

            let wall = Instant::now();
            let results: Vec<Result<(Timing, Outcome)>> = futures::stream::iter(disclosures)
                .map(|disclosure| {
                    enter_with_disclosure(
                        &client,
                        &constellation,
                        &auth_start_req,
                        disclosure,
                        mode,
                    )
                })
                .buffer_unordered(self.concurrency.get())
                .collect()
                .await;
            let wall = wall.elapsed();

            summarize(&results, wall, self.total);
            Ok(())
        }
    }

    /// The result of one enter flow, for the summary.
    enum Outcome {
        Registered,
        LoggedIn,
        AttributeAlreadyTaken,
        Other(String),
    }

    impl Outcome {
        fn of(resp: &api::phc::user::EnterResp) -> Self {
            match resp {
                api::phc::user::EnterResp::Entered {
                    new_account: true, ..
                } => Outcome::Registered,
                api::phc::user::EnterResp::Entered {
                    new_account: false, ..
                } => Outcome::LoggedIn,
                api::phc::user::EnterResp::AttributeAlreadyTaken { .. } => {
                    Outcome::AttributeAlreadyTaken
                }
                other => Outcome::Other(format!("{other:?}")),
            }
        }
    }

    /// Builds the `AuthStartReq` every flow uses: disclose the identifying + bannable attribute.
    fn auth_start_req() -> api::auths::AuthStartReq {
        let identifying_type: handle::Handle =
            IDENTIFYING_ATTR.parse().expect("a valid attribute handle");
        let bannable_type: handle::Handle =
            BANNABLE_ATTR.parse().expect("a valid attribute handle");
        api::auths::AuthStartReq {
            source: attr::Source::Yivi,
            attr_types: vec![identifying_type, bannable_type],
            attr_type_choices: Default::default(),
            yivi_chained_session: false,
            yivi_chained_session_drip: false,
        }
    }

    /// The value identity `i` discloses for attribute `ati`.  Deterministic in `i`, so a `register`
    /// pass then a `login` pass over the same range line up.
    fn value_for(ati: &yivi::AttributeTypeIdentifier, i: usize) -> String {
        let id = ati.as_str();
        if id.contains("email") {
            format!("stress+{i}@example.com")
        } else if id.contains("mobilenumber") || id.contains("phone") {
            format!("+1555{i:07}")
        } else {
            format!("stress-{i}")
        }
    }

    /// One `AuthStart` to learn the disclosure session request — the Yivi attribute identifiers the
    /// auth server asks for.  Identical for every flow, so fetch it once and build every forged
    /// disclosure from it.
    async fn fetch_sprequest(
        client: &client::Client,
        constellation: &crate::servers::Constellation,
    ) -> Result<yivi::ExtendedSessionRequest> {
        let api::auths::AuthStartResp::Success { task, .. } = client
            .query_with_retry::<api::auths::AuthStartEP, _, _>(
                &constellation.auths_url,
                &auth_start_req(),
            )
            .await
            .context("auth start (to learn the disclosure request)")?
        else {
            anyhow::bail!("auth start did not succeed");
        };
        let api::auths::AuthTask::Yivi {
            disclosure_request, ..
        } = task;
        sprequest_unverified(&disclosure_request)
    }

    /// Signs one disclosure per identity, in parallel across all cores.  RSA signing dominates a
    /// single thread (it's what made the load generator the bottleneck), so it happens here — up
    /// front and untimed — rather than inside the measured loop.
    fn precompute_disclosures(
        sprequest: &yivi::ExtendedSessionRequest,
        creds: &yivi::Credentials<yivi::SigningKey>,
        total: usize,
    ) -> Vec<jwt::JWT> {
        // The auth server doesn't check the disclosure's expiry (see
        // `yivi::SessionResult::open_signed`), but sign with a generous validity regardless.
        const VALIDITY: Duration = Duration::from_secs(3600);

        let threads = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4);
        let chunk = total.div_ceil(threads).max(1);

        let mut out: Vec<Option<jwt::JWT>> = (0..total).map(|_| None).collect();
        std::thread::scope(|scope| {
            for (c, slot) in out.chunks_mut(chunk).enumerate() {
                scope.spawn(move || {
                    for (l, cell) in slot.iter_mut().enumerate() {
                        let i = c * chunk + l;
                        *cell = Some(
                            sprequest
                                .mock_disclosure_response(|ati| value_for(ati, i))
                                .sign(creds, VALIDITY)
                                .expect("signing a precomputed disclosure"),
                        );
                    }
                });
            }
        });
        out.into_iter()
            .map(|disclosure| disclosure.expect("every disclosure slot was filled"))
            .collect()
    }

    /// One timed enter flow using a precomputed disclosure: `AuthStart` (for a fresh sealed state) →
    /// `AuthComplete` → `EnterEP`.  No signing happens here, so the timing reflects the server's work.
    async fn enter_with_disclosure(
        client: &client::Client,
        constellation: &crate::servers::Constellation,
        auth_start_req: &api::auths::AuthStartReq,
        disclosure: jwt::JWT,
        mode: api::phc::user::EnterMode,
    ) -> Result<(Timing, Outcome)> {
        // AuthStart: a fresh sealed state to pair with the (reusable) precomputed disclosure.
        let t = Instant::now();
        let api::auths::AuthStartResp::Success { state, .. } = client
            .query_with_retry::<api::auths::AuthStartEP, _, _>(
                &constellation.auths_url,
                auth_start_req,
            )
            .await
            .context("auth start")?
        else {
            anyhow::bail!("auth start did not succeed");
        };
        let auth_start = t.elapsed();

        // AuthComplete: hand over the precomputed disclosure, get signed attributes back.
        let t = Instant::now();
        let api::auths::AuthCompleteResp::Success { mut attrs } = client
            .query_with_retry::<api::auths::AuthCompleteEP, _, _>(
                &constellation.auths_url,
                &api::auths::AuthCompleteReq {
                    state,
                    proof: api::auths::AuthProof::Yivi { disclosure },
                },
            )
            .await
            .context("auth complete")?
        else {
            anyhow::bail!("auth complete did not succeed");
        };
        let auth_complete = t.elapsed();

        // Enter PHC with those attributes — the call that reads/writes the object_store.
        let Some((id_type, identifying_attr)) = attrs.shift_remove_index(0) else {
            anyhow::bail!("auth complete returned no attributes");
        };
        anyhow::ensure!(
            id_type.as_str() == IDENTIFYING_ATTR,
            "auth complete returned unexpected identifying attribute type {id_type}, expected {IDENTIFYING_ATTR}",
        );
        let add_attrs: Vec<_> = attrs.values().cloned().collect();

        // Keep `..Default::default()` so a future `EnterReq` field doesn't break this call site.
        #[allow(clippy::needless_update)]
        let enter_req = api::phc::user::EnterReq {
            identifying_attr: Some(identifying_attr),
            mode,
            add_attrs,
            register_only_with_unique_attrs: false,
            ..Default::default()
        };

        let t = Instant::now();
        let enter_resp = client
            .query_with_retry::<api::phc::user::EnterEP, _, _>(&constellation.phc_url, &enter_req)
            .await
            .context("enter")?;
        let enter = t.elapsed();

        Ok((
            Timing {
                auth_start,
                auth_complete,
                enter,
            },
            Outcome::of(&enter_resp),
        ))
    }

    /// Per-stage wall-clock of one enter flow.
    struct Timing {
        auth_start: Duration,
        auth_complete: Duration,
        enter: Duration,
    }

    impl Timing {
        fn total(&self) -> Duration {
            self.auth_start + self.auth_complete + self.enter
        }
    }

    /// Reads the `sprequest` (disclosure session request) out of the auth server's
    /// `disclosure_request` JWT *without verifying its signature*: we made no claim to authenticate
    /// it — we only need to learn which Yivi attribute identifiers it asks for, to forge a matching
    /// response.
    fn sprequest_unverified(disclosure_request: &jwt::JWT) -> Result<yivi::ExtendedSessionRequest> {
        #[derive(serde::Deserialize)]
        struct DisclosureRequestClaims {
            sprequest: yivi::ExtendedSessionRequest,
        }

        let payload = disclosure_request
            .as_str()
            .split('.')
            .nth(1)
            .context("disclosure_request JWT has no payload segment")?;
        let bytes = Base64UrlUnpadded::decode_vec(payload)
            .context("disclosure_request JWT payload is not valid base64url")?;
        let claims: DisclosureRequestClaims =
            serde_json::from_slice(&bytes).context("decoding disclosure_request claims")?;
        Ok(claims.sprequest)
    }

    /// Prints outcome counts, throughput, and per-stage latency percentiles.  The per-stage split is
    /// the point: `auth-complete` is the auth server's crypto (verify the disclosure, sign the
    /// attributes), while `enter` is PHC's object_store reads/writes (plus its pseudonym crypto).
    fn summarize(results: &[Result<(Timing, Outcome)>], wall: Duration, total: u64) {
        let mut registered = 0u64;
        let mut logged_in = 0u64;
        let mut taken = 0u64;
        let mut other: std::collections::BTreeMap<String, u64> = Default::default();
        let mut errors: std::collections::BTreeMap<String, u64> = Default::default();
        let mut starts: Vec<Duration> = Vec::new();
        let mut completes: Vec<Duration> = Vec::new();
        let mut enters: Vec<Duration> = Vec::new();
        let mut totals: Vec<Duration> = Vec::new();

        for result in results {
            match result {
                Ok((timing, outcome)) => {
                    starts.push(timing.auth_start);
                    completes.push(timing.auth_complete);
                    enters.push(timing.enter);
                    totals.push(timing.total());
                    match outcome {
                        Outcome::Registered => registered += 1,
                        Outcome::LoggedIn => logged_in += 1,
                        Outcome::AttributeAlreadyTaken => taken += 1,
                        Outcome::Other(msg) => *other.entry(msg.clone()).or_default() += 1,
                    }
                }
                Err(err) => *errors.entry(format!("{err:#}")).or_default() += 1,
            }
        }

        println!("\n=== stress enter summary ===");
        println!("iterations:  {total}");
        println!("wall time:   {wall:.2?}");
        println!(
            "throughput:  {:.1} attempted enters/s",
            total as f64 / wall.as_secs_f64().max(f64::MIN_POSITIVE)
        );
        println!("registered:  {registered}");
        println!("logged in:   {logged_in}");
        println!("attr taken:  {taken}");
        for (msg, count) in &other {
            println!("other:       {count}× {msg}");
        }
        let error_total: u64 = errors.values().sum();
        println!("errors:      {error_total}");
        for (msg, count) in &errors {
            println!("  {count}× {msg}");
        }

        println!("per-stage latency (p50 / p95 / max):");
        stage("auth-start    (auths)", &mut starts);
        stage("auth-complete (auths, crypto)", &mut completes);
        stage("enter         (phc, object_store)", &mut enters);
        stage("total", &mut totals);
    }

    /// Sorts `samples` and prints one `name: p50 / p95 / max` line.
    fn stage(name: &str, samples: &mut [Duration]) {
        if samples.is_empty() {
            return;
        }
        samples.sort_unstable();
        let pct = |p: f64| {
            let idx = ((p / 100.0) * (samples.len() as f64 - 1.0)).round() as usize;
            samples[idx.min(samples.len() - 1)]
        };
        println!(
            "  {name}: {:.1?} / {:.1?} / {:.1?}",
            pct(50.0),
            pct(95.0),
            samples.last().unwrap(),
        );
    }
}
