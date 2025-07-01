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
        }
    }
}

#[derive(clap::Subcommand, Debug)]
enum Commands {
    /// Generates identifiers and/or key material
    Generate(generate::Args),
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
            let pk = crate::elgamal::PrivateKey::random();

            println!("x (private key): {}", pk.to_hex());
            println!("xB (public key): {}", pk.public_key().to_hex());

            Ok(())
        }
    }

    #[derive(clap::Args, Debug)]

    struct SigningKeyArgs {}

    #[allow(clippy::uninlined_format_args)]
    impl SigningKeyArgs {
        fn run(self) -> Result<()> {
            let sk = crate::api::SigningKey::generate();
            let vk: crate::api::VerifyingKey = sk.verifying_key().into();

            println!("  signing key: {}", sk);
            println!("verifying key: {}", vk);

            Ok(())
        }
    }
}
