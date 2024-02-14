//! The ElGamal cryptosystem, as used in PEP

use curve25519_dalek::{
    constants::RISTRETTO_BASEPOINT_TABLE as B,
    ristretto::{CompressedRistretto, RistrettoPoint},
    scalar::Scalar,
};

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
        if self.pk == B * &sk.scalar {
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
    /// use pubhubs::elgamal::{PrivateKey, random_point, random_scalar};
    /// use curve25519_dalek::{
    ///     ristretto::RistrettoPoint,
    ///     constants::RISTRETTO_BASEPOINT_TABLE as B,
    /// };
    ///
    /// let M = random_point();
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
    /// let pk2 = sk2.public_key().clone();
    /// let trip = pk.encrypt_with_random(r1, M).spoof_pk(pk2).rerandomize_with_random(r2);
    ///
    /// assert_eq!(trip.clone().decrypt_and_check_pk(&sk2),
    ///     Some(M + B * &(r1 * (sk.as_scalar()-sk2.as_scalar()))));
    ///
    /// // Indeed, if sk =/= sk2, then  r1(sk - sk2)B will be some random unknowable Ristretto
    /// // point, because r1 should be a random scalar that has been thrown away.
    /// ```
    pub fn rerandomize(self) -> Triple {
        self.rerandomize_with_random(random_scalar())
    }

    /// Like [Self::rerandomize], but you can specify the random scalar used -
    /// which you shouldn't except to make deterministic tests.
    pub fn rerandomize_with_random(self, r: Scalar) -> Triple {
        Triple {
            ek: self.ek + &r * B,
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
            ek: params.s_over_k() * self.ek + &r * B,
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
            random_scalar()
        }
    }
}

/// `osrng!()` is an abbreviation for `&mut rand_07::rngs::OsRng` the rng used by this module.
macro_rules! osrng {
    () => {
        &mut rand::rngs::OsRng
    };
}

/// Returns a random Ristretto point, mainly for examples.
///
/// If you're immediately encrypting this point, consider
/// using [PublicKey::encrypt_random] instead.
pub fn random_point() -> RistrettoPoint {
    RistrettoPoint::random(osrng!())
}

/// Returns a random scalar, mainly for examples.
pub fn random_scalar() -> Scalar {
    Scalar::random(osrng!())
}

/// Private key - load using [PrivateKey::from_hex] or generate with [PrivateKey::random].
///
/// Caches the associated [`PublicKey`], which means that loading a [`PrivateKey`] involves a base
/// point multiplication.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct PrivateKey {
    /// underlying scalar
    scalar: Scalar,

    /// associated public key, stored for efficiency
    public_key: PublicKey,
}

impl PrivateKey {
    /// Returns reference to underlying scalar.
    pub fn as_scalar(&self) -> &Scalar {
        &self.scalar
    }

    pub fn random() -> Self {
        random_scalar().into()
    }

    pub fn public_key(&self) -> &PublicKey {
        &self.public_key
    }

    /// Computes the [PublicKey] associated with the product of two [PrivateKey]s given only one
    /// private key.
    pub fn scale(&self, pk: &PublicKey) -> PublicKey {
        (self.scalar * pk.point).into()
    }

    /// Creates a Diffie-Hellman-type shared secret between this [`PrivateKey`] and the [`PublicKey`].
    pub fn shared_secret(&self, pk: &PublicKey) -> SharedSecret {
        SharedSecret {
            inner: self.scale(pk).to_bytes(),
        }
    }
}

impl From<Scalar> for PrivateKey {
    fn from(scalar: Scalar) -> Self {
        PrivateKey {
            scalar,
            public_key: (&scalar * B).into(),
        }
    }
}

/// Public key - obtained using [PublicKey::from_hex] or [PrivateKey::public_key].
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct PublicKey {
    point: RistrettoPoint,
    compressed: CompressedRistretto,
}

impl PublicKey {
    /// Turns a 64 digit hex string into a [PublicKey].
    ///
    /// Returns `None` when the hex-encoding is invalid or when the hex-encoding does not encode a
    /// valid Ristretto point.
    pub fn from_hex(hexstr: &str) -> Option<Self> {
        CompressedRistretto::from_hex(hexstr)?.try_into().ok()
    }

    /// Encrypts the given `plaintext` for this public key.
    /// If the plaintext is a random point, consider using [Self::encrypt_random].
    pub fn encrypt(&self, plaintext: RistrettoPoint) -> Triple {
        self.encrypt_with_random(random_scalar(), plaintext)
    }

    /// Like [Self::encrypt], but you can specify the random scalar used - which you shouldn't
    /// except to make deterministic tests.
    pub fn encrypt_with_random(&self, r: Scalar, plaintext: RistrettoPoint) -> Triple {
        Triple {
            ek: &r * B,
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
            ek: random_point(),
            ct: random_point(),
            pk: self.point,
        }
    }
}

impl From<RistrettoPoint> for PublicKey {
    fn from(point: RistrettoPoint) -> Self {
        Self {
            point,
            compressed: point.compress(),
        }
    }
}

