use anyhow::Result;

#[derive(clap::Args, Debug)]
pub struct ToolsArgs {
    #[command(subcommand)]
    command: Commands,
}

impl ToolsArgs {
    pub fn run(self, _spec: &mut clap::Command) -> Result<()> {
        match self.command {
            Commands::GenerateId(args) => args.run(),
        }
    }
}

#[derive(clap::Subcommand, Debug)]
enum Commands {
    /// Generates a random identifier
    GenerateId(GenerateIdArgs),
}

#[derive(clap::Args, Debug)]
pub struct GenerateIdArgs {}

impl GenerateIdArgs {
    fn run(self) -> Result<()> {
        println!("{}", crate::id::Id::random());

        Ok(())
    }
}
