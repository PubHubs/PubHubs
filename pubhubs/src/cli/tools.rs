use crate::common::elgamal::Encoding as _;
use anyhow::Result;

#[derive(clap::Args, Debug)]
pub struct ToolsArgs {
    #[command(subcommand)]
    command: Commands,
}

impl ToolsArgs {
    pub fn run(self, _spec: &mut clap::Command) -> Result<()> {
        match self.command {
            Commands::Generate(args) => args.run(),
            Commands::YiviEpoch(args) => args.run(),
        }
    }
}

#[derive(clap::Subcommand, Debug)]
enum Commands {
    /// Generates identifiers and/or key material
    Generate(generate::Args),

    /// Prints information about the current Yivi epoch
    YiviEpoch(YiviEpochArgs),
}

#[derive(clap::Args, Debug)]
struct YiviEpochArgs {
    /// Print information about the NUMBERth yivi epoch
    #[arg(long, value_name = "NUMBER", conflicts_with = "at")]
    nr: Option<u64>,

    /// Print information about the yivi epoch at the given TIMESTAMP such as '2025-12-17 15:15:15'
    #[arg(
        long,
        value_name = "TIMESTAMP",
        value_parser = humantime::parse_rfc3339_weak,
        conflicts_with = "nr"
    )]
    at: Option<std::time::SystemTime>,
}

impl YiviEpochArgs {
    fn run(self) -> Result<()> {
        let epoch = if let Some(nr) = self.nr {
            crate::servers::yivi::Epoch::with_seqnr(nr)
        } else if let Some(at) = self.at {
            let nd: crate::api::NumericDate = at.into();
            crate::servers::yivi::Epoch::from(nd)
        } else {
            crate::servers::yivi::Epoch::current()
        };

        print!("{}", epoch);

        Ok(())
    }
}

/// Implementation details of [`Commands::Generate`].
mod generate {
    use super::*;

    #[derive(clap::Args, Debug)]
    pub(super) struct Args {
        #[command(subcommand)]
        command: Commands,
    }

    impl Args {
        pub(super) fn run(self) -> Result<()> {
            match self.command {
                Commands::Id(args) => args.run(),
                Commands::Scalar(args) => args.run(),
                Commands::SigningKey(args) => args.run(),
                Commands::DecapKey(args) => args.run(),
            }
        }
    }

    #[derive(clap::Subcommand, Debug)]
    enum Commands {
        /// Generate a random identifier for e.g. a hub, attribute type, ...
        Id(IdArgs),

        /// Generate a random ristretto25519 scalar to be used e.g. as elgamal private key
        Scalar(ScalarArgs),

        /// Generate a random ed25519 signing key
        SigningKey(SigningKeyArgs),

        /// Generate a decapsulation key
        DecapKey(DecapKeyArgs),
    }

    #[derive(clap::Args, Debug)]
    struct IdArgs {}

    impl IdArgs {
        fn run(self) -> Result<()> {
            println!("{}", crate::id::Id::random());

            Ok(())
        }
    }

    #[derive(clap::Args, Debug)]
    struct ScalarArgs {}

    impl ScalarArgs {
        fn run(self) -> Result<()> {
            let pk = crate::common::elgamal::PrivateKey::random();

            println!("x (private key): {}", pk.to_hex());
            println!("xB (public key): {}", pk.public_key().to_hex());

            Ok(())
        }
    }

    #[derive(clap::Args, Debug)]

    struct SigningKeyArgs {}

    impl SigningKeyArgs {
        fn run(self) -> Result<()> {
            let sk = crate::api::SigningKey::generate()
                .map_err(|_| anyhow::anyhow!("failed to generate signing key"))?;

            println!("  signing key: {}", serde_json::to_string(&sk.encode())?);
            println!(
                "verifying key: {}",
                serde_json::to_string(&sk.verifying_key().encode())?
            );

            Ok(())
        }
    }

    #[derive(clap::Args, Debug)]
    struct DecapKeyArgs {}