impl TryFrom<CompressedRistretto> for PublicKey {
    type Error = ();

    fn try_from(compressed: CompressedRistretto) -> Result<Self, Self::Error> {
        Ok(Self {
            point: compressed.decompress().ok_or(())?,
            compressed,
        })
    }
}

/// Adds encoding and decoding methods to [PrivateKey], [PublicKey], [Triple], [Scalar]
/// and [RistrettoPoint] which can all be represented as `[u8; N]`s for some `N`.  
///
/// Not all arrays of the form `[u8; N]` may be a valid representation of the type of object in question, though.
pub trait Encoding<const N: usize>
where
    Self: Sized,
{
    /// Decodes `Some(object)` from `bytes` if `bytes` encodes some `object` of type `Self`;
    /// otherwise returns `None`.
    fn from_bytes(bytes: [u8; N]) -> Option<Self>;

    /// Encodes `self` as `[u8; N]`.
    fn to_bytes(&self) -> [u8; N];

    /// Like [Self::from_bytes], but reads `[u8; N]` from `slice`.  Returns `None` if `slice.len()!=N`
    /// or when the slice is not a valid encoding.
    fn from_slice(slice: &[u8]) -> Option<Self> {
        if slice.len() != N {
            return None;
        }

        let mut buf = [0u8; N];
        buf.copy_from_slice(slice);

        Self::from_bytes(buf)
    }

    /// Copies the encoding of `self` into `slice`.  Returns `None` when `slice.len()!=N`.
    fn copy_to_slice(&self, slice: &mut [u8]) -> Option<()> {
        if slice.len() != N {
            return None;
        }

        slice.copy_from_slice(&self.to_bytes());

        Some(())
    }

    /// Like [Self::from_bytes], but reads the `[u8; N]` from the 2*N-digit hex string `hex`.
    /// The case of the hex digits is ignored.
    fn from_hex(hex: &str) -> Option<Self> {
        let hex: &[u8] = hex.as_bytes();

        if hex.len() != 2 * N {
            return None;
        }

        let mut buf = [0u8; N];

        base16ct::mixed::decode(hex, &mut buf).ok()?;
        Self::from_bytes(buf)
    }

    /// Returns the `2*N`-digit lower-case hex representation of `self`.
    fn to_hex(&self) -> String {
        base16ct::lower::encode_string(&self.to_bytes())
    }

    /// Loads object from the `N`-byte buffer pointed to by `ptr`.
    ///
    /// # Safety
    /// The caller must make sure that `ptr` is properly alligned,
    /// the `N`-byte buffer is readable, and isn't modified for the duration of the call.
    ///
    /// See the 'Safety' section of [core::slice::from_raw_parts] for more details.
    unsafe fn from_ptr(ptr: *const u8) -> Option<Self> {
        Self::from_slice(unsafe { core::slice::from_raw_parts(ptr, N) })
    }

    /// Writes the `N`-byte representation of this object to the memory location `ptr`.
    ///
    /// # Safety
    /// The caller must make sure that `ptr` is properly alligned,
    /// the `N`-byte buffer is writable, and isn't modified for the duration of the call.
    ///
    /// See the 'Safety' section of [core::slice::from_raw_parts_mut] for more details.
    unsafe fn copy_to_ptr(self, ptr: *mut u8) {
        self.copy_to_slice(unsafe { core::slice::from_raw_parts_mut(ptr, N) })
            .unwrap()
        // Note: `copy_to_slice` only fails when the provided slice has the incorrect size (not `N`)
        // which is not the case here.
    }
}

impl Encoding<32> for Scalar {
    fn from_bytes(bytes: [u8; 32]) -> Option<Scalar> {
        Scalar::from_canonical_bytes(bytes).into()
    }

    fn to_bytes(&self) -> [u8; 32] {
        Scalar::to_bytes(self)
    }
}

impl Encoding<32> for CompressedRistretto {
    fn from_bytes(bytes: [u8; 32]) -> Option<CompressedRistretto> {
        Some(CompressedRistretto(bytes))
    }

    fn to_bytes(&self) -> [u8; 32] {
        self.to_bytes()
    }
}

impl Encoding<32> for RistrettoPoint {
    fn from_bytes(bytes: [u8; 32]) -> Option<RistrettoPoint> {
        CompressedRistretto(bytes).decompress()
    }

    fn to_bytes(&self) -> [u8; 32] {
        self.compress().to_bytes()
    }
}

impl Encoding<32> for PrivateKey {
    fn from_bytes(bytes: [u8; 32]) -> Option<PrivateKey> {
        Scalar::from_bytes(bytes).map(PrivateKey::from)
    }

    fn to_bytes(&self) -> [u8; 32] {
        self.scalar.to_bytes()
    }
}

impl Encoding<32> for PublicKey {
    fn from_bytes(bytes: [u8; 32]) -> Option<PublicKey> {
        CompressedRistretto::from_bytes(bytes)?.try_into().ok()
    }

