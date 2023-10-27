//! Tools for (de)serialization
use serde::{
    de::{Error as _, IntoDeserializer as _},
    ser::Error as _,
    Deserialize, Deserializer, Serialize, Serializer,
};

use std::borrow::Cow;
use std::marker::PhantomData;

/// Wraps a type `T` that implements [ToBytes] and/or [FromBytes] so that its (de)serialization can
/// be modified by the [BytesEncoding] `E`.
///
/// We primarily use this to encode keys as hex or base64 strings in JSON instead of arrays.
#[derive(Debug, Clone, PartialEq, Eq, Copy)]
pub struct BytesWrapper<T, E, const FBIM: usize, const TBIM: usize> {
    inner: T,
    phantom_e: PhantomData<E>,
}

impl<T, E, const FBIM: usize, const TBIM: usize> From<T> for BytesWrapper<T, E, FBIM, TBIM> {
    fn from(inner: T) -> Self {
        Self {
            inner,
            phantom: PhantomData,
        }
    }
}

impl<T, E, const FBIM: usize, const TBIM: usize> BytesWrapper<T, E, FBIM, TBIM> {
    /// Returns the wrapped object.
    ///
    /// Note:  We cannot implement `Into<T>` for [BytesWrapper], because it would clash
    /// with the implementation of `Into<T>` when `T` implements `From<BytesWrapper>`.
    pub fn into_inner(self) -> T {
        self.inner
    }

    pub fn new(inner: T) -> Self {
        inner.into()
    }
}

/// Trait for specifuing the encoding of bytes as strings, like hex or base64.
pub trait BytesEncoding {
    type Error: std::error::Error;

    /// Encodes `src` into `dst`, returning the slice of `dst` that was written.
    ///
    /// The caller must ensure that `len(dst) >= encoded_len(src).unwrap()`.
    fn encode<'a>(src: &[u8], dst: &'a mut str) -> Result<&'a str, Self::Error>;

    /// Decodes `src` into `dst`, returning the slice of `dst` that was written.
    ///
    /// The caller must ensure that `len(dst) >= decoded_len(src).unwrap()`.
    fn decode<'a>(src: &str, dst: &'a mut [u8]) -> Result<&'a [u8], Self::Error>;

    /// See [Self::encode].
    fn encoded_len(bytes: &[u8]) -> Result<usize, Self::Error>;

    /// See [Self::decode].
    fn decoded_len(bytes: &str) -> Result<usize, Self::Error>;
}

/// Hex [BytesEncoding].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct B16Encoding<
    const ENCODE_LOWER_CASE: bool = { true },
    const DECODE_MIXED_CASE: bool = { true },
> {}

pub type B16<
    T,
    const FBIM: usize = { from_bytes::DefaultIM },
    const TBIM: usize = { to_bytes::DefaultIM },
    const ENCODE_LOWER_CASE: bool = true,
    const DECODE_MIXED_CASE: bool = true,
> = BytesWrapper<T, B16Encoding<ENCODE_LOWER_CASE, DECODE_MIXED_CASE>, FBIM, TBIM>;

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
        if bytes.len() >= usize::MAX / 2 {
            Err(base16ct::Error::InvalidLength)
        } else {
            Ok(base16ct::encoded_len(bytes))
        }
    }

    fn decoded_len(bytes: &str) -> Result<usize, Self::Error> {
        base16ct::decoded_len(bytes.as_bytes())
    }
}

/// Base64 [BytesEncoding]
#[derive(Debug, Clone, PartialEq, Eq, Copy)]
pub struct B64Encoding<Enc: base64ct::Encoding> {
    phantom: PhantomData<Enc>,
}

/// Wrapper around `T` implementing (de)serialization using [base64ct::Base64].
pub type B64<
    T = Vec<u8>,
    const FBIM: usize = { from_bytes::DefaultIM },
    const TBIM: usize = { to_bytes::DefaultIM },
> = BytesWrapper<T, B64Encoding<base64ct::Base64>, FBIM, TBIM>;

/// Wrapper around `T` implementing (de)serialization using [base64ct::Base64UrlUnpadded].
pub type B64UU<
    T = Vec<u8>,
    const FBIM: usize = { from_bytes::DefaultIM },
    const TBIM: usize = { to_bytes::DefaultIM },
> = BytesWrapper<T, B64Encoding<base64ct::Base64UrlUnpadded>, FBIM, TBIM>;

impl<Enc: base64ct::Encoding> BytesEncoding for B64Encoding<Enc> {
    type Error = base64ct::Error;

    fn encode<'a>(src: &[u8], dst: &'a mut str) -> Result<&'a str, Self::Error> {
        // SAFETY: all the base64ct alphabets are valid utf-8
        Enc::encode(src, unsafe { dst.as_bytes_mut() }).map_err(Into::into)
    }

    fn decode<'a>(src: &str, dst: &'a mut [u8]) -> Result<&'a [u8], Self::Error> {
        Enc::decode(src, dst)
    }

    fn encoded_len(bytes: &[u8]) -> Result<usize, Self::Error> {
        if bytes.len() >= usize::MAX / 4 {
            Err(base64ct::Error::InvalidLength)
        } else {
            Ok(Enc::encoded_len(bytes))
        }
    }

    fn decoded_len(bytes: &str) -> Result<usize, Self::Error> {
        // NOTE: base64ct provides no `decoded_len` function, so we overestimate
        // the decoded length as the original length
        Ok(bytes.len())
    }
}

