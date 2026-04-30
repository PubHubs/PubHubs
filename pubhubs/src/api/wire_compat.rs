//! JSON snapshots of cross-server message types, pinned to release windows.
//!
//! Each entry in [`SNAPSHOTS`] is labelled `>vX.Y.Z`, meaning "this is the
//! wire shape used in any pubhubs release made after `vX.Y.Z`."  For example,
//! an entry labelled `>v3.2.2` records what the servers send and receive in
//! every post-v3.2.2 build, up until a future release introduces a new entry.
//!
//! The [`wire_compat`] test enforces two properties:
//!
//!  1. Every recorded snapshot must still deserialize with the current Rust
//!     types.  This catches removed/renamed/newly-required fields that would
//!     prevent a freshly-updated server from reading payloads sent by older
//!     peers during a rolling upgrade.
//!
//!  2. The current Rust types must serialize the canonical fixture (built
//!     inside the test using explicit struct literals) to JSON identical
//!     (modulo whitespace and key order) to the latest snapshot in
//!     [`SNAPSHOTS`].  This ensures every wire shape we ship is recorded.
//!
//! When you change the wire format of one of the covered types, the test
//! will fail with a message telling you whether to update the latest
//! snapshot in place (no release has been cut since the snapshot was added,
//! so it has not shipped) or to add a new snapshot (a release has shipped,
//! so the existing snapshot is now historical and must not be modified).

#![cfg(test)]

use crate::api::{DiscoveryInfoResp, DiscoveryRunResp, ErrorCode, Result, VerifyingKey};
use crate::common::elgamal;
use crate::id;
use crate::misc::jwt::NumericDate;
use crate::servers::Name;
use crate::servers::constellation::{Constellation, ConstellationOrId, Inner};
use crate::servers::version;

struct Snapshots {
    discovery_info_resp_phc: &'static str,
    discovery_info_resp_transcryptor: &'static str,
    discovery_info_resp_auths_blank: &'static str,
    discovery_run_resp_up_to_date: &'static str,
    discovery_run_resp_restarting: &'static str,
    result_ok_up_to_date: &'static str,
    result_err_please_retry: &'static str,
    result_err_internal_error: &'static str,
    result_err_bad_request: &'static str,
}

const SNAPSHOTS: &[(&str, Snapshots)] = &[(
    // Edit this entry only if no pubhubs release has shipped it yet;
    // once shipped, it is historical — add a new entry instead.
    ">v3.2.2",
    Snapshots {
        discovery_info_resp_phc: r#"{
  "name": "phc",
  "self_check_code": "selfcheck-phc",
  "version": "test-version",
  "phc_url": "https://phc.example.test/",
  "jwt_key": "66b1419fae979516fb3807dda1b05026b2570a7ab2190254e524af4f0934ddd2",
  "enc_key": "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76",
  "master_enc_key_part": "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76",
  "constellation": {
    "id": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "created_at": 1700000000,
    "transcryptor_url": "https://tr.example.test/",
    "transcryptor_jwt_key": "66b1419fae979516fb3807dda1b05026b2570a7ab2190254e524af4f0934ddd2",
    "transcryptor_enc_key": "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76",
    "transcryptor_master_enc_key_part": "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76",
    "phc_url": "https://phc.example.test/",
    "phc_jwt_key": "66b1419fae979516fb3807dda1b05026b2570a7ab2190254e524af4f0934ddd2",
    "phc_enc_key": "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76",
    "auths_url": "https://auths.example.test/",
    "auths_jwt_key": "66b1419fae979516fb3807dda1b05026b2570a7ab2190254e524af4f0934ddd2",
    "auths_enc_key": "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76",
    "master_enc_key": "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76",
    "global_client_url": "https://gc.example.test/",
    "ph_version": "test-version"
  }
}"#,
        discovery_info_resp_transcryptor: r#"{
  "name": "transcryptor",
  "self_check_code": "selfcheck-tr",
  "version": "test-version",
  "phc_url": "https://phc.example.test/",
  "jwt_key": "66b1419fae979516fb3807dda1b05026b2570a7ab2190254e524af4f0934ddd2",
  "enc_key": "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76",
  "master_enc_key_part": "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76",
  "constellation": { "id": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }
}"#,
        discovery_info_resp_auths_blank: r#"{
  "name": "auths",
  "self_check_code": "selfcheck-auths",
  "version": "test-version",
  "phc_url": "https://phc.example.test/",
  "jwt_key": "66b1419fae979516fb3807dda1b05026b2570a7ab2190254e524af4f0934ddd2",
  "enc_key": "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76",
  "master_enc_key_part": null,
  "constellation": null
}"#,
        discovery_run_resp_up_to_date: r#""UpToDate""#,
        discovery_run_resp_restarting: r#""Restarting""#,
        result_ok_up_to_date: r#"{"Ok":"UpToDate"}"#,
        result_err_please_retry: r#"{"Err":"PleaseRetry"}"#,
        result_err_internal_error: r#"{"Err":"InternalError"}"#,
        result_err_bad_request: r#"{"Err":"BadRequest"}"#,
    },
)];

