//! Tools for (de)serialization
use serde::{de::Error as _, ser::Error as _, Deserialize, Deserializer, Serialize, Serializer};

use std::borrow::Cow;
use std::marker::PhantomData;

/// Wraps a type `T` that implements [ToBytes] and/or [FromBytes] so that its (de)serialization can
/// be modified by the [BytesEncoding] `E`.
///
/// We primarily use this to encode keys as hex or base64 strings in JSON instead of arrays.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BytesWrapper<T, E> {
    inner: T,
    phantom: PhantomData<E>,
}

impl<T, E> From<T> for BytesWrapper<T, E> {
    fn from(inner: T) -> Self {
        Self {
            inner,
            phantom: PhantomData,
        }
    }
}

impl<T, E> BytesWrapper<T, E> {
    /// Returns the wrapped object.
    ///
    /// Note:  We cannot implement `Into<T>` for [BytesWrapper], because it would clash
    /// with the implementation of `Into<T>` when `T` implements `From<BytesWrapper>`.
    pub fn into_inner(self) -> T {
        self.inner
    }
}

/// Trait for specifuing the encoding of bytes as strings, like hex or base64.
pub trait BytesEncoding {
    type Error: std::error::Error;

    fn encode<'a>(src: &[u8], dst: &'a mut str) -> Result<&'a str, Self::Error>;
    fn decode<'a>(src: &str, dst: &'a mut [u8]) -> Result<&'a [u8], Self::Error>;

    fn encoded_len(bytes: &[u8]) -> Result<usize, Self::Error>;
    fn decoded_len(bytes: &str) -> Result<usize, Self::Error>;
}

/// Hex [BytesEncoding].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct B16Encoding<
    const ENCODE_LOWER_CASE: bool = { true },
    const DECODE_MIXED_CASE: bool = { true },
> {}

pub type B16<T, const ENCODE_LOWER_CASE: bool = true, const DECODE_MIXED_CASE: bool = true> =
    BytesWrapper<T, B16Encoding<ENCODE_LOWER_CASE, DECODE_MIXED_CASE>>;

impl<const ELC: bool, const DMC: bool> BytesEncoding for B16Encoding<ELC, DMC> {
    type Error = base16ct::Error;

    fn encode<'a>(src: &[u8], dst: &'a mut str) -> Result<&'a str, Self::Error> {
        let dst: &'a mut [u8] = unsafe { dst.as_bytes_mut() };
        // SAFETY: hex characters are valid utf8

        if ELC {
            base16ct::lower::encode_str(src, dst)
        } else {
            base16ct::upper::encode_str(src, dst)
        }
    }

    fn decode<'a>(src: &str, dst: &'a mut [u8]) -> Result<&'a [u8], Self::Error> {
        let src: &[u8] = src.as_bytes();

        if DMC {
            base16ct::mixed::decode(src, dst)
        } else if ELC {
            base16ct::lower::decode(src, dst)
        } else {
            base16ct::upper::decode(src, dst)
        }
    }

    fn encoded_len(bytes: &[u8]) -> Result<usize, Self::Error> {
        Ok(base16ct::encoded_len(bytes))
    }

    fn decoded_len(bytes: &str) -> Result<usize, Self::Error> {
        base16ct::decoded_len(bytes.as_bytes())
    }
}

/// Trait for objects that can be encoded as `&[u8]`.
pub trait ToBytes {
    type Error: std::error::Error;

    fn encode(&self) -> Result<Cow<'_, [u8]>, Self::Error>;
}

impl<T: AsRef<[u8]>> ToBytes for T {
    type Error = std::convert::Infallible;

    fn encode(&self) -> Result<Cow<'_, [u8]>, Self::Error> {
        Ok(Cow::Borrowed(self.as_ref()))
    }
}

impl<T, E> std::ops::Deref for BytesWrapper<T, E> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl<T, E> std::ops::DerefMut for BytesWrapper<T, E> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.inner
    }
}

