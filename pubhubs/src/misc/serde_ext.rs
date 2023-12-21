//! Tools for (de)serialization
use serde::{
    de::IntoDeserializer as _, ser::Error as _, Deserialize, Deserializer, Serialize, Serializer,
};

use core::fmt;
use std::marker::PhantomData;

pub mod bytes_wrapper {
    use super::*;

    /// Wraps a type `T` that uses the byte array serde data type for serialization so
    /// that the serde string data type is used instead,
    /// according to [BytesEncoding] `O::Encoding`.
    ///
    /// Due to the generic (de)serialize implementation, the standard types
    /// `Vec<u8>`, `&[u8]`, `[u8,N]`, ... use the sequence serde data type instead of byte array.
    ///
    /// Use [serde_bytes::Bytes], [serde_bytes::ByteBuf], and [ByteArray] instead.
    /// (Or use [`ChangeVisitorType`] to change the visitor type to [`VisitorType::ByteSequence`].)
    ///
    /// We primarily use this to encode keys as hex or base64 strings in JSON instead of arrays.
    pub struct BytesWrapper<T, O> {
        inner: T,
        phantom: PhantomData<O>,
    }

    // Implement some traits that are not derived correctly due to the presence of `O`.
    impl<T: Copy, O> Copy for BytesWrapper<T, O> {}

    impl<T: Clone, O> Clone for BytesWrapper<T, O> {
        fn clone(&self) -> Self {
            Self {
                inner: self.inner.clone(),
                phantom: PhantomData,
            }
        }
    }

