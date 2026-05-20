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

        let mut cmd = std::process::Command::new(env!("CARGO"));
        cmd.current_dir(manifest)
            .arg("doc")
            .args(&self.cargo_args)
            .env("RUSTDOCFLAGS", format!("--html-in-header {katex_hdr}"));

        // We might be spawned by `cargo run`, which sets some CARGO_... environment variables that
        // would, by default, be inherited by the `cargo doc` we spawn. They're absent for a plain
        // top-level `cargo`, so leaking them in makes any build script that tracks one recompile on
        // every run — e.g. ring tracks CARGO_MANIFEST_DIR, see
        // https://github.com/rust-lang/cargo/issues/16134. Cargo overwrites them unconditionally, so
        // dropping them can never clobber a user-set value. We strip only these package-identity
        // vars, not config-input ones the user may have set on purpose.
        for (key, _) in std::env::vars_os() {
            if key
                .to_str()
                .is_some_and(|k| k.starts_with("CARGO_PKG_") || k.starts_with("CARGO_MANIFEST_"))
            {
                cmd.env_remove(&key);
            }
        }

        let status = cmd.status()?;
        ensure!(status.success(), "cargo doc exited with {status}");
        Ok(())
    }
}
