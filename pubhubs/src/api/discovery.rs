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
use crate::common::elgamal;
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
#[serde(deny_unknown_fields)]
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

    /// Used to sign JWTs from this server.
    pub jwt_key: VerifyingKey,

    /// Used to encrypt messages to this server, and to create shared secrets with this server
    /// using Diffie-Hellman
    pub enc_key: elgamal::PublicKey,

    /// Master encryption key part, that is, `x_PHC B` or `x_T B` in the notation of the
    /// whitepaper.  Only set for PHC or the transcryptor.
    pub master_enc_key_part: Option<elgamal::PublicKey>,

    /// Details of the other PubHubs servers, according to this server
    /// `None` when discovery has not been completed.
    #[serde(rename = "constellation")]
    pub constellation_or_id: Option<crate::servers::constellation::ConstellationOrId>,
}

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
