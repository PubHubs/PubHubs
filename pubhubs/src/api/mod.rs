//! Types describing the pubhubs API
//!
//! The different endpoints offered by the PubHubs servers and hubs are described by types
//! implementing the [`EndpointDetails`] trait.
//!
//! # Overview for web clients
//!
//! ## Entering pubhubs
//!
//!  1. Everything starts with the global client, knowing only the url of pubhubs central (PHC),
//!     obtaining general information about the rest of the pubhubs environment
//!     from the [`phc::user::WelcomeEP`] endpoint of PHC, including, for example, the url of
//!     the authentication server and transcryptor.
//!
//!  2. Next the user authenticates towards the
//!     authentication server in order to obtain **[`Attr`]ibutes**.
//!  
//!     -  The global client first gets the available authentication methods via [`auths::WelcomeEP`], and
//!     -  then obtains the attributes using the [`auths::AuthStartEP`]
//!        and [`auths::AuthCompleteEP`] endpoints.
//!
//!  3. Using those [`Attr`]ibutes the global client can 'enter' PubHubs via the
//!     [`phc::user::EnterEP`], registering a new account if needed.
//!     or logging into an existing account.  The result of entering PubHubs is not
//!     a session cookie, but an **[`phc::user::AuthToken`]** that must be passed along
//!     in the `Authorization` header of most subsequent requests from the global client to PHC.
//!
//!  4. After having entered pubhubs, the global client retrieves details on the [`phc::user::UserState`] via
//!     the [`phc::user::StateEP`] endpoint (authenticating using the previously obtained auth token).  
//!     The user state includes (among other details), a list of stored **user objects**,
//!     [`phc::user::UserState::stored_objects`], which can be retrieved using
//!     [`phc::user::GetObjectEP`] (and stored using [`phc::user::OverwriteObjectEP`] and
//!     [`phc::user::NewObjectEP`]).
//!
//!  5. The contents of user objects should be encrypted by the global client. Indeed, there's
//!     no need for PHC to be able to read the contents of these user objects.
//!     But where can the global client store the 'user object key' used to encrypt
//!     these objects?  Not in plaintext at PHC!  Instead, the authentication server provides
//!     **attribute keys** via [`auths::AttrKeysEP`] with which the global client can encrypt its
//!     'user object key' before storing it at PHC in a designated user object.  Other user objects
//!     can then be encrypted using this user object key.
//!
//! ## Entering hubs
//!
//! Entering a hub is slightly more involved, as pubhubs central is not allowed to know the hub and
//! the transcryptor is not allowed to know the user.  These privacy guarantees can be achieved by
//! clever use of elliptic curves as described in [the whitepaper](https://academic.oup.com/logcom/article/34/7/1377/7319213)  
//! The procedure below uses the same
//! ideas but has been modified to prevent already generated pseudonyms from being linked
//! when a large quantum computer ever materializes.
//!
//!  1. The global client obtains a sealed  **[`sso::PolymorphicPseudonymPackage`] (PPP)**
//!     from PHC via [`phc::user::PppEP`] and a **hub nonce** and **hub state**
//!     pair from the hub via [`hub::EnterStartEP`].
//!
//!  2. The global client sends the PPP, hub nonce and hub id to the transcryptor's
//!     [`tr::EhppEP`], which yields a sealed **[`sso::EncryptedHubPseudonymPackage`] (EHPP)**.
//!
//!  3. This EHPP is forwarded back to PHC, to the [`phc::user::HhppEP`], yielding a signed
//!     **[`sso::HashedHubPseudonymPackage`] (HHPP)**.
//!
//!  4. This HHPP is sent back by the global client to the hub's [`hub::EnterCompleteEP`],
//!     together with the **hub state**, which results in a Synapse access token to the hub.
//!
//! # Errors
//!
//! A request to a pubhubs endpoint may fail in several ways.
//!
//!  1. Errors that are par for the course are generally encoded in
//!     [`EndpointDetails::ResponseType`] types themselves.  For example,
//!     [`phc::user::EnterResp::AccountDoesNotExist`] is returned when a user tries to log into an
//!     account that does not exist.  It should always be clear to the caller how to act on these errors.
//!
//!  2. Other errors, such as unexpected errors, or errors caused by the caller breaking protocol
//!     in some avoidable manner are generally  returned via the [`ErrorCode`]
//!     in the `Result<EndpointDetails::ResponseType, ErrorCode>`
//!     returned by the endpoint. Notable errors are:
//!
//!     - **[`ErrorCode::InternalError`]**: something unexpected went wrong internally.  
//!       Consult the logs of the server for more details.  Retrying the request is not
//!       recommended.
//!
//!     - **[`ErrorCode::NotYetReady`], [`ErrorCode::TemporaryFailure`], [`ErrorCode::SeveredConnection`]**:
//!       just wait a moment, and retry the same request.
//!
//!     - **[`ErrorCode::BadRequest`]**: there's something wrong with the request - do not
//!       retransmit the same request.
//!
//!     (Note: I'm not completely happy with the current [`ErrorCode`] - it's not clear enough how to act on
//!     the different errors.)
//!
//!  3. It may, however, happen that a request is rejected before it reaches our code, for example,
//!     by the HTTP framework [`actix_web`] or by the reverse proxy.  One may in that case encounter a
//!     HTTP status code (or even a TCP/TLS disconnect).  Notable HTTP status codes are:
//!
//!      - **400 - Bad Request**  Occurs, for example, when the json in the request body cannot be deserialized
//!        to the [`EndpointDetails::RequestType`].
//!
//!      - **502 - Bad Gateway**  Occurs, for example, when one of the servers is (temporarily)
//!        down.  The client should try the same request again.
//!
//!  4. A response may also be rejected when it arrives at a browser, for example, due to improperly set
//!     [Cross-Origin Resource Sharing] headers.  
//!
//! [Cross-Origin Resource Sharing]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS
//! [`Attr`]: crate::attr::Attr
mod common;
pub use common::*;
mod signed;
pub use signed::*;
mod sealed;
pub use sealed::*;
mod discovery;
pub use discovery::*;
pub mod admin;

pub mod auths;
pub mod hub;
pub mod phc;
pub mod phct;
pub mod tr;

pub mod sso;

pub use crate::misc::jwt::NumericDate;
