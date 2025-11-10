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
            None => Err(spec.error(
                clap::error::ErrorKind::MissingSubcommand,
                "no command provided",
            )),

            Some(cmd) => match cmd {
                Commands::Serve(args) => run_args!(args, "serve"),
                Commands::Tools(args) => run_args!(args, "tools"),
                Commands::Admin(args) => run_args!(args, "admin"),
                Commands::Enter(args) => run_args!(args, "enter"),
            },
        }
    }
}

#[derive(clap::Subcommand, Debug)]
enum Commands {
    /// Run one (or multiple) PubHubs servers
    Serve(pubhubs::cli::ServeArgs),

    /// Miscellaneous utilities
    Tools(pubhubs::cli::ToolsArgs),

    /// Administer a running server
    Admin(pubhubs::cli::AdminArgs),

    /// Enter a hub, returning a Synapse access token
    Enter(pubhubs::cli::EnterArgs),
}

fn main() {
    if let Err(err) = Cli::parse().run(Cli::command()) {
        err.exit()
    }
}
