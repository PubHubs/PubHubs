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
            }
        }
    }

    #[derive(clap::Subcommand, Debug)]
    enum Commands {
        /// Generate a random identifier for e.g. a hub, attribute type, ...
        Id(IdArgs),
    }

    #[derive(clap::Args, Debug)]
    struct IdArgs {}

    impl IdArgs {
        fn run(self) -> Result<()> {
            println!("{}", crate::id::Id::random());

            Ok(())
        }
    }
}