    impl<T: fmt::Debug, O> fmt::Debug for BytesWrapper<T, O> {
        fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
            self.inner.fmt(f)
        }
    }

    impl<T: PartialEq, O> PartialEq for BytesWrapper<T, O> {
        fn eq(&self, other: &Self) -> bool {
            self.inner.eq(&other.inner)
        }
    }

    impl<T: Eq, O> Eq for BytesWrapper<T, O> {}

    impl<T: std::hash::Hash, O> std::hash::Hash for BytesWrapper<T, O> {
        fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
            self.inner.hash(state)
        }

        // NOTE: we can't implement the provided mehtod `hash_slice` by forwarding
        // it to T::hash_slice, because we cannot create a `&[T]` from a `&[Self]`
        // without copying.
    }

    impl<T: PartialOrd, O> PartialOrd for BytesWrapper<T, O> {
        fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
            self.inner.partial_cmp(&other.inner)
        }

        fn lt(&self, other: &Self) -> bool {
            self.inner.lt(&other.inner)
        }

        fn le(&self, other: &Self) -> bool {
            self.inner.le(&other.inner)
        }

        fn gt(&self, other: &Self) -> bool {
            self.inner.gt(&other.inner)
        }

        fn ge(&self, other: &Self) -> bool {
            self.inner.ge(&other.inner)
        }
    }

    impl<T: Ord, O> Ord for BytesWrapper<T, O> {
        fn cmp(&self, other: &Self) -> std::cmp::Ordering {
            self.inner.cmp(&other.inner)
        }

        // NOTE: we can't more efficiently implement `max`, `min` and `clamp` by forwarding to the
        // implementations on `T`.
    }

    impl<T: Default, O> Default for BytesWrapper<T, O> {
        fn default() -> Self {
            Self {
                inner: T::default(),
                phantom: PhantomData,
            }
        }
    }

    /// Determines how exactly [`BytesWrapper`] should wrap the underlying type.
    pub trait Options {
        /// How this type is encoded (e.g. base16, base64, etc.)
        type Encoding;

        /// During deserialization, how should the byte array be visited?
        const VISITOR_TYPE: VisitorType = VisitorType::default();
    }

    impl<E> Options for (E,)
    where
        E: BytesEncoding,
    {
        type Encoding = E;
    }

    /// Changes the [`VisitorType`] of the given [`Options`] to `VT`.
    pub struct ChangeVisitorType<O, const VT: isize> {
        phantom_o: PhantomData<O>,
    }

    impl<O, const VT: isize> Options for ChangeVisitorType<O, VT>
    where
        O: Options,
    {
        type Encoding = O::Encoding;

        const VISITOR_TYPE: VisitorType = match VT {
            VT_OWNED_BYTE_ARRAY => VisitorType::OwnedByteArray,
            VT_BORROWED_BYTE_ARRAY => VisitorType::BorrowedByteArray,
            VT_TRANSIENT_BYTE_ARRAY => VisitorType::TransientByteArray,
            VT_BYTE_SEQUENCE => VisitorType::ByteSequence,
            _ => panic!("Unknown visitor type"),
        };
    }

    impl<T, O> From<T> for BytesWrapper<T, O> {
        fn from(inner: T) -> Self {
            Self {
                inner,
                phantom: PhantomData,
            }
        }
    }

    impl<T, O> BytesWrapper<T, O> {
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

    const VT_OWNED_BYTE_ARRAY: isize = 0;
    const VT_BORROWED_BYTE_ARRAY: isize = 1;
    const VT_TRANSIENT_BYTE_ARRAY: isize = 2;
    const VT_BYTE_SEQUENCE: isize = 3;

    /// Enumerates the ways in which a sequence of bytes may be visited during deserialization.
    #[repr(isize)]
    pub enum VisitorType {
        /// [serde::de::Visitor::visit_byte_buf], default
        OwnedByteArray = VT_OWNED_BYTE_ARRAY,
        /// [serde::de::Visitor::visit_borrowed_bytes]
        BorrowedByteArray = VT_BORROWED_BYTE_ARRAY,
        /// [serde::de::Visitor::visit_bytes]
        TransientByteArray = VT_TRANSIENT_BYTE_ARRAY,
        /// [serde::de::Visitor::visit_seq]
        ByteSequence = VT_BYTE_SEQUENCE,
    }

    impl VisitorType {
        const fn default() -> Self {
            VisitorType::OwnedByteArray
        }
    }

    /// Trait for specifying the encoding of bytes as strings, like hex or base64.
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
    pub struct B16Encoding<
        const ENCODE_LOWER_CASE: bool = { true },
        const DECODE_MIXED_CASE: bool = { true },
    > {}

    /// Wrapper around `T` implementing (de)serialization using hex-encoding.
    pub type B16<
        T = serde_bytes::ByteBuf,
        const ENCODE_LOWER_CASE: bool = true,
        const DECODE_MIXED_CASE: bool = true,
    > = BytesWrapper<T, (B16Encoding<ENCODE_LOWER_CASE, DECODE_MIXED_CASE>,)>;

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
    pub struct B64Encoding<Enc: base64ct::Encoding> {
        phantom: PhantomData<Enc>,
    }

    /// Wrapper around `T` implementing (de)serialization using [base64ct::Base64].
    pub type B64<T = serde_bytes::ByteBuf> = BytesWrapper<T, (B64Encoding<base64ct::Base64>,)>;

    /// Wrapper around `T` implementing (de)serialization using [base64ct::Base64UrlUnpadded].
    pub type B64UU<T = serde_bytes::ByteBuf> =
        BytesWrapper<T, (B64Encoding<base64ct::Base64UrlUnpadded>,)>;

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

    impl<T, O> std::ops::Deref for BytesWrapper<T, O> {
        type Target = T;

        fn deref(&self) -> &Self::Target {
            &self.inner
        }
    }

    impl<T, O> std::ops::DerefMut for BytesWrapper<T, O> {
        fn deref_mut(&mut self) -> &mut Self::Target {
            &mut self.inner
        }
    }

    /// Contains implementation details for [`EncodingSerializer`].
    mod encoding_serializer {
        use super::*;

        macro_rules! expected_bytes {
            ($got : tt) => {
                Err(Self::Error::custom(ExpectedBytesError {
                    got: stringify!($got),
                }))
            };
        }

        macro_rules! serialize_primitives {
            ($($f: ident: $t:ty,)*) => {
                $(
                    fn $f(self, _v:$t) -> Result<Self::Ok, Self::Error> {
                        expected_bytes!($t)
                    }
                )*
            }
        }

        /// Serializes a byte array by encoding it according to [BytesEncoding] `E` and passing
        /// the resulting string to the [Serializer] `S`.
        pub(super) struct EncodingSerializer<S, E> {
            s: S,
            phantom: PhantomData<E>,
        }

        impl<S, E> EncodingSerializer<S, E>
        where
            S: Serializer,
            E: BytesEncoding,
        {
            pub(super) fn new(s: S) -> Self {
                Self {
                    s,
                    phantom: PhantomData,
                }
            }
        }

        impl<S, E> Serializer for EncodingSerializer<S, E>
        where
            S: Serializer,
            E: BytesEncoding,
        {
            type Ok = S::Ok;
            type Error = S::Error;
            type SerializeSeq = serde::ser::Impossible<S::Ok, Self::Error>;
            type SerializeTuple = encoding_serializer::SerializeTuple<S, E>;
            type SerializeTupleStruct = serde::ser::Impossible<S::Ok, Self::Error>;
            type SerializeTupleVariant = serde::ser::Impossible<S::Ok, Self::Error>;
            type SerializeMap = serde::ser::Impossible<S::Ok, Self::Error>;
            type SerializeStruct = serde::ser::Impossible<S::Ok, Self::Error>;
            type SerializeStructVariant = serde::ser::Impossible<S::Ok, Self::Error>;

            fn serialize_bytes(self, v: &[u8]) -> Result<Self::Ok, Self::Error> {
                let encoded_len: usize = match E::encoded_len(v) {
                    Ok(encoded_len) => encoded_len,
                    Err(err) => return Err(S::Error::custom(err)),
                };

                let mut string = unsafe { String::from_utf8_unchecked(vec![0; encoded_len]) };
                // SAFETY: only zeroes is valid utf8

                let substr: &str = match E::encode(v, &mut string) {
                    Ok(substr) => substr,
                    Err(err) => return Err(S::Error::custom(err)),
                };

                self.s.serialize_str(substr)
            }

            fn serialize_tuple(self, len: usize) -> Result<Self::SerializeTuple, Self::Error> {
                Ok(encoding_serializer::SerializeTuple::<S, E>::new(self, len))
            }

            serialize_primitives! {
                serialize_bool: bool,
                serialize_i8: i8,
                serialize_i16: i16,
                serialize_i32: i32,
                serialize_i64: i64,
                serialize_i128: i128,
                serialize_u8: u8,
                serialize_u16: u16,
                serialize_u32: u32,
                serialize_u64: u64,
                serialize_u128: u128,
                serialize_f32: f32,
                serialize_f64: f64,
                serialize_char: char,
                serialize_str: &str,
                serialize_unit_struct: &'static str,
            }

            fn serialize_none(self) -> Result<Self::Ok, Self::Error> {
                expected_bytes!("none")
            }

            fn serialize_some<T>(self, _value: &T) -> Result<Self::Ok, Self::Error>
            where
                T: Serialize + ?Sized,
            {
                expected_bytes!("some")
            }

            fn serialize_unit(self) -> Result<Self::Ok, Self::Error> {
                expected_bytes!("unit")
            }

            fn serialize_unit_variant(
                self,
                _name: &'static str,
                _variant_index: u32,
                _variant: &'static str,
            ) -> Result<Self::Ok, Self::Error> {
                expected_bytes!("unit variant")
            }

            fn serialize_newtype_struct<T>(
                self,
                _name: &'static str,
                _value: &T,
            ) -> Result<Self::Ok, Self::Error>
            where
                T: Serialize + ?Sized,
            {
                expected_bytes!("newtype struct")
            }

            fn serialize_newtype_variant<T>(
                self,
                _name: &'static str,
                _variant_index: u32,
                _variant: &'static str,
                _value: &T,
            ) -> Result<Self::Ok, Self::Error>
            where
                T: Serialize + ?Sized,
            {
                expected_bytes!("newtype variant")
            }

            fn serialize_seq(self, _len: Option<usize>) -> Result<Self::SerializeSeq, Self::Error> {
                expected_bytes!("seq")
            }

            fn serialize_tuple_struct(
                self,
                _name: &'static str,
                _len: usize,
            ) -> Result<Self::SerializeTupleStruct, Self::Error> {
                expected_bytes!("tuple struct")
            }

            fn serialize_tuple_variant(
                self,
                _name: &'static str,
                _variant_index: u32,
                _variant: &'static str,
                _len: usize,
            ) -> Result<Self::SerializeTupleVariant, Self::Error> {
                expected_bytes!("tuple variant")
            }

            fn serialize_map(self, _len: Option<usize>) -> Result<Self::SerializeMap, Self::Error> {
                expected_bytes!("map")
            }

            fn serialize_struct(
                self,
                _name: &'static str,
                _len: usize,
            ) -> Result<Self::SerializeStruct, Self::Error> {
                expected_bytes!("struct")
            }

            fn serialize_struct_variant(
                self,
                _name: &'static str,
                _variant_index: u32,
                _variant: &'static str,
                _len: usize,
            ) -> Result<Self::SerializeStructVariant, Self::Error> {
                expected_bytes!("struct variant")
            }
        }

        #[derive(thiserror::Error, Debug)]
        #[error("to use a bytes encoding (like base64) for the serialization of a type, that type must serialize to bytes, but got {got}")]
        struct ExpectedBytesError {
            got: &'static str,
        }

        pub(super) struct SerializeTuple<S, E> {
            inner: Vec<u8>,
            encoding_serializer: EncodingSerializer<S, E>,
            expected_len: usize,
        }

        impl<S, E> SerializeTuple<S, E> {
            fn new(encoding_serializer: EncodingSerializer<S, E>, expected_len: usize) -> Self
            where
                S: Serializer,
                E: BytesEncoding,
            {
                Self {
                    encoding_serializer,
                    expected_len,
                    inner: Vec::<u8>::with_capacity(expected_len),
                }
            }
        }

        impl<S: Serializer, E: BytesEncoding> serde::ser::SerializeTuple for SerializeTuple<S, E> {
            type Ok = S::Ok;
            type Error = S::Error;

            fn serialize_element<T: Serialize + ?Sized>(
                &mut self,
                value: &T,
            ) -> Result<(), Self::Error> {
                if self.inner.len() == self.expected_len {
                    return Err(Self::Error::custom("improper use of serializer: serializing more tuple elements than announced"));
                }

                // TODO, maybe: proper `ByteSerializer` implementation to replace this hack
                let byte =
                    u8::deserialize(value.serialize(serde_json::value::Serializer).map_err(
                        |err| {
                            Self::Error::custom(format!(
                                "failed to serialize to byte (hackingly via serde_json): {err}"
                            ))
                        },
                    )?)
                    .map_err(|err| {
                        Self::Error::custom(format!(
                            "failed to serialize to byte (hackingly via serde_json): {err}"
                        ))
                    })?;
                self.inner.push(byte);

                Ok(())
            }

            fn end(self) -> Result<Self::Ok, Self::Error> {
                if self.inner.len() != self.expected_len {
                    return Err(Self::Error::custom(
                        "improper use of serializer: serialized less tuple elements than announced",
                    ));
                }

                self.encoding_serializer.serialize_bytes(&self.inner)
            }
        }
    }

    use encoding_serializer::EncodingSerializer;

    impl<T, O: Options> Serialize for BytesWrapper<T, O>
    where
        T: Serialize,
        O::Encoding: BytesEncoding,
    {
        fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
            self.inner
                .serialize(EncodingSerializer::<_, O::Encoding>::new(s))
        }
    }

    impl<T, O: Options> core::str::FromStr for BytesWrapper<T, O>
    where
        T: for<'de> Deserialize<'de>,
        O::Encoding: BytesEncoding,
    {
        type Err = serde::de::value::Error;

        fn from_str(s: &str) -> Result<Self, Self::Err> {
            Self::deserialize(s.into_deserializer())
        }
    }

    impl<T, O: Options> std::fmt::Display for BytesWrapper<T, O>
    where
        T: Serialize,
        O::Encoding: BytesEncoding,
    {
        fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            self.serialize(f)
        }
    }

    /// Extracts a `O::Value` from the given [Deserializer] by extracting a string,
    /// decoding this to a byte array according to [BytesEncoding] `O::Encoding`,
    /// and finally passing this byte array to the [Deserialize] implementation of `T`.
    struct EncodedBytesVisitor<T, O> {
        phantom_t: PhantomData<T>,
        phantom_o: PhantomData<O>,
    }

    impl<T, O: Options> EncodedBytesVisitor<T, O>
    where
        T: serde::de::DeserializeOwned,
        O::Encoding: BytesEncoding,
    {
        fn new() -> Self {
            Self {
                phantom_t: PhantomData,
                phantom_o: PhantomData,
            }
        }
    }

    impl<'de, T, O: Options> serde::de::Visitor<'de> for EncodedBytesVisitor<T, O>
    where
        T: serde::de::DeserializeOwned,
        O::Encoding: BytesEncoding,
    {
        type Value = T;

        fn expecting(&self, f: &mut core::fmt::Formatter) -> core::fmt::Result {
            write!(f, "str")
        }

        fn visit_str<Error: serde::de::Error>(self, v: &str) -> Result<Self::Value, Error> {
            let decoded_len: usize = match O::Encoding::decoded_len(v) {
                Ok(decoded_len) => decoded_len,
                Err(err) => return Err(Error::custom(err)), // TODO: better err?
            };

            let mut buf = vec![0; decoded_len];

            let slice: &[u8] = match O::Encoding::decode(v, &mut buf) {
                Ok(slice) => slice,
                Err(err) => return Err(Error::custom(err)), // TODO: better err?
            };

            let slice_len = slice.len();
            let slice_ptr = slice.as_ptr();

            // truncate buf to the size used by decode, but first check that slice
            // is indeed a slice into buf starting at index 0
            assert_eq!(buf.as_ptr(), slice_ptr);
            buf.truncate(slice_len);

            match O::VISITOR_TYPE {
                VisitorType::OwnedByteArray => T::deserialize(ByteBufDeserializer::new(buf)),
                VisitorType::BorrowedByteArray => {
                    T::deserialize(serde::de::value::BorrowedBytesDeserializer::new(&buf))
                }
                VisitorType::TransientByteArray => {
                    T::deserialize(serde::de::value::BytesDeserializer::new(&buf))
                }
                VisitorType::ByteSequence => {
                    T::deserialize(serde::de::value::SeqDeserializer::new(buf.into_iter()))
                }
            }
        }
    }

    /// A [Deserializer] owning a `Vec<u8>` that always calls [serde::de::Visitor::visit_byte_buf].
    #[derive(Clone)]
    pub struct ByteBufDeserializer<E> {
        value: Vec<u8>,
        marker: PhantomData<E>,
    }

    impl<E> ByteBufDeserializer<E> {
        pub fn new(value: Vec<u8>) -> Self {
            Self {
                value,
                marker: PhantomData,
            }
        }
    }

    impl<'de, E> serde::de::Deserializer<'de> for ByteBufDeserializer<E>
    where
        E: serde::de::Error,
    {
        type Error = E;

        fn deserialize_any<V>(self, visitor: V) -> Result<V::Value, Self::Error>
        where
            V: serde::de::Visitor<'de>,
        {
            visitor.visit_byte_buf(self.value)
        }

        serde::forward_to_deserialize_any! {
            bool i8 i16 i32 i64 i128 u8 u16 u32 u64 u128 f32 f64 char str string
            bytes byte_buf option unit unit_struct newtype_struct seq tuple
            tuple_struct map struct identifier ignored_any enum
        }
    }

    impl<E> core::fmt::Debug for ByteBufDeserializer<E> {
        fn fmt(&self, formatter: &mut core::fmt::Formatter) -> core::fmt::Result {
            formatter
                .debug_struct("ByteBufDeserializer")
                .field("value", &self.value)
                .finish()
        }
    }

    impl<'de, T, O: Options> Deserialize<'de> for BytesWrapper<T, O>
    where
        T: for<'de2> Deserialize<'de2>,
        O::Encoding: BytesEncoding,
    {
        fn deserialize<D>(d: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            Ok(d.deserialize_str(EncodedBytesVisitor::<T, O>::new())?
                .into())
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn serialize_bytes_wrapper() {
            assert_eq!(
                &serde_json::to_string(&B64UU::<_>::from(serde_bytes::ByteBuf::from([0; 32])))
                    .unwrap(),
                "\"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\""
            );
        }

        #[test]
        fn byte_array_deserialization() {
            assert_eq!(
                ByteArray::<4>::deserialize(serde::de::value::BytesDeserializer::<
                    serde::de::value::Error,
                >::new(b"test"))
                .unwrap()
                .inner,
                *b"test"
            );

            assert_eq!(
                ByteArray::<4>::deserialize(serde::de::value::BorrowedBytesDeserializer::<
                    serde::de::value::Error,
                >::new(b"test"))
                .unwrap()
                .inner,
                *b"test"
            );

            assert_eq!(
                ByteArray::<4>::deserialize(ByteBufDeserializer::<serde::de::value::Error>::new(
                    b"test".to_vec()
                ))
                .unwrap()
                .inner,
                *b"test"
            );
        }

        #[test]
        fn ed25519_dalek_bug() {
            let bytes = base16ct::lower::decode_vec(
                "66b1419fae979516fb3807dda1b05026b2570a7ab2190254e524af4f0934ddd2",
            )
            .unwrap();

            let d =
                serde::de::value::BorrowedBytesDeserializer::<serde::de::value::Error>::new(&bytes);
            ed25519_dalek::VerifyingKey::deserialize(d).unwrap(); // works

            let d = serde::de::value::BytesDeserializer::<serde::de::value::Error>::new(&bytes);
            ed25519_dalek::VerifyingKey::deserialize(d).unwrap_err();
            // This errs, but should start working after
            // https://github.com/dalek-cryptography/curve25519-dalek/pull/602 is released.

            let d = serde::de::value::SeqDeserializer::<_, serde::de::value::Error>::new(
                [0u8; 32].into_iter(),
            );
            curve25519_dalek::scalar::Scalar::deserialize(d).unwrap(); // works

            let d = serde::de::value::BytesDeserializer::<serde::de::value::Error>::new(&[0u8; 32]);
            curve25519_dalek::scalar::Scalar::deserialize(d).unwrap_err();
            // This errs, but since `Scalar`s, unlike `{Signing,Verifying}Key`s, are serialized as
            // byte sequences instead of byte arrays, this will probably not change anytime soon.
        }
    }
}

