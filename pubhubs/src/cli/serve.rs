#[derive(clap::Args, Debug)]
pub struct ServeArgs {
    /// Configuration file
    #[arg(short, long, value_name = "FILE")]
    config: Option<std::path::PathBuf>,
}

impl ServeArgs {
    pub fn run(self) -> Result<(), clap::error::Error> {
        println!("hi there! {:?}", self.config);
        Ok(())
    }
}
