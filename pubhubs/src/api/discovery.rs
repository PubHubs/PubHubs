//! Endpoints for the 'discovery' process by which the pubhubs servers
//! (pubhubs central, authentication server, and transcryptor)
//! inform one another of updates in their configuration (URLs, public
//! key material, etc.) and of updates to their binaries.
//!
//! The idea is to minimize the manual coordination required between the
//! administrators of the different servers.  The transcryptor only
//! has to configure the URL of PHC, not, say, the public keys used by PHC,
//! which the transcryptor receives instead automatically via discovery.
//!
//! ## How it works
//!
//! PubHubs central takes the lead, and pulls information from the other
//! servers via the **[`DiscoveryInfo`] endpoint** (`GET .ph/discovery/info`),
//! building a **[`Constellation`]** that it makes available via its
//! own info endpoint.
//!
//! The other two servers wait for PHC to publish a constellation,
//! and check whether the details they advertised in their info
//! endpoints have been incorporated.  If so, they adopt
//! the constellation.  If not, they cue PHC to re-run its discovery
//! via the **[`DiscoveryRun`] endpoint** (`POST .ph/discovery/run`),
//! and go back to waiting for PHC to publish a constellation.
//!
//! After PHC has assembled its constellation, it checks whether the other
//! two servers have the same constellation installed.  If so, its discovery
//! finishes (until restarted by a call to the discovery run endpoint).
//! If not, and if another server, say, the transcryptor,
//! has an outdated constellation installed, it invokes the discovery run
//! endpoint of the transcryptor, poking it to re-run its discovery process
//! (i.e. pulling and checking the constellation from PHC).  If the transcryptor
//! has no constellation installed, PHC leaves it be (assuming its
//! discovery process is running), and will retry a bit later.
//!
//! ## A bit more detail
//!
//! The discovery process running inside each server can result in four outcomes:
//!  - [`DiscoverVerdict::Alright`]:  My constellation is up-to-date, **discovery done**
//!  - [`DiscoverVerdict::ConstellationOutdated`]: Discovery yielded an updated constellation.
//!    This will cause the server to tear down and **restart** its actix HTTP server with the new constellation.
//!  - [`DiscoverVerdict::BinaryOutdated`]:  Discovery revealed that one
//!    of the other servers is running a newer version of the `pubhubs` binary.  This will cause
//!    the current server to **exit** in the expectation that the system running this server will
//!    pull and spool up the new pubhubs binary.
//!  - [`ErrorCode::PleaseRetry`]: We're waiting for another server.  If this discovery process was
//!    invoked during the start-up of this server, the discovery process will simply be called
//!    again after some pause.  If this discovery was invoked by [`DiscoveryRun`], then the
//!    [`ErrorCode::PleaseRetry`] will simply be passed along to the requester.  
//!
//! # Examples
//! ## 1. All three servers start blank
//!
//! ```text
//! Transcryptor                PHC                   Auth Server
//!     |                        |                        |
//!     |---- info ------------->|                        |
//!     |<--- no const ----------|                        |
//! [ retry later ]              |                        |
//!     |                        |                        |
//!     |<--- info --------------|                        |
//!     |--- info, no const ---->|                        |
//!     |                        |---- info ------------->|
//!     |                        |<--- info, no const ----|
//!     |            [ build const, restart ]             |
//!     |                        |                        |
//!     |                        |---- info ------------->|
//!     |                        |<--- info, no const ----|
//!     |                [ check A later ]                |
//!     |                        |                        |
//!     |---- info ------------->|                        |
//!     |<----- const -----------|                        |
//! [ check & adopt const ]      |                        |
//! [ restart             ]      |                        |
//!     |---- info ------------->|                        |
//!     |<----- const -----------|                        |
//! [ matches installed   ]      |                        |
//! [ discovery done      ]      |                        |
//!     |                        |<--- info --------------|
//!     |                        |------ const ---------->|
//!     |                        |            [ check & adopt const ]
//!     |                        |            [ restart             ]
//!     |                        |<--- info --------------|
//!     |                        |------ const ---------->|
//!     |                        |            [ matches installed   ]
//!     |                        |            [ discovery done      ]
//!     |<--- info --------------|                        |
//!     |--- info, const ------->|                        |
//!     |                        |---- info ------------->|
//!     |                        |<--- info, const -------|
//!     |         [ const unchanged, and   ]              |        
//!     |         [   installed by A and T ]              |        
//!     |         [ discovery done         ]              |        
//!     |                        |                        |
//! ```
//!
//! ## 2. PHC is upgraded to a new version
//!
//! All servers are on constellation `C_old` when PHC is restarted and upgraded
//! from version `V_old` to `V_new`.
//!
//! ```text
//! Transcryptor                PHC                   Auth Server
//!     |                        |                        |
//!     |             [ upgraded to V_new ]               |
//!     |                        |                        |
//!     |<--- info --------------|---- info ------------->|
//!     |--- info, C_old ------->|<--- info, C_old -------|
//!     |             [ build C_new, restart ]            |
//!     |                        |                        |
//!     |<--- info --------------|---- info ------------->|
//!     |--- info, C_old ------->|<--- info, C_old -------|
//!     |     [ C_new unchanged, but                   ]  |
//!     |     [ T, A on C_old: trigger their discovery ]  |
//!     |                        |                        |
//!     |<--- run ---------------|------------- run ----->|
//!     |              [ check A and T later ]            |
//!     |                        |                        |
//!     |--- info -------------->|<------------ info -----|
//!     |<- C_new (inc. V_new) --|------------- C_new --->|
//! [ V_old < V_new: exit ]      |     [ V_old < V_new: exit ]
//! [   upgraded to V_new ]      |     [   upgraded to V_new ]
//!     |                        |                        |
//!     |--- info -------------->|<------------ info -----|
//!     |<-- C_new --------------|------------- C_new --->|
//! [ check & adopt C_new ]      |     [ check & adopt C_new ]
//! [ restart             ]      |     [ restart             ]
//!     |                        |                        |
//!     |--- info -------------->|<------------ info -----|
//!     |<--- C_new -------------|------------- C_new --->|
//! [ matches installed   ]      |     [ matches installed   ]
//! [ discovery done      ]      |     [ discovery done      ]
//!     |                        |                        |
//!     |<--- info --------------|---- info ------------->|
//!     |--- info, C_new ------->|<--- info, C_new -------|
//!     |              [ C_new unchanged, and   ]         |
//!     |              [   installed by A and T ]         |
//!     |              [ discovery done         ]         |
//!
//! ```
//!
//! ## 3. Transcryptor rotates a key
//!
//! All servers are on constellation `C_old`, when the transcryptor changes one
//! of its keys, and restarts.
//!
//! ```text
//! Transcryptor                PHC                   Auth Server
//!     |                        |                        |
//! [ changes key and restarts ] |                        |
//!     |                        |                        |
//!     |--- info -------------->|                        |
//!     |<-- C_old --------------|                        |
//! [ C_old has wrong key   ]    |                        |
//! [ trigger PHC discovery ]    |                        |
//!     |                        |                        |
//!     |---- run -------------->|                        |
//! [ check PHC later ]          |                        |
//!     |                        |                        |
//!     |<--- info --------------|---- info ------------->|
//!     |--- info, C_old ------->|<--- info, C_old -------|
//!     |           [ build C_new, restart ]              |
//!     |                        |                        |
//!     |<--- info --------------|---- info ------------->|
//!     |--- info, C_old ------->|<--- info, C_old -------|
//!     |     [ C_new unchanged, but                   ]  |
//!     |     [ T, A on C_old: trigger their discovery ]  |
//!     |                        |                        |
//!     |<--- run ---------------|------------- run ----->|
//!     |              [ check A and T later ]            |
//!     |                        |                        |
//!     |--- info -------------->|<------------ info -----|
//!     |<- C_new ---------------|------------- C_new --->|
//! [ check & adopt C_new ]      |     [ check & adopt C_new ]
//! [ restart             ]      |     [ restart             ]
//!     |                        |                        |
//!     |--- info -------------->|<------------ info -----|
//!     |<--- C_new -------------|------------- C_new --->|
//! [ matches installed   ]      |     [ matches installed   ]
//! [ discovery done      ]      |     [ discovery done      ]
//!     |                        |                        |
//!     |<--- info --------------|---- info ------------->|
//!     |--- info, C_new ------->|<--- info, C_new -------|
//!     |              [ C_new unchanged, and   ]         |
//!     |              [   installed by A and T ]         |
//!     |              [ discovery done         ]         |
//! ```
//!
//! [`Constellation`]: crate::servers::constellation::Constellation
//! [`Config::phc_url`]: crate::servers::config::Config::phc_url
//! [`ServerConfig::self_check_code`]: crate::servers::config::ServerConfig::self_check_code
//! [`DiscoveryInfo`]: super::DiscoveryInfo
//! [`DiscoveryInfoResp`]: super::DiscoveryInfoResp
//! [`constellation_or_id`]: super::DiscoveryInfoResp::constellation_or_id
//! [`DiscoveryRun`]: super::DiscoveryRun
//! [`UpToDate`]: super::DiscoveryRunResp::UpToDate
//! [`Restarting`]: super::DiscoveryRunResp::Restarting
//! [`PleaseRetry`]: crate::api::ErrorCode::PleaseRetry
//! [`DiscoverVerdict::Alright`]: crate::servers::DiscoverVerdict::Alright
//! [`DiscoverVerdict::ConstellationOutdated`]: crate::servers::DiscoverVerdict::ConstellationOutdated
//! [`DiscoverVerdict::BinaryOutdated`]: crate::servers::DiscoverVerdict::BinaryOutdated

