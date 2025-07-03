use clap::Parser as _;

use clap::CommandFactory as _;

#[derive(clap::Parser)]
struct Cli {
    /// Command to run
    #[command(subcommand)]
    command: Option<Commands>,
}

impl Cli {
    pub fn run(self, mut spec: clap::Command) -> Result<(), clap::error::Error> {
        macro_rules! run_args {
            ($args:ident,  $name:literal) => {{
                let subspec = spec.find_subcommand_mut($name).expect(concat!(
                    "no '",
                    $name,
                    "' subcommand; was it renamed?",
                ));

                $args.run(subspec).map_err(|err| {
                    subspec.error(clap::error::ErrorKind::InvalidValue, format!("{:?}", err))
                })
            }};
        }

        match self.command {
            None => {
                #[cfg(feature = "old")]
                {
                    let args = old::Args::default();

                    run_args!(args, "old")
                }

                #[cfg(not(feature = "old"))]
                {
                    Err(spec.error(
                        clap::error::ErrorKind::MissingSubcommand,
                        "no command provided",
                    ))
                }
            }

            Some(cmd) => match cmd {
                #[cfg(feature = "old")]
                Commands::Old(args) => run_args!(args, "old"),

                Commands::Serve(args) => run_args!(args, "serve"),
                Commands::Tools(args) => run_args!(args, "tools"),
                Commands::Admin(args) => run_args!(args, "admin"),
                Commands::Enter(args) => run_args!(args, "enter"),
            },
        }
    }
}

#[derive(clap::Subcommand, Debug)]
#[expect(clippy::large_enum_variant)]
enum Commands {
    /// Runs the old pubhubs binary (default)
    #[cfg(feature = "old")]
    Old(old::Args),

    /// Run one (or multiple) PubHubs servers
    Serve(pubhubs::cli::ServeArgs),

    /// Miscellaneous utilities
    Tools(pubhubs::cli::ToolsArgs),

    /// Administer a running server
    Admin(pubhubs::cli::AdminArgs),

    /// Enter a hub, returning a Synapse access token
    Enter(pubhubs::cli::EnterArgs),
}

#[cfg(feature = "old")]
mod old {
    #[derive(clap::Args, Debug, Default)]
    pub struct Args {}

    impl Args {
        pub fn run(self, _spec: &mut clap::Command) -> anyhow::Result<()> {
            pubhubs::cli::old::main()
        }
    }
}

fn main() {
    if let Err(err) = Cli::parse().run(Cli::command()) {
        err.exit()
    }
}