#[test]
fn wire_compat() {
    // Canonical fixture inputs.  Deterministic so the recreated JSON matches
    // the snapshots byte-for-byte (modulo whitespace and key order).  Once a
    // pubhubs release has shipped a snapshot built from these inputs, do not
    // change them.

    let vk: VerifyingKey = "66b1419fae979516fb3807dda1b05026b2570a7ab2190254e524af4f0934ddd2"
        .parse()
        .unwrap();
    let pk: elgamal::PublicKey = elgamal::PublicKey::from_hex(
        "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76",
    )
    .unwrap();
    let id: id::Id = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        .parse()
        .unwrap();
    let ts = NumericDate::new(1_700_000_000);
    let phc_url: url::Url = "https://phc.example.test/".parse().unwrap();
    let tr_url: url::Url = "https://tr.example.test/".parse().unwrap();
    let auths_url: url::Url = "https://auths.example.test/".parse().unwrap();
    let gc_url: url::Url = "https://gc.example.test/".parse().unwrap();
    let v = "test-version".to_owned();

    let constellation = Constellation {
        id,
        created_at: ts,
        inner: Inner {
            transcryptor_url: tr_url.clone(),
            transcryptor_jwt_key: vk.clone(),
            transcryptor_enc_key: pk.clone(),
            transcryptor_master_enc_key_part: pk.clone(),
            phc_url: phc_url.clone(),
            phc_jwt_key: vk.clone(),
            phc_enc_key: pk.clone(),
            auths_url: auths_url.clone(),
            auths_jwt_key: vk.clone(),
            auths_enc_key: pk.clone(),
            master_enc_key: pk.clone(),
            global_client_url: gc_url,
            ph_version: Some(v.clone()),
        },
    };

    let phc_example = DiscoveryInfoResp {
        name: Name::PubhubsCentral,
        self_check_code: "selfcheck-phc".to_owned(),
        version: Some(v.clone()),
        phc_url: phc_url.clone(),
        jwt_key: vk.clone(),
        enc_key: pk.clone(),
        master_enc_key_part: Some(pk.clone()),
        constellation_or_id: Some(ConstellationOrId::Constellation(Box::new(constellation))),
    };

    let tr_example = DiscoveryInfoResp {
        name: Name::Transcryptor,
        self_check_code: "selfcheck-tr".to_owned(),
        version: Some(v.clone()),
        phc_url: phc_url.clone(),
        jwt_key: vk.clone(),
        enc_key: pk.clone(),
        master_enc_key_part: Some(pk.clone()),
        constellation_or_id: Some(ConstellationOrId::Id { id }),
    };

    let auths_blank_example = DiscoveryInfoResp {
        name: Name::AuthenticationServer,
        self_check_code: "selfcheck-auths".to_owned(),
        version: Some(v),
        phc_url,
        jwt_key: vk,
        enc_key: pk,
        master_enc_key_part: None,
        constellation_or_id: None,
    };

    let res_ok: Result<DiscoveryRunResp> = Ok(DiscoveryRunResp::UpToDate);
    let res_err_pleaseretry: Result<DiscoveryRunResp> = Err(ErrorCode::PleaseRetry);
    let res_err_internalerror: Result<DiscoveryRunResp> = Err(ErrorCode::InternalError);
    let res_err_badrequest: Result<DiscoveryRunResp> = Err(ErrorCode::BadRequest);

    macro_rules! check_snapshot {
        ($field:ident, $canonical:expr) => {
            check(stringify!($field), $canonical, |s| s.$field)
        };
    }

    check_snapshot!(discovery_info_resp_phc, &phc_example);
    check_snapshot!(discovery_info_resp_transcryptor, &tr_example);
    check_snapshot!(discovery_info_resp_auths_blank, &auths_blank_example);
    check_snapshot!(discovery_run_resp_up_to_date, &DiscoveryRunResp::UpToDate);
    check_snapshot!(discovery_run_resp_restarting, &DiscoveryRunResp::Restarting);
    check_snapshot!(result_ok_up_to_date, &res_ok);
    check_snapshot!(result_err_please_retry, &res_err_pleaseretry);
    check_snapshot!(result_err_internal_error, &res_err_internalerror);
    check_snapshot!(result_err_bad_request, &res_err_badrequest);
}