use serde::{Deserialize, Serialize};

use crate::api::*;
use crate::common::{elgamal, kem};
use actix_web::http;

/// Public details about this server, including its current [`Constellation`].
/// Used by `PHC` to build and publish its [`Constellation`].
///
/// [`Constellation`]: crate::servers::constellation::Constellation
pub struct DiscoveryInfo {}
impl EndpointDetails for DiscoveryInfo {
    type RequestType = NoPayload;
    type ResponseType = Result<DiscoveryInfoResp>;

    const METHOD: http::Method = http::Method::GET;
    const PATH: &'static str = ".ph/discovery/info";
}

/// Has the server run its discovery procedure, if it isn't already.
pub struct DiscoveryRun {}
impl EndpointDetails for DiscoveryRun {
    type RequestType = NoPayload;
    type ResponseType = Result<DiscoveryRunResp>;

    const METHOD: http::Method = http::Method::POST;
    const PATH: &'static str = ".ph/discovery/run";
}

/// What's returned by the [`DiscoveryInfo`].
///
/// <div class="warning">
///
/// **Warning:** when modifying [`DiscoveryInfoResp`] make sure that
///
///  1.  PHC will not crash on the outdated disovery info responses returned by
///      the transcryptor and authentication server before they are updated;
///
///  2.  Old authentication server and transcryptor code will not crash on the updated  discovery
///      info response returned by PHC.
///
/// </div>
#[derive(Serialize, Deserialize, Debug, Clone)]
// NOTE: `deny_unknown_fields` was deliberately dropped here so that future versions can add fields
// without breaking deserialization at this version.  Be aware that v3.3.0 and earlier DID set it,
// so a field that PHC emits still breaks those peers until they are out of rotation.
#[must_use]
pub struct DiscoveryInfoResp {
    pub name: crate::servers::Name,

