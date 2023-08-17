use clap::Parser as _;

use clap::CommandFactory as _;

#[derive(clap::Parser)]
struct Cli {
    /// Command to run
    #[command(subcommand)]
    command: Option<Commands>,
}

impl Cli {
    pub fn run(self) -> Result<(), clap::error::Error> {
        match self.command {
            None => {
                #[cfg(feature = "oldbin")]
                return old::Args::default().run();

                #[cfg(not(feature = "oldbin"))]
                {
                    Err(Cli::command().error(
                        clap::error::ErrorKind::MissingSubcommand,
                        "no command provided",
                    ))
                }
            }

            Some(cmd) => match cmd {
                #[cfg(feature = "oldbin")]
                Commands::Old(old_args) => old_args.run().map_err(|err| {
                    Cli::command()
                        .find_subcommand_mut("old")
                        .expect("no 'old' subcommand; was it renamed?")
                        .error(clap::error::ErrorKind::InvalidValue, format!("{:?}", err))
                }),

                Commands::Serve(serve_args) => serve_args.run().map_err(|err| {
                    Cli::command()
                        .find_subcommand_mut("serve")
                        .expect("no 'serve' subcommand; was it renamed?")
                        .error(clap::error::ErrorKind::InvalidValue, format!("{:?}", err))
                }),
            },
        }
    }
}

#[derive(clap::Subcommand, Debug)]
enum Commands {
    /// Runs the old pubhubs binary (default)
    #[cfg(feature = "oldbin")]
    Old(old::Args),

    /// Run one (or multiple) PubHubs servers
    Serve(pubhubs::cli::ServeArgs),
}

#[cfg(feature = "oldbin")]
mod old {
    use super::*;

    #[derive(clap::Args, Debug, Default)]
    pub struct Args {}

    impl Args {
        pub fn run(self) -> Result<(), clap::error::Error> {
            pubhubs::cli::old::main()
                .map_err(|err| Cli::command().error(clap::error::ErrorKind::InvalidValue, err))
        }
    }
}

fn main() {
    if let Err(err) = Cli::parse().run() {
        err.exit()
    }
}