impl<T, E> Serialize for BytesWrapper<T, E>
where
    T: ToBytes,
    E: BytesEncoding,
{
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let cow = match self.encode() {
            Ok(cow) => cow,
            Err(err) => return Err(S::Error::custom(err)),
        };

        let encoded_len: usize = match E::encoded_len(&cow) {
            Ok(encoded_len) => encoded_len,
            Err(err) => return Err(S::Error::custom(err)),
        };

        let mut string = unsafe { String::from_utf8_unchecked(vec![0; encoded_len]) };
        // SAFETY: only zeroes is valid utf8

        let substr: &str = match E::encode(&cow, &mut string) {
            Ok(substr) => substr,
            Err(err) => return Err(S::Error::custom(err)),
        };

        s.serialize_str(substr)
    }
}

impl<'de, T, E> Deserialize<'de> for BytesWrapper<T, E>
where
    T: FromBytes,
    E: BytesEncoding,
{
    fn deserialize<D>(d: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s: &'de str = serde::Deserialize::deserialize(d)?;

        let decoded_len: usize = match E::decoded_len(s) {
            Ok(decoded_len) => decoded_len,
            Err(err) => return Err(D::Error::custom(err)),
        };

        let mut buf = vec![0; decoded_len];

        let slice: &[u8] = match E::decode(s, &mut buf) {
            Ok(slice) => slice,
            Err(err) => return Err(D::Error::custom(err)),
        };

        let slice_len = slice.len();
        let slice_ptr = slice.as_ptr();

        // truncate buf to the size used by decode, but first check that slice
        // is indeed a slice into buf starting at index 0
        assert_eq!(buf.as_ptr(), slice_ptr);
        buf.truncate(slice_len);

        match T::decode(buf) {
            Ok(inner) => Ok(inner.into()),
            Err(err) => Err(D::Error::custom(err)),
        }
    }
}

pub mod from_bytes {
    /// Trait for object that can be decoded from an owned `&[u8]`.
    pub trait FromBytes: Sized {
        type Error: std::error::Error;

        fn decode(bytes: Vec<u8>) -> Result<Self, Self::Error>;
    }

    impl<T, E> FromBytes for T
    where
        T: for<'a> TryFrom<&'a [u8], Error = E> + ImplMethod<METHOD = AsRefSliceIM>,
        E: std::error::Error,
    {
        type Error = E;

        fn decode(bytes: Vec<u8>) -> Result<Self, Self::Error> {
            T::try_from(&bytes)
        }
    }

    /// Determines how [FromBytes] should be implemented for this type.
    pub trait ImplMethod {
        type METHOD: ImplMethodName;
    }

    /// The implementors of this trait name the different ways [FromBytes] can be implemented
    /// automatically.  It's used by the [ImplMethod] trait.
    pub trait ImplMethodName {}

    /// Indicates [FromBytes] should be implemented via `TryFrom<&[u8]>`.
    pub struct AsRefSliceIM {}
    impl ImplMethodName for AsRefSliceIM {}

    #[derive(thiserror::Error, Debug)]
    pub enum Curve25519DalekScalarFromBytesError {
        #[error("converting slice to array failed")]
        SliceToArray,

        #[error("converting array to scalar failed")]
        FromArray,
    }

    impl FromBytes for curve25519_dalek::scalar::Scalar {
        type Error = Curve25519DalekScalarFromBytesError;

        fn decode(bytes: Vec<u8>) -> Result<Self, Self::Error> {
            let buff: [u8; 32] = bytes
                .try_into()
                .ok()
                .ok_or(Curve25519DalekScalarFromBytesError::SliceToArray)?;

            let scalar: subtle::CtOption<Self> =
                curve25519_dalek::scalar::Scalar::from_canonical_bytes(buff);

            if scalar.is_none().into() {
                Err(Curve25519DalekScalarFromBytesError::FromArray)
            } else {
                Ok(scalar.unwrap())
            }
        }
    }

    impl ImplMethod for ed25519_dalek::SigningKey {
        type METHOD = AsRefSliceIM;
    }

    impl ImplMethod for ed25519_dalek::VerifyingKey {
        type METHOD = AsRefSliceIM;
    }
}

pub use from_bytes::FromBytes;
