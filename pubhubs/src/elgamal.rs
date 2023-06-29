//! ElGamal

use curve25519_dalek::{
    constants::RISTRETTO_BASEPOINT_TABLE as B,
    ristretto::{CompressedRistretto, RistrettoPoint},
    scalar::Scalar,
};

/// `osrng!()` is an abbreviation for `&mut rand_07::rngs::OsRng` the rng used by this module.
///
/// Note: `rand_07`, because curve25519-dalek still uses `rand` version 0.7.
macro_rules! osrng {
    () => {
        &mut rand_07::rngs::OsRng
    };
}

/// ElGamal ciphertext - the result of encrypting a [RistrettoPoint] using a [PrivateKey].
///
/// The associated public key is remembered to allow rerandomization, but this public key is
/// not authenticated in any way.  This means that anyone intercepting a triple may
/// modify the public key without detection (but this does not cause the
/// triple to be decryptable to the same plaintext by another public key.)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Triple {
    /// Ephemeral key
    ek: RistrettoPoint,
    /// Ciphertext,
    ct: RistrettoPoint,
    /// Public key
    pk: RistrettoPoint,
}

impl Triple {
    /// Returns the 192-digit hex string representation of this triple.
    pub fn to_hex(&self) -> String {
        let mut buf = [0u8; 3 * 2 * 32];

        // NOTE:  encode only fails when the destination slice is too small (not
        // at least twice the size of the input) which it shouldn't be here.
        base16ct::lower::encode(self.ek.compress().as_bytes(), &mut buf[0..64]).unwrap();
        base16ct::lower::encode(self.ct.compress().as_bytes(), &mut buf[64..128]).unwrap();
        base16ct::lower::encode(self.pk.compress().as_bytes(), &mut buf[128..192]).unwrap();

        unsafe {
            // At this point, the whole buffer is filled with lower-case hex characters,
            // which is valid utf-8.
            return String::from_utf8_unchecked(buf.into());
        }
    }

    /// Decrypts the triple using the given private key `sk`.  If the triple was encrypted
    /// for a different private key, the result is a random point.
    pub fn decrypt_into(self, sk: &PrivateKey) -> RistrettoPoint {
        self.ct - sk.scalar * self.ek
    }

    /// Decrypts the triple using the given private key `sk` if the triple claims to be encrypted
    /// for the associated public key;  returns `None` otherwise.
    ///
    /// **Warning** This function can't check whether the triple's public key `pk` has been
    /// tampered with.  
    ///
    /// While tampering cannot be prevented, the plaintext of a triple with spoofed `pk` can be
    /// garbled, using [Self::rerandomize_into].
    ///
    pub fn decrypt_into_and_check_pk(self, sk: &PrivateKey) -> Option<RistrettoPoint> {
        if self.pk == &B * &sk.scalar {
            Some(self.decrypt_into(sk))
        } else {
            None
        }
    }

    /// Changes the public key of this triple, likely resulting in garbage down the road.
    ///
    /// Used for demonstration purposes.
    pub fn spoof_pk(self, pk: PublicKey) -> Triple {
        Triple {
            ek: self.ek,
            ct: self.ct,
            pk: pk.point,
        }
    }

    /// Changes the appearance of the ciphertext, but leaves the plaintext and the target
    /// public key unaltered.  If the public key was spoofed, the plaintext is garbled.
    /// ```
    /// use pubhubs::elgamal::{PrivateKey, random_plaintext, random_scalar};
    /// use curve25519_dalek::{
    ///     ristretto::RistrettoPoint,
    ///     constants::RISTRETTO_BASEPOINT_TABLE as B,
    /// };
    ///
    /// let M = random_plaintext();
    /// let sk = PrivateKey::random();
    /// let pk = sk.public_key();
    ///
    /// let r1 = random_scalar();
    /// let r2 = random_scalar();
    ///
    /// // Rerandomization leaves the plaintext unchanged:
    /// let trip = pk.encrypt_with_random(r1, M).rerandomize_with_random_into(r2);
    /// assert_eq!(trip, pk.encrypt_with_random(r1+r2,M));
    ///
    /// // But if the public key was spoofed, the plaintext is garbled:
    /// let sk2 = PrivateKey::random();
    /// let pk2 = sk2.public_key();
    /// let trip = pk.encrypt_with_random(r1, M).spoof_pk(pk2).rerandomize_with_random_into(r2);
    ///
    /// assert_eq!(trip.clone().decrypt_into_and_check_pk(&sk2),
    ///     Some(M + &B * &(r1 * (sk.scalar-sk2.scalar))));
    ///
    /// // Indeed, if sk =/= sk2, then  r1(sk - sk2)B will be some random unknowable Ristretto
    /// // point, because r1 should be a random scalar that has been thrown away.
    /// ```
    pub fn rerandomize_into(self) -> Triple {
        self.rerandomize_with_random_into(Scalar::random(osrng!()))
    }

    /// Like [Self::rerandomize_into], but you can specify the random scalar used - which you shouldn't.
    pub fn rerandomize_with_random_into(self, r: Scalar) -> Triple {
        Triple {
            ek: self.ek + &r * &B,
            ct: self.ct + r * self.pk,
            pk: self.pk,
        }
    }
}

/// Returns a random plaintext, mainly for examples.
///
/// If you're immediately encrypting this plaintext, consider
/// using [PublicKey::encrypt_random] instead.
pub fn random_plaintext() -> RistrettoPoint {
    RistrettoPoint::random(osrng!())
}

/// Returns a random scalar, mainly for examples.
pub fn random_scalar() -> Scalar {
    Scalar::random(osrng!())
}

#[derive(Clone, PartialEq, Eq)]
pub struct PrivateKey {
    /// underlying scalar
    pub scalar: Scalar,
}

impl PrivateKey {
    pub fn random() -> Self {
        PrivateKey {
            scalar: Scalar::random(osrng!()),
        }
    }

    pub fn public_key(&self) -> PublicKey {
        PublicKey {
            point: &self.scalar * &B,
        }
    }
}

#[derive(Clone, PartialEq, Eq)]
pub struct PublicKey {
    point: RistrettoPoint,
}

impl PublicKey {
    pub fn from_hex(hexstr: &str) -> Option<Self> {
        let mut buf = [0u8; 32];
        base16ct::mixed::decode(hexstr, &mut buf).ok()?;
        let cpt = CompressedRistretto::from_slice(&buf);
        Some(PublicKey {
            point: cpt.decompress()?,
        })
    }

    /// Encrypts the given `plaintext` for this public key.
    /// If the plaintext is a random point, consider using [Self::encrypt_random].
    pub fn encrypt(&self, plaintext: RistrettoPoint) -> Triple {
        self.encrypt_with_random(Scalar::random(osrng!()), plaintext)
    }

    /// Like [Self::encrypt], but you can specify the random scalar used - which you shouldn't.
    pub fn encrypt_with_random(&self, r: Scalar, plaintext: RistrettoPoint) -> Triple {
        Triple {
            ek: &r * &B,
            ct: plaintext + r * self.point,
            pk: self.point,
        }
    }

    /// Effectively encrypts a random plaintext for this public key.
    ///
    /// Instead of picking random Ristretto point M and random scalar r and computing
    ///   `(rB, r * pk + M, self)`
    /// we pick Ristretto points ek and ct randomly and return
    ///   `(ek, ct, sekf)`.
    /// since this is more efficient, and yields the same distribution.
    pub fn encrypt_random(&self) -> Triple {
        Triple {
            ek: RistrettoPoint::random(osrng!()),
            ct: RistrettoPoint::random(osrng!()),
            pk: self.point,
        }
    }
}