impl<T, E, const FBIM: usize, const TBIM: usize> std::ops::Deref
    for BytesWrapper<T, E, FBIM, TBIM>
{
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl<T, E, const FBIM: usize, const TBIM: usize> std::ops::DerefMut
    for BytesWrapper<T, E, FBIM, TBIM>
{
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.inner
    }
}

impl<T, E, const FBIM: usize, const TBIM: usize> Serialize for BytesWrapper<T, E, FBIM, TBIM>
where
    T: ToBytes<TBIM>,
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

impl<T, E, const FBIM: usize, const TBIM: usize> core::str::FromStr
    for BytesWrapper<T, E, FBIM, TBIM>
where
    T: FromBytes<FBIM>,
    E: BytesEncoding,
{
    type Err = serde::de::value::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::deserialize(s.into_deserializer())
    }
}

impl<T, E, const FBIM: usize, const TBIM: usize> std::fmt::Display
    for BytesWrapper<T, E, FBIM, TBIM>
where
    T: ToBytes<TBIM>,
    E: BytesEncoding,
{
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        Ok(self.serialize(f)?)
    }
}

impl<'de, T, E, const FBIM: usize, const TBIM: usize> Deserialize<'de>
    for BytesWrapper<T, E, FBIM, TBIM>
where
    T: FromBytes<FBIM>,
    E: BytesEncoding,
{
    fn deserialize<D>(d: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(transparent)]
        struct CowStr<'a>(#[serde(borrow)] Cow<'a, str>);

        let cow_s: CowStr<'de> = serde::Deserialize::deserialize(d)?;
        let s = &cow_s.0;

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
    pub trait FromBytes<const IM: usize>: Sized {
        type Error: std::error::Error;

        fn decode(bytes: Vec<u8>) -> Result<Self, Self::Error>;
    }

    /// Indicates [FromBytes] should be implemented via `TryFrom<&[u8]>`.
    pub const TryFromSliceIM: usize = 0;
    pub const DefaultIM: usize = 0;
    pub const FromArrayIM: usize = 1;
    pub const ManualIM: usize = 2;

    impl<T, E> FromBytes<TryFromSliceIM> for T
    where
        T: for<'a> TryFrom<&'a [u8], Error = E>,
        E: std::error::Error,
    {
        type Error = E;

        fn decode(bytes: Vec<u8>) -> Result<Self, Self::Error> {
            T::try_from(&bytes)
        }
    }

    impl<T> FromBytes<FromArrayIM> for T
    where
        T: From<[u8; 64]>,
    {
        type Error = ViaArrayError;

        fn decode(bytes: Vec<u8>) -> Result<Self, Self::Error> {
            let buff: [u8; 64] = bytes.try_into().ok().ok_or(ViaArrayError::SliceToArray)?;

            Ok(T::from(buff))
        }
    }

    #[derive(thiserror::Error, Debug)]
    pub enum ViaArrayError {
        #[error("converting slice to array failed - slice has incorrect size")]
        SliceToArray,

        #[error("converting array to object failed")]
        FromArray,
    }

    impl FromBytes<ManualIM> for curve25519_dalek::scalar::Scalar {
        type Error = ViaArrayError;

        fn decode(bytes: Vec<u8>) -> Result<Self, Self::Error> {
            let buff: [u8; 32] = bytes.try_into().ok().ok_or(ViaArrayError::SliceToArray)?;

            let scalar: subtle::CtOption<Self> =
                curve25519_dalek::scalar::Scalar::from_canonical_bytes(buff);

            if scalar.is_none().into() {
                Err(ViaArrayError::FromArray)
            } else {
                Ok(scalar.unwrap())
            }
        }
    }
}

pub use from_bytes::FromBytes;

pub mod to_bytes {
    use super::*;

    /// Trait for objects that can be encoded as `&[u8]`.
    pub trait ToBytes<const IM: usize> {
        type Error: std::error::Error;

        fn encode(&self) -> Result<Cow<'_, [u8]>, Self::Error>;
    }

    impl<T: AsRef<[u8]>> ToBytes<AsRefSliceIM> for T {
        type Error = std::convert::Infallible;

        fn encode(&self) -> Result<Cow<'_, [u8]>, Self::Error> {
            Ok(Cow::Borrowed(self.as_ref()))
        }
    }

    pub const AsRefSliceIM: usize = 0;
    pub const DefaultIM: usize = 0;
    pub const ManualIM: usize = 1;

    impl ToBytes<ManualIM> for ed25519_dalek::Signature {
        type Error = core::convert::Infallible;

        fn encode(&self) -> Result<Cow<'_, [u8]>, Self::Error> {
            self.to_vec().into()
        }
    }
}

pub use to_bytes::ToBytes;
