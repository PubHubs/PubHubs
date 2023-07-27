//! The ElGamal cryptosystem, as used in PEP

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

/// ElGamal ciphertext - the result of [PublicKey::encrypt].
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

        // safety: buf contains only lower-case hex characters
        unsafe { String::from_utf8_unchecked(buf.into()) }
    }

    /// Retrieves a [Triple] from its 192-digit hex string representation.
    /// Returns [None] if `hex` is not the result of [Triple::to_hex].
    pub fn from_hex(hex: &str) -> Option<Self> {
        let hex: &[u8] = hex.as_bytes();

        if hex.len() != 192 {
            return None;
        }

        let mut buf = [0u8; 32];

        base16ct::mixed::decode(&hex[..64], &mut buf).ok()?;
        let ek: RistrettoPoint = CompressedRistretto::from_slice(&buf).decompress()?;

        base16ct::mixed::decode(&hex[64..128], &mut buf).ok()?;
        let ct: RistrettoPoint = CompressedRistretto::from_slice(&buf).decompress()?;

        base16ct::mixed::decode(&hex[128..], &mut buf).ok()?;
        let pk: RistrettoPoint = CompressedRistretto::from_slice(&buf).decompress()?;

        Some(Triple { ek, ct, pk })
    }

    /// Decrypts the triple using the given private key `sk`.  If the triple was encrypted
    /// for a different private key, the result is a random point.
    pub fn decrypt(self, sk: &PrivateKey) -> RistrettoPoint {
        self.ct - sk.scalar * self.ek
    }

    /// Decrypts the triple using the given private key `sk` if the triple claims to be encrypted
    /// for the associated public key;  returns `None` otherwise.
    ///
    /// **Warning** This function can't check whether the triple's public key `pk` has been
    /// tampered with.  
    ///
    /// While tampering cannot be prevented, the plaintext of a triple with spoofed `pk` can be
    /// garbled, using [Self::rerandomize].
    ///
    pub fn decrypt_and_check_pk(self, sk: &PrivateKey) -> Option<RistrettoPoint> {
        if self.pk == &B * &sk.scalar {
            Some(self.decrypt(sk))
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
    /// let trip = pk.encrypt_with_random(r1, M).rerandomize_with_random(r2);
    /// assert_eq!(trip, pk.encrypt_with_random(r1+r2,M));
    ///
    /// // But if the public key was spoofed, the plaintext is garbled:
    /// let sk2 = PrivateKey::random();
    /// let pk2 = sk2.public_key();
    /// let trip = pk.encrypt_with_random(r1, M).spoof_pk(pk2).rerandomize_with_random(r2);
    ///
    /// assert_eq!(trip.clone().decrypt_and_check_pk(&sk2),
    ///     Some(M + &B * &(r1 * (sk.as_scalar()-sk2.as_scalar()))));
    ///
    /// // Indeed, if sk =/= sk2, then  r1(sk - sk2)B will be some random unknowable Ristretto
    /// // point, because r1 should be a random scalar that has been thrown away.
    /// ```
    pub fn rerandomize(self) -> Triple {
        self.rerandomize_with_random(Scalar::random(osrng!()))
    }

    /// Like [Self::rerandomize], but you can specify the random scalar used -
    /// which you shouldn't except to make deterministic tests.
    pub fn rerandomize_with_random(self, r: Scalar) -> Triple {
        Triple {
            ek: self.ek + &r * &B,
            ct: self.ct + r * self.pk,
            pk: self.pk,
        }
    }

    /// Like [rsk] but taking the parameters `s` and `k` thusly: `rsk_with_s(s).and_k(k)`.
    pub fn rsk_with_s(self, s: &Scalar) -> rsk::WithS<'_> {
        rsk::WithS { t: self, s }
    }

    /// Changes the given ciphertext according to the `params` provided:
    ///
    ///  - Multiplies the underlying plaintext by `params.s()`;
    ///  - Multiplies the target public/private key by `params.k()`;
    ///  - Rerandomizes the ciphertext using the scalar `params.r()`.
    ///    
    ///    If the public key `self.pk` was spoofed, the resulting plaintext is garbled,
    ///    provided the scalar `params.r()` was random.
    ///
    /// If you only need to specify `s` and `k`, use `triple.rsk_with_s(s).and_k(k)` instead.
    pub fn rsk(self, params: impl rsk::Params) -> Triple {
        let r: Scalar = params.r();
        let kpk = self.pk * params.k();

        Triple {
            ek: params.s_over_k() * self.ek + &r * &B,
            ct: params.s() * self.ct + r * kpk,
            pk: kpk,
        }
    }
}

/// Utilities for [Triple::rsk]
pub mod rsk {
    use super::*;

    /// Implementation of the [Params] trait given the parameters `s` and `k`.
    pub struct SAndK<'s, 'k> {
        s: &'s Scalar,
        k: &'k Scalar,
    }

    impl<'s, 'k> Params for SAndK<'s, 'k> {
        fn s(&self) -> &Scalar {
            self.s
        }

        fn k(&self) -> &Scalar {
            self.k
        }
    }