pub use bytes_wrapper::BytesWrapper;

/// Wrapper around `[u8, N]` that (de)serializes using the byte buffer (instead of sequence) data type.
#[derive(Copy, Debug, Clone, PartialEq, Eq, Hash)]
pub struct ByteArray<const N: usize> {
    inner: [u8; N],
}

impl<const N: usize> From<[u8; N]> for ByteArray<N> {
    fn from(inner: [u8; N]) -> Self {
        Self { inner }
    }
}

impl<const N: usize> Into<[u8; N]> for ByteArray<N> {
    fn into(self) -> [u8; N] {
        self.inner
    }
}

impl<const N: usize> Serialize for ByteArray<N> {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_bytes(&self.inner)
    }
}

/// Extracts a [ByteArray] from a [serde::Deserializer].
struct ByteArrayVisitor<const N: usize> {}

impl<'de, const N: usize> serde::de::Visitor<'de> for ByteArrayVisitor<N> {
    type Value = [u8; N];

    fn expecting(&self, f: &mut core::fmt::Formatter) -> core::fmt::Result {
        write!(f, "a byte array of length {}", N)
    }

    fn visit_byte_buf<E>(self, v: Vec<u8>) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        <[u8; N]>::try_from(v).map_err(|v| E::invalid_length(v.len(), &self))
    }

    fn visit_bytes<E>(self, v: &[u8]) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        <[u8; N]>::try_from(v).map_err(|_| E::invalid_length(v.len(), &self))
    }
}

impl<'de, const N: usize> Deserialize<'de> for ByteArray<N> {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        Ok(d.deserialize_byte_buf(ByteArrayVisitor::<N> {})?.into())
    }
}
