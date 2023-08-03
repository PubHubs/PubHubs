use anyhow::Result;
use clap::Parser as _;

#[cfg(not(feature = "old"))]
use clap::CommandFactory as _;

#[derive(clap::Parser)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

impl Cli {
    pub fn run(self) -> Result<()> {
        match self.command {
            None => {
                #[cfg(feature = "old")]
                return old::Args::default().run();

                #[cfg(not(feature = "old"))]
                {
                    println!("No command provided.");
                    Ok(Cli::command().print_long_help()?)
                }
            }

            Some(cmd) => match cmd {
                #[cfg(feature = "old")]
                Commands::Old(old_args) => old_args.run(),
            },
        }
    }
}

#[derive(clap::Subcommand, Debug)]
enum Commands {
    /// Runs the old pubhubs binary (default)
    #[cfg(feature = "old")]
    Old(old::Args),
}

#[cfg(feature = "old")]
mod old {
    use super::*;

    #[derive(clap::Args, Debug)]
    pub struct Args {}

    impl Default for Args {
        fn default() -> Self {
            Self {}
        }
    }

    impl Args {
        pub fn run(self) -> Result<()> {
            pubhubs::cli::old::main()
        }
    }
}

fn main() -> Result<()> {
    Cli::parse().run()
}