    /// The result of [Triple::rsk_with_s]. You should call [WithS::and_k] on it.
    pub struct WithS<'a> {
        pub(crate) t: Triple,
        pub(crate) s: &'a Scalar,
    }

    impl<'a> WithS<'a> {
        pub fn and_k(self, k: &Scalar) -> Triple {
            self.t.rsk(SAndK { s: self.s, k })
        }
    }

    /// Utilities for the [Triple::rsk] operation.
    pub trait Params {
        /// Multiply the encrypted plaintext ristretto point by this scalar.
        fn s(&self) -> &Scalar;

        /// Multiply the target public/private key by this scalar.
        fn k(&self) -> &Scalar;

        /// Returns `1/k`.
        fn k_inv(&self) -> Scalar {
            self.k().invert()
        }

        /// Returns `s/k`.
        fn s_over_k(&self) -> Scalar {
            self.s() * self.k_inv()
        }

        /// Returns the scalar used for rerandomisation.
        ///
        /// **Warning:** only override this method for the purpose of making deterministic test.
        fn r(&self) -> Scalar {
            Scalar::random(osrng!())
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

/// Private key - load using [PrivateKey::from_hex] or generate with [PrivateKey::random].
#[derive(Clone, PartialEq, Eq)]
pub struct PrivateKey {
    /// underlying scalar
    scalar: Scalar,
}

impl PrivateKey {
    /// Turns a 64-digit hex string into a [PrivateKey].
    ///
    /// Returns None when `hexstr` is not a 64-digit hex string, or when the encoded number has
    /// not been reduced modulo `\ell`.
    pub fn from_hex(hexstr: &str) -> Option<Self> {
        let mut buf = [0u8; 32];
        base16ct::mixed::decode(hexstr, &mut buf).ok()?;
        Some(PrivateKey {
            scalar: Scalar::from_canonical_bytes(buf)?,
        })
    }

    /// Returns reference to underlying scalar.
    pub fn as_scalar(&self) -> &Scalar {
        &self.scalar
    }

    /// Returns the 64 digit hex representation of this private key."
    pub fn to_hex(&self) -> String {
        let mut buf = [0u8; 64];
        // NOTE: encode only fails when the destination buffer size is too small
        base16ct::lower::encode(self.scalar.as_bytes(), &mut buf).unwrap();
        // safety: buf contains only lower-case hex characters, making it valid utf8
        unsafe { String::from_utf8_unchecked(buf.into()) }
    }

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

impl From<Scalar> for PrivateKey {
    fn from(scalar: Scalar) -> Self {
        PrivateKey { scalar }
    }
}

/// Public key - obtained using [PublicKey::from_hex] or [PrivateKey::public_key].
#[derive(Clone, PartialEq, Eq)]
pub struct PublicKey {
    point: RistrettoPoint,
}

impl PublicKey {
    /// Turns a 64 digit hex string into a [PublicKey].
    ///
    /// Returns `None` when the hex-encoding is invalid or when the hex-encoding does not encode a
    /// valid Ristretto point.
    pub fn from_hex(hexstr: &str) -> Option<Self> {
        Some(PublicKey {
            point: RistrettoPoint::from_hex(hexstr)?,
        })
    }

    /// Returns the lower-case 64-digit hex encoding of this [PublicKey].
    pub fn to_hex(&self) -> String {
        self.point.to_hex()
    }

    /// Encrypts the given `plaintext` for this public key.
    /// If the plaintext is a random point, consider using [Self::encrypt_random].
    pub fn encrypt(&self, plaintext: RistrettoPoint) -> Triple {
        self.encrypt_with_random(Scalar::random(osrng!()), plaintext)
    }

    /// Like [Self::encrypt], but you can specify the random scalar used - which you shouldn't
    /// except to make deterministic tests.
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

/// Extention trait that adds [HexExt::to_hex] and [HexExt::from_hex] to [RistrettoPoint].
pub trait HexExt
where
    Self: Sized,
{
    /// Returns a lower-case hex representation of `self`.
    fn to_hex(&self) -> String;

    /// If `hex` is the result of `obj.to_hex()` (modulo lower/upper case),
    /// returns `Some(obj)`. Otherwise returns `None`.
    fn from_hex(hex: &str) -> Option<Self>;
}

impl HexExt for RistrettoPoint {
    fn to_hex(&self) -> String {
        let mut buf = [0u8; 2 * 32];

        // NOTE:  encode only fails when the destination slice is too small (not
        // at least twice the size of the input) which it shouldn't be here.
        base16ct::lower::encode(self.compress().as_bytes(), &mut buf[..]).unwrap();

        // safety: buf contains only lower-case hex characters
        unsafe { String::from_utf8_unchecked(buf.into()) }
    }

    fn from_hex(hex: &str) -> Option<RistrettoPoint> {
        let hex: &[u8] = hex.as_bytes();

        if hex.len() != 64 {
            return None;
        }

        let mut buf = [0u8; 32];

        base16ct::mixed::decode(hex, &mut buf).ok()?;
        CompressedRistretto::from_slice(&buf).decompress()
    }
}
