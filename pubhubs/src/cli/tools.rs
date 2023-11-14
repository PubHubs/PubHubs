use crate::hub;

use anyhow::Result;

#[derive(clap::Args, Debug)]
pub struct ToolsArgs {
    #[command(subcommand)]
    command: Commands,
}

impl ToolsArgs {
    pub fn run(self, _spec: &mut clap::Command) -> Result<()> {
        match self.command {
            Commands::GenerateHubid(args) => args.run(),
        }
    }
}

#[derive(clap::Subcommand, Debug)]
enum Commands {
    /// Generates a random hub identifier
    GenerateHubid(GenerateHubidArgs),
}

#[derive(clap::Args, Debug)]
pub struct GenerateHubidArgs {}

impl GenerateHubidArgs {
    fn run(self) -> Result<()> {
        println!("{}", hub::Id::random());

        Ok(())
    }
}