fn check<T>(field: &'static str, canonical: &T, project: impl Fn(&Snapshots) -> &'static str)
where
    T: serde::Serialize + serde::de::DeserializeOwned,
{
    assert!(!SNAPSHOTS.is_empty(), "SNAPSHOTS is empty");

    // 1. Every historical snapshot must still deserialize.
    for (label, snaps) in SNAPSHOTS {
        let json = project(snaps);
        if let Err(e) = serde_json::from_str::<T>(json) {
            panic!(
                "\n\nwire_compat (`{field}`): the JSON snapshot recorded in \
                 src/api/wire_compat.rs (SNAPSHOTS, entry {label:?}, field `{field}`) \
                 can no longer be deserialized into the current Rust type.\n\n\
                 That snapshot records the wire shape used by older pubhubs servers \
                 (see the module-level doc on snapshot labels).  If one such server \
                 sends this JSON to a server running your modified code, the modified \
                 code will reject it — breaking rolling upgrades.\n\n\
                 Likely cause: you renamed or removed a field, or added a required \
                 field without a default.  To make a new field tolerate old payloads \
                 that lack it, mark it `#[serde(default)]` (and typically use \
                 `Option<T>`).\n\n\
                 Deserialization error: {e}\n\n\
                 The snapshot JSON:\n{json}\n"
            );
        }
    }

    // 2. Find the most recent snapshot by version label.
    let latest_idx = (0..SNAPSHOTS.len())
        .max_by(|&a, &b| parse_label(SNAPSHOTS[a].0).cmp(&parse_label(SNAPSHOTS[b].0)))
        .expect("non-empty");
    let (latest_label, latest_snaps) = &SNAPSHOTS[latest_idx];
    let latest_json = project(latest_snaps);

    // 3. Recreate canonical and compare structurally to the latest snapshot.
    let recreated: serde_json::Value = serde_json::to_value(canonical).unwrap();
    let latest: serde_json::Value = serde_json::from_str(latest_json).unwrap_or_else(|e| {
        panic!("`{field}`: the latest snapshot ({latest_label:?}) is not valid JSON: {e}")
    });
    if recreated == latest {
        return;
    }

    let suggested = suggest_label(latest_label);
    let recommendation = if suggested == *latest_label {
        format!(
            "BEFORE editing anything, verify that no pubhubs release has been cut since \
             {latest_label:?} by running:\n\n    git tag --sort=-v:refname | head -5\n\n\
             - If any tag in the output sorts strictly above the version in \
             {latest_label:?}, that release has shipped the current snapshot.  Do NOT \
             edit it.  Instead, add a new SNAPSHOTS entry to src/api/wire_compat.rs \
             labelled `>v<that-newer-tag>`, with `{field}` set to the new JSON shown \
             below.  Leave the {latest_label:?} entry untouched.\n\n\
             - If NO newer release tag exists, the snapshot has not yet shipped and is \
             safe to update.  In src/api/wire_compat.rs, replace the `{field}` value of \
             the {latest_label:?} entry of SNAPSHOTS with the new JSON shown below."
        )
    } else {
        format!(
            "A pubhubs release appears to have been cut since {latest_label:?}, so the \
             snapshot recorded under that label has shipped and must NOT be edited.  Add \
             a new SNAPSHOTS entry to src/api/wire_compat.rs, labelled {suggested:?}, \
             with `{field}` set to the new JSON shown below.  Leave the {latest_label:?} \
             entry untouched."
        )
    };

    panic!(
        "\n\nwire_compat (`{field}`): the JSON the current code now serializes for this \
         type differs from the most recent snapshot recorded in src/api/wire_compat.rs \
         (SNAPSHOTS, entry {latest_label:?}, field `{field}`).  The wire format has \
         changed.\n\n\
         If you did not intend to change the wire format, revert your change.  Otherwise \
         note that other pubhubs servers running an older binary may not be able to \
         deserialize the new shape, breaking rolling upgrades — please make sure the \
         change is forward-compatible (typically: only add new fields, marked \
         `#[serde(default)]`, never remove or rename existing ones).\n\n\
         {recommendation}\n\n\
         New JSON to record:\n{rec}\n\n\
         Previously recorded snapshot, for comparison:\n{lat}\n",
        rec = serde_json::to_string_pretty(&recreated).unwrap(),
        lat = serde_json::to_string_pretty(&latest).unwrap(),
    );
}

fn parse_label(label: &str) -> semver::Version {
    let body = label
        .strip_prefix('>')
        .unwrap_or_else(|| panic!("snapshot label must start with '>': {label:?}"));
    version::to_semver(body).unwrap_or_else(|e| panic!("invalid snapshot label {label:?}: {e}"))
}

/// Suggested label for a freshly-introduced snapshot, derived from the current
/// build's `version::VERSION`.
///
/// Returns `>v<base-tag>` where `<base-tag>` is the most recent tag reachable
/// from `HEAD` (i.e. the part of `git describe` before its `-N-gHASH` suffix).
/// When that base equals the latest existing label, the recommendation will be
/// to edit that entry; otherwise to add a new one.
fn suggest_label(latest_label: &str) -> String {
    match version::version() {
        Some(v) => format!(">{}", strip_describe_suffix(v)),
        None => latest_label.to_owned(),
    }
}

/// Strips git-describe's trailing `-<count>-g<hash>` (and optional `-dirty`)
/// from a version string, returning the underlying tag.  Returns the input
/// unchanged when no such suffix is present.
fn strip_describe_suffix(v: &str) -> &str {
    let trimmed = v.strip_suffix("-dirty").unwrap_or(v);
    if let Some(g_idx) = trimmed.rfind("-g") {
        let left = &trimmed[..g_idx];
        if let Some(dash_idx) = left.rfind('-') {
            let count = &left[dash_idx + 1..];
            if !count.is_empty() && count.bytes().all(|b| b.is_ascii_digit()) {
                return &left[..dash_idx];
            }
        }
    }
    trimmed
}
