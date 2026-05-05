//! Backend servers for [pubhubs](https://app.pubhubs.net).
//!
//! <div class="katex-warning" style="border:2px solid #c00;background:#fee;color:#600;padding:0.75em 1em;border-radius:4px;">
//! <strong>KaTeX header not loaded.</strong>
//! Math in doc-comments will not render.  Build with <code>cargo doc-math</code>
//! instead of plain <code>cargo doc</code>.
//! </div>
//!
//! See [`api`] for an overview.

pub mod cli;

pub mod api;
pub mod attr;
pub mod client;
pub mod common;
pub mod handle;
pub mod hub;
pub mod id;
pub mod map;
pub mod misc;
pub mod phcrypto;
pub mod servers;
