//! Configuration of logging
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(deny_unknown_fields)]
pub struct LogConfig {
    #[serde(default)]
    level: Option<log::LevelFilter>,

    #[serde(default)]
    modules: indexmap::IndexMap<String, log::LevelFilter>,
}

impl LogConfig {
    /// Initialize [`env_logger`] (if it isn't already) by using the given configuration.
    pub fn try_init_env_logger(&self) {
        let mut builder = env_logger::Builder::from_default_env();

        if let Some(level) = self.level {
            builder.filter_level(level);
        }

        for (module, level) in &self.modules {
            builder.filter_module(module, *level);
        }

        if builder.try_init().is_err() {
            log::warn!(
                "not using logger configuration from configuration file: logger already initialized by RUST_LOG environmental variable"
            );
        };
    }
}
