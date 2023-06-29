use crate::config::having_debug_default;
use crate::data::Hub;
use crate::elgamal;
use anyhow::{anyhow, ensure, Context as _, Result};
use std::fmt::{Debug, Formatter};

/// A convenience struct that can be used to share needed configuration around.
#[derive(Clone)]
pub struct PepContext {
    global_public_key: elgamal::PublicKey,
    global_secret_key: String,
    factor_secret: String,
    libpep_location: String,
}

impl Debug for PepContext {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PepContext")
            .field("libpep_location", &self.libpep_location)
            .finish()
    }
}

impl PepContext {
    pub fn from_config(config: crate::config::Pep) -> Result<Self> {
        Ok(PepContext {
            global_public_key: elgamal::PublicKey::from_hex(&having_debug_default(
                config.global_public_key,
                "d4d7f622c53c86d64597f089273350b950aa53b078185aa4a04c487d9709d66d",
                "pep.global_public_key",
            )?)
            .context("invalid global_public_key hex representation")?,
            global_secret_key: having_debug_default(
                config.global_secret_key,
                "b6c57e69b093a34fa2546bc59c7940fd304d91e9c68602d237989d74f1172908",
                "pep.global_secret_key",
            )?,
            factor_secret: having_debug_default(
                config.factor_secret,
                "default_factor_secret",
                "pep.factor_secret",
            )?,
            libpep_location: config.libpep_location,
        })
    }

    /// Calls libpepcli with the provided arguments.
    fn libpepcli<I, S>(&self, args: I) -> Result<String>
    where
        I: std::iter::IntoIterator<Item = S>,
        S: AsRef<std::ffi::OsStr>,
    {
        let command = std::process::Command::new(&self.libpep_location)
            .args(args)
            .output()?;

        ensure!(
            command.status.success(),
            "command failed code: {} stdout: {:?}  stderr {:?}",
            command.status,
            command.stdout,
            command.stderr
        );

        Ok(String::from_utf8(command.stderr)?.trim().to_string())
    }

    /// Generate the (polymorphic and encrypted) pseudonym for a user.
    pub fn generate_pseudonym(&self) -> elgamal::Triple {
        self.global_public_key.encrypt_random()
    }

    pub fn make_local_decryption_key(&self, hub: &Hub) -> Result<String> {
        self.libpepcli([
            "make-local-decryption-key",
            &self.global_secret_key,
            &self.factor_secret, // called "server_secret" by libpepcli
            &hub.decryption_context(),
        ])
    }

    pub fn convert_to_local_pseudonym(&self, pseudonym: &str, hub: &Hub) -> Result<String> {
        self.libpepcli([
            "convert-to-local-pseudonym",
            pseudonym,
            &self.factor_secret, // caled "server_secret" by libpepcli
            &hub.decryption_context(),
            &hub.pseudonymisation_context(),
        ])
    }