    fn to_bytes(&self) -> [u8; 32] {
        self.compressed.to_bytes()
    }
}

impl Encoding<96> for Triple {
    fn from_bytes(bytes: [u8; 96]) -> Option<Triple> {
        let ek: RistrettoPoint = RistrettoPoint::from_slice(&bytes[..32])?;
        let ct: RistrettoPoint = RistrettoPoint::from_slice(&bytes[32..64])?;
        let pk: RistrettoPoint = RistrettoPoint::from_slice(&bytes[64..])?;

        Some(Triple { ek, ct, pk })
    }

    fn to_bytes(&self) -> [u8; 96] {
        let mut result = [0u8; 96];

        // Note: `copy_to_slice` only fails when the slice's size is not 32, which it won't below
        self.ek.copy_to_slice(&mut result[..32]).unwrap();
        self.ct.copy_to_slice(&mut result[32..64]).unwrap();
        self.pk.copy_to_slice(&mut result[64..]).unwrap();

        result
    }
}

#[cfg(feature = "bin")]
mod serde_impls {
    use super::*;
    use crate::misc::serde_ext;
    use serde::de::Error as _;

    /// Implements [`serde::Serialize`] and [`serde::Deserialize`] using [`serde_ext::ByteArray`] and hex
    /// encoding
    macro_rules! serde_impl {
        { $type:ident, $n:literal } => {

            impl<'de> serde::Deserialize<'de> for $type {
                fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
                    let byte_array : serde_ext::ByteArray<$n>  =
                        serde_ext::bytes_wrapper::B16::<serde_ext::ByteArray<$n>>::deserialize(d)?.into_inner();
                    $type::from_bytes(byte_array.into()).ok_or_else(|| D::Error::custom(concat!("invalid ", stringify!($type))))
                }
            }

            impl<'de> serde::Serialize for $type {
                fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
                    let byte_array = serde_ext::ByteArray::<$n>::from(self.to_bytes());
                    serde_ext::bytes_wrapper::B16::<serde_ext::ByteArray<$n>>::from(byte_array)
                        .serialize(s)
                }
            }
        }
    }

    serde_impl! { PrivateKey, 32 }
    serde_impl! { PublicKey, 32 }
}

/// Shared secret created by combining a [`PrivateKey`] with a [`PublicKey`], which, although it is
/// basically the encoding of a [`RistrettoPoint`], is given a separate interface to limit its
/// usage.
#[derive(Clone)]
pub struct SharedSecret {
    inner: [u8; 32],
}

impl SharedSecret {
    /// Inserts this shared secret in the given digest
    pub fn update_digest<D: digest::Digest>(&self, d: D, domain: impl AsRef<str>) -> D {
        let domain = domain.as_ref();

        d.chain_update(domain)
            // we include the length of the domain to prevent collisions between domains with the
            // same prefix
            .chain_update(domain.len().to_ne_bytes())
            .chain_update(&self.inner)
    }

    /// Creates a scalar from this shared secret
    pub fn derive_scalar<D>(&self, d: D, domain: impl AsRef<str>) -> Scalar
    where
        D: digest::Digest<OutputSize = typenum::U64>,
    {
        Scalar::from_hash(self.update_digest(d, domain))
    }
}

/// Application binary interface
#[cfg(feature = "abi")]
pub mod abi {
    use super::*;

    /// Decrypts the given `ciphertext` using the given `private_key` and stores the result in
    /// `plaintext`.
    ///
    ///   * `plaintext` - pointer to a writable 32-byte buffer
    ///   * `ciperhtext` - pointer to a 96-byte buffer holding the result of [Triple::to_bytes]
    ///   * `private_key` - pointer to a 32-byte buffer holding the result of [Scalar::to_bytes]
    ///
    /// # Safety
    /// The caller must make sure the pointers are aligned, point to valid memory regions,
    /// are readable, and plaintext is writable, and are not otherwise modified.
    ///
    /// For more details, see [core::slice::from_raw_parts] and [core::slice::from_raw_parts_mut].
    #[no_mangle]
    pub unsafe extern "C" fn decrypt(
        plaintext: *mut u8,
        ciphertext: *const u8,
        private_key: *const u8,
    ) -> DecryptResult {
        let pk = match unsafe { PrivateKey::from_ptr(private_key) } {
            Some(pk) => pk,
            None => return DecryptResult::InvalidPrivateKey,
        };

        let ct = match unsafe { Triple::from_ptr(ciphertext) } {
            Some(ct) => ct,
            None => return DecryptResult::InvalidTriple,
        };

        let pt = match ct.decrypt_and_check_pk(&pk) {
            Some(pt) => pt,
            None => return DecryptResult::WrongPublicKey,
        };

        unsafe { pt.copy_to_ptr(plaintext) }

        DecryptResult::Ok
    }

    /// Result of [decrypt].
    #[repr(u8)]
    pub enum DecryptResult {
        Ok = 1,
        WrongPublicKey = 2,
        InvalidTriple = 3,
        InvalidPrivateKey = 4,
    }
}
