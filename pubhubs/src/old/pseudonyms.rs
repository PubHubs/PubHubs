use crate::config::having_debug_default;
use crate::data::Hub;
use crate::elgamal::{self, Encoding as _};
use anyhow::{Context as _, Result};
use curve25519_dalek::scalar::Scalar;
use hmac::digest::Update as _;
use sha2::Digest as _;
use std::fmt::{Debug, Formatter};

/// A convenience struct that can be used to share needed configuration around.
#[derive(Clone)]
pub struct PepContext {
    global_public_key: elgamal::PublicKey,
    global_secret_key: elgamal::PrivateKey,
    factor_secret: String,
}

impl Debug for PepContext {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PepContext")
            .field("global_public_key", &self.global_public_key.to_hex())
            .finish()
    }
}

enum FactorType {
    Pseudonym,
    Decryption,
}

impl FactorType {
    fn libpepcli_repr(&self) -> &'static str {
        // https://gitlab.science.ru.nl/bernardg/libpep-cpp/-/blob/65b1f346e0edb8a6606b32e8df7b0c23f8832cec/src/libpep.cpp#L44
        match self {
            Self::Pseudonym => "pseudonym",
            Self::Decryption => "decryption",
        }
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
            .context("invalid global_public_key")?,
            global_secret_key: elgamal::PrivateKey::from_hex(&having_debug_default(
                config.global_secret_key,
                "b6c57e69b093a34fa2546bc59c7940fd304d91e9c68602d237989d74f1172908",
                "pep.global_secret_key",
            )?)
            .context("invalid global_secret_key")?,
            factor_secret: having_debug_default(
                config.factor_secret,
                "default_factor_secret",
                "pep.factor_secret",
            )?,
        })
    }

    fn libpepcli_factor(&self, typ: FactorType, context: &str) -> Scalar {
        // https://gitlab.science.ru.nl/bernardg/libpep-cpp/-/blob/65b1f346e0edb8a6606b32e8df7b0c23f8832cec/src/libpep.cpp#L37
        let h = sha2::Sha512::new()
            .chain(typ.libpepcli_repr())
            .chain("|")
            .chain(&self.factor_secret)
            .chain("|")
            .chain(context);
        Scalar::from_hash(h)
    }

    /// Generate the (polymorphic and encrypted) pseudonym for a user.
    pub fn generate_pseudonym(&self) -> elgamal::Triple {
        self.global_public_key.encrypt_random()
    }

    /// Generates the private decryption key for the specified hub
    pub fn make_local_decryption_key(&self, hub: &Hub) -> Result<elgamal::PrivateKey> {
        Ok(
            (self.libpepcli_factor(FactorType::Decryption, &hub.decryption_context())
                * self.global_secret_key.as_scalar())
            .into(),
        )
    }

    /// Turns the given polymorphic pseudonym into an encrypted local pseudonym for `hub`.
    pub fn convert_to_local_pseudonym(
        &self,
        pseudonym: elgamal::Triple,
        hub: &Hub,
    ) -> Result<elgamal::Triple> {
        // https://gitlab.science.ru.nl/bernardg/libpep-cpp/-/blob/5d5e57c7b410c77824e46ed95e104c5f50cb6057/src/libpep.cpp#L51
        let s = self.libpepcli_factor(FactorType::Pseudonym, &hub.pseudonymisation_context());
        let k = self.libpepcli_factor(FactorType::Decryption, &hub.decryption_context());

        Ok(pseudonym.rsk_with_s(&s).and_k(&k))
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
        };
        let pep = PepContext::from_config(pepcfg).unwrap();

        let pseudonym = pep.generate_pseudonym().to_hex();

        // libpepcli generate-pseudonym identity
        // bcf2616f1de8875be554fd8db683664c52792b0e434dc15d0465bc6b687bb15d
        //
        // Note: due to the rerandomisation, only the last portion of pseudonym is predictable
        assert!(
            Regex::new(
                "[a-f0-9]{128}bcf2616f1de8875be554fd8db683664c52792b0e434dc15d0465bc6b687bb15d",
            )
            .unwrap()
            .is_match(dbg!(pseudonym.as_str()))
        );

        // Use fixed pseudonym for further computations.
        // (We do this to get predictable results because unlike libpepcli which derives the
        // pseudonym from "identity", our code picks a random pseudonym.)
        let pseudonym = elgamal::Triple::from_hex("b8da9641166865dad63bb83ba5298f9ab0bf62c80e9cd517a78ba42ea95c4f5816e54bfe19328165c059f70473200dbb5acdd2ff2f070b4643ee09ae625e1677bcf2616f1de8875be554fd8db683664c52792b0e434dc15d0465bc6b687bb15d").unwrap();

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
            local_decryption_key.to_hex(),
            "02a1348c03aa13dde10a2eb8f2c5aacd2201703e3a5944a2d6c7aaf219d0500f",
            "got unexpected local decryption key.  (Note: the way libpepcli computes factors changed June 1st 2022; use the new version.)"
        );

        let encrypted_local_pseudonym = pep.convert_to_local_pseudonym(pseudonym, &hub).unwrap();

        // libpepcli convert-to-local-pseudonym a8457aaed982dbb9d086dc6a8e1b6f7679ca9849d6776da5a7e6c4797289c07712f8bd8e52e010c42aa0faecedf09d03790f3be047b86c546a03fbb4a82c3531bcf2616f1de8875be554fd8db683664c52792b0e434dc15d0465bc6b687bb15d "is also called server secret" "Hub decryption key #936da01f-9abd-4d9d-80c7-02af85c822a8" "Hub #936da01f-9abd-4d9d-80c7-02af85c822a8"
        //
        // Note: due to the rerandomisation, only the last portion of local_pseudonym is predictable
        assert!(
            Regex::new(
                "[a-f0-9]{128}127b805c293508ae6cb222d9606851f8f8db3d940d8b3f1e31274990021d8212",
            )
            .unwrap()
            .is_match(&encrypted_local_pseudonym.to_hex()),
        );

        let local_pseudonym = encrypted_local_pseudonym.decrypt(&local_decryption_key);

        // libpepcli decrypt-local-pseudonym
        // 16e651ecb461f55e7bd34ea84e3716e9f50f9636097330e33a4a2af69ec2c40a7c9b5e187d10176a261749ab2349a0b802dbf781f5f1792ca49b649049bfd205761482650e6847b5d377d983f0d34c364682590b7aa2693d50796dbe9b3e8064
        // 5c7e1e0cac51d15db8d4d81cd79817875d0fc2d5f980479d38b5a55eb80f4d0b
        assert_eq!(
            local_pseudonym.to_hex(),
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
                global_secret_key: elgamal::PrivateKey::from_hex(
                    "1ff1accd4b711f1e3b149fdbe2254fb3397b3f2b1fd09f15c8d79c1a99b5330b",
                )
                .unwrap(),
                factor_secret: "some secret".to_string(),
            }
        }
    }
}
