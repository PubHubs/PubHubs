use std::ffi::OsString;

use anyhow::{Result, ensure};

#[derive(clap::Args, Debug)]
pub struct DocArgs {
    /// Arguments forwarded to `cargo doc` (e.g. `--open`, `--document-private-items`, `--no-deps`).
    #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
    cargo_args: Vec<OsString>,
}

impl DocArgs {
    pub fn run(self, _spec: &mut clap::Command) -> Result<()> {
        let manifest = env!("CARGO_MANIFEST_DIR");
        let katex_hdr = format!("{manifest}/docs/assets/rustdoc-include-katex-header.html");
        let status = std::process::Command::new(env!("CARGO"))
            .current_dir(manifest)
            .arg("doc")
            .args(&self.cargo_args)
            .env("RUSTDOCFLAGS", format!("--html-in-header {katex_hdr}"))
            .status()?;
        ensure!(status.success(), "cargo doc exited with {status}");
        Ok(())
    }
}