    /// Random string used by a server to check that it has contact with itself.
    pub self_check_code: String,

    /// The version of this server (based on git tags).
    ///
    /// `None` if not available for some reason
    pub version: Option<String>,

    /// URL of the PubHubs Central server this server tries to connect to.
    pub phc_url: url::Url,

    /// Deprecated ed25519 jwt key, kept for wire compatibility; see [`DeprecatedJwtKey`].
    /// Superseded by [`verifying_key`](Self::verifying_key).
    #[serde(default)]
    pub jwt_key: DeprecatedJwtKey,

    /// This server's hybrid post-quantum verifying key, used to verify its JWTs and signatures.
    /// Only `None` in v3.3.0 and earlier; drop the `Option` once those versions are out of rotation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verifying_key: Option<VerifyingKeyBytes>,

    /// Formerly the ElGamal key for encrypting to / establishing shared secrets with this server;
    /// superseded by the post-quantum [`encap_key`].  Currently a placeholder zero pubkey; the
    /// `Option` lets a future version omit it.
    ///
    /// TODO: remove this field entirely once v3.3.0 and earlier (which require it) are out of
    /// rotation.
    ///
    /// [`encap_key`]: Self::encap_key
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enc_key: Option<elgamal::PublicKey>,

    /// Formerly the master encryption key part, `x_PHC B` or `x_T B` in the notation of the
    /// whitepaper; now a placeholder zero pubkey (still set, as `Some(zero)`, by PHC and the
    /// transcryptor).  Superseded by [`master_enc_key_part_hash`] and, for the transcryptor,
    /// [`master_enc_key_part_sealed`], so the part is not exposed in the clear.
    ///
    /// TODO: remove this field entirely once v3.3.0 and earlier (which require it) are out of
    /// rotation.
    ///
    /// [`master_enc_key_part_hash`]: Self::master_enc_key_part_hash
    /// [`master_enc_key_part_sealed`]: Self::master_enc_key_part_sealed
    pub master_enc_key_part: Option<elgamal::PublicKey>,