    impl DecapKeyArgs {
        fn run(self) -> Result<()> {
            let dk = crate::common::kem::DecapKey::generate()
                .map_err(|_| anyhow::anyhow!("failed to generate decapsulation key"))?;

            let encap_key_id = dk
                .encap_key()
                .encode()
                .map_err(|_| anyhow::anyhow!("failed to encode encapsulation key"))?
                .id();

            let decap_key = dk
                .encode()
                .map_err(|_| anyhow::anyhow!("failed to encode decapsulation key"))?;

            println!("# corresponding encapsulation key id: {encap_key_id}");
            println!("{}", decap_key_config_snippet(&decap_key)?);

            Ok(())
        }
    }

    /// Renders `decap_key = { ... }` as a multi-line inline table (so it can be pasted under a
    /// transcryptor or authentication server), wrapping the long base64 fields across lines.  The
    /// structure is written via [`toml_writer`]; only the `\`-folding - which no TOML serializer
    /// does for us - is done here.
    fn decap_key_config_snippet(decap_key: &crate::common::kem::DecapKeyBytes) -> Result<String> {
        use core::fmt::Write as _;
        use toml_writer::{TomlStringBuilder, TomlWrite as _};

        /// Target maximum line width.
        const COLUMN_WIDTH: usize = 100;
        /// Indentation of a value's wrapped base64 lines.
        const INDENT: &str = "    ";

        // Leave room for the indent and either a trailing `\` or the closing `"""`.
        let chunk_width = COLUMN_WIDTH - INDENT.len() - 3;

        /// A `\`-line-folded multi-line basic string.  The opening `"""\` and each trailing `\`
        /// swallow the following newline and indentation, so this reparses to exactly `s` while
        /// every printed line stays indented and within the column width.
        fn folded(s: &str, indent: &str, chunk_width: usize) -> String {
            let mut out = String::from("\"\"\"\\\n");
            let mut rest = s;
            while rest.len() > chunk_width {
                let (head, tail) = rest.split_at(chunk_width);
                out.push_str(indent);
                out.push_str(head);
                out.push_str("\\\n");
                rest = tail;
            }
            out.push_str(indent);
            out.push_str(rest);
            out.push_str("\"\"\"");
            out
        }

        // The fields are private, so enumerate them through `toml::Value`.
        let value = toml::Value::try_from(decap_key)
            .map_err(|_| anyhow::anyhow!("failed to serialize decapsulation key"))?;
        let table = value
            .as_table()
            .expect("a decapsulation key serializes to a table");

        let mut out = String::new();
        out.key("decap_key")?;
        out.space()?;
        out.keyval_sep()?;
        out.space()?;
        out.open_inline_table()?;
        out.newline()?;
        for (field, value) in table.iter() {
            let value = value
                .as_str()
                .expect("decapsulation key fields serialize to strings");

            out.write_str("  ")?;
            out.key(field.as_str())?;
            out.space()?;
            out.keyval_sep()?;
            out.space()?;

            if value.len() <= chunk_width {
                out.value(TomlStringBuilder::new(value).as_basic())?;
            } else {
                out.write_str(&folded(value, INDENT, chunk_width))?;
            }

            out.val_sep()?;
            out.newline()?;
        }
        out.close_inline_table()?;

        Ok(out)
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn decap_key_snippet_reparses() {
            let decap_key = crate::common::kem::DecapKey::generate()
                .unwrap()
                .encode()
                .unwrap();

            let snippet = decap_key_config_snippet(&decap_key).unwrap();

            #[derive(serde::Deserialize)]
            struct Parsed {
                decap_key: crate::common::kem::DecapKeyBytes,
            }
            let parsed: Parsed = toml::from_str(&snippet).expect("snippet should reparse");

            // `DecapKeyBytes` isn't `PartialEq`, so compare via re-serialization.
            assert_eq!(
                serde_json::to_string(&parsed.decap_key).unwrap(),
                serde_json::to_string(&decap_key).unwrap(),
            );
        }
    }
}