    /// Decrypt the given encrypted local pseudonym using the given local decryption key.
    /// This function is (currently) only used for testing as the decryption of the
    /// local pseudonym ought to occur at the Synapse matrix server.
    #[cfg(test)]
    pub fn decrypt_local_pseudonym(&self, elp: &str, local_decryption_key: &str) -> Result<String> {
        self.libpepcli(["decrypt-local-pseudonym", elp, local_decryption_key])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::Hubid;
    use regex::Regex;
    use std::str::FromStr;

    #[test]
    fn test_pseudonym_usage() {
        let pepcfg = crate::config::Pep {
            // global_*_key were created using "libpepcli generate-global-keys"
            global_public_key: Some(
                "bcf2616f1de8875be554fd8db683664c52792b0e434dc15d0465bc6b687bb15d".to_string(),
            ),
            global_secret_key: Some(
                "cfd09aaaa3ef22bfda97805c2fa864be371a07e154025c53a008698e21a74702".to_string(),
            ),
            factor_secret: Some("is also called server secret".to_string()),
            libpep_location: "libpepcli".to_string(), // Make sure libpepcli is in your PATH
        };
        let pep = PepContext::from_config(pepcfg).unwrap();

        let pseudonym = pep.generate_pseudonym().to_hex();

        // libpepcli generate-pseudonym identity
        // bcf2616f1de8875be554fd8db683664c52792b0e434dc15d0465bc6b687bb15d
        //
        // Note: due to the rerandomisation, only the last portion of pseudonym is predictable
        assert!(Regex::new(
            "[a-f0-9]{128}bcf2616f1de8875be554fd8db683664c52792b0e434dc15d0465bc6b687bb15d",
        )
        .unwrap()
        .is_match(pseudonym.as_str()));

        // Use fixed pseudonym for further computations.
        // (We do this to get predictable results because unlike libpepcli which derives the
        // pseudonym from "identity", our code picks a random pseudonym.)
        let pseudonym = "b8da9641166865dad63bb83ba5298f9ab0bf62c80e9cd517a78ba42ea95c4f5816e54bfe19328165c059f70473200dbb5acdd2ff2f070b4643ee09ae625e1677bcf2616f1de8875be554fd8db683664c52792b0e434dc15d0465bc6b687bb15d".to_string();

        let hub = Hub {
            id: Hubid::from_str("936da01f-9abd-4d9d-80c7-02af85c822a8").unwrap(),
            decryption_id: Hubid::from_str("936da01f-9abd-4d9d-80c7-02af85c822a8").unwrap(),
            name: "not used".to_string(),
            active: false,
            oidc_redirect_uri: "https://not-used.com".to_string(),
            description: "not used".to_string(),
            client_uri: "not_used".to_string(),
        };

        // libpepcli make-local-decryption-key
        // cfd09aaaa3ef22bfda97805c2fa864be371a07e154025c53a008698e21a74702 "is also called server
        // secret" "Hub decryption key #936da01f-9abd-4d9d-80c7-02af85c822a8"
        let local_decryption_key = pep.make_local_decryption_key(&hub).unwrap();

        assert_eq!(
            local_decryption_key,
            "02a1348c03aa13dde10a2eb8f2c5aacd2201703e3a5944a2d6c7aaf219d0500f",
            "got unexpected local decryption key.  (Note: the way libpepcli computes factors changed June 1st 2022; use the new version.)"
        );

        let encrypted_local_pseudonym = pep.convert_to_local_pseudonym(&pseudonym, &hub).unwrap();

        // libpepcli convert-to-local-pseudonym a8457aaed982dbb9d086dc6a8e1b6f7679ca9849d6776da5a7e6c4797289c07712f8bd8e52e010c42aa0faecedf09d03790f3be047b86c546a03fbb4a82c3531bcf2616f1de8875be554fd8db683664c52792b0e434dc15d0465bc6b687bb15d "is also called server secret" "Hub decryption key #936da01f-9abd-4d9d-80c7-02af85c822a8" "Hub #936da01f-9abd-4d9d-80c7-02af85c822a8"
        //
        // Note: due to the rerandomisation, only the last portion of local_pseudonym is predictable
        assert!(Regex::new(
            "[a-f0-9]{128}127b805c293508ae6cb222d9606851f8f8db3d940d8b3f1e31274990021d8212",
        )
        .unwrap()
        .is_match(encrypted_local_pseudonym.as_str()),);

        let local_pseudonym = pep
            .decrypt_local_pseudonym(&encrypted_local_pseudonym, &local_decryption_key)
            .unwrap();

        // libpepcli decrypt-local-pseudonym
        // 16e651ecb461f55e7bd34ea84e3716e9f50f9636097330e33a4a2af69ec2c40a7c9b5e187d10176a261749ab2349a0b802dbf781f5f1792ca49b649049bfd205761482650e6847b5d377d983f0d34c364682590b7aa2693d50796dbe9b3e8064
        // 5c7e1e0cac51d15db8d4d81cd79817875d0fc2d5f980479d38b5a55eb80f4d0b
        assert_eq!(
            local_pseudonym,
            "ccc4b20926e440f7d992b2483b97cdfbeeec5b83aa344a8d42689aa4d23e8a4a"
        );
    }

    impl PepContext {
        /// test config for use by data.rs
        pub fn test_config() -> Self {
            Self {
                global_public_key: elgamal::PublicKey::from_hex(
                    "1c561577b91b0ea945a95161dd1fe44c1433ff6a21419aa606838a9db5c6106c",
                )
                .unwrap(),
                global_secret_key:
                    "1ff1accd4b711f1e3b149fdbe2254fb3397b3f2b1fd09f15c8d79c1a99b5330b".to_string(),
                factor_secret: "some secret".to_string(),
                libpep_location: "libpepcli".to_string(),
            }
        }
    }
}