    /// Hash of the transcryptor's master encryption key part `x_T B`, published so PHC can commit
    /// it to the constellation id before it is able to unseal the part itself.  Set by the
    /// transcryptor only: PHC commits its own part's hash to the constellation directly, and must
    /// not add discovery-info fields that pre-v3.3.0 peers (which `deny_unknown_fields`) reject.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub master_enc_key_part_hash: Option<crate::id::Id>,

    /// The transcryptor's master encryption key part `x_T B`, sealed under the secret it shares
    /// with PHC, so PHC can recover it without `x_T B` being exposed in the clear.  Set by the
    /// transcryptor once that shared secret has been established.
    ///
    /// Unlike [`master_enc_key_part_hash`](Self::master_enc_key_part_hash), this does not influence
    /// the constellation (id): PHC recovering the part updates only PHC's own running state, not
    /// the published constellation, so it does not trigger a constellation change at T or AS.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub master_enc_key_part_sealed: Option<Sealed<MasterEncKeyPart>>,

    /// Hybrid post-quantum [`kem`] encapsulation key, used by pubhubs central to establish
    /// a shared secret with this server.  Only set for the transcryptor and authentication server.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub encap_key: Option<kem::EncapKeyBytes>,

    /// Details of the other PubHubs servers, according to this server
    /// `None` when discovery has not been completed.
    #[serde(rename = "constellation")]
    pub constellation_or_id: Option<crate::servers::constellation::ConstellationOrId>,
}

/// A master encryption key part, wrapped so it can be sealed as
/// [`DiscoveryInfoResp::master_enc_key_part_sealed`].
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MasterEncKeyPart(pub elgamal::PublicKey);

having_message_code!(MasterEncKeyPart, MasterEncKeyPart);

/// What's returned by the [`DiscoveryRun`].
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
#[serde(deny_unknown_fields)]
#[must_use]
pub enum DiscoveryRunResp {
    /// Everything checks out at our side
    UpToDate,

    /// Changes were made and we're restarting now. It'd probably be good to check our discovery
    /// info again in a moment.
    Restarting,
}
