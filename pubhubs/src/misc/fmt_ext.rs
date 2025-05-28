//! Tools for formatting

use std::fmt;
use std::fmt::{Display, Formatter};

/// [`Display`] given type `T` by serializing it to json.
pub struct Json<T: serde::Serialize>(pub T);

impl<T: serde::Serialize> Display for Json<T> {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        write!(
            f,
            "{}",
            serde_json::to_string(&self.0).expect("failed to format")
        )
    }
}

/// [`Display`] given bytes, if possible, by printing the ascii characters ` ` through `~` (except
/// `\`) as is, and escaping `'\r'`, `'\n'`, `'\t'`, and `'\\'`.
/// If other characters are present everything is printed hexadecimal.
///
/// Intended to be used with precision to limit the size of the printed string.
/// ```
/// use pubhubs::misc::fmt_ext;
///
/// // use precision to limit size to 9 characters
/// assert_eq!(format!("{:.9}", fmt_ext::Bytes(b"1234567890")).as_str(), "123456...");
///
/// // hex is used if any irregular bytes are found
/// assert_eq!(format!("{}", fmt_ext::Bytes(b"\0 <- zero")).as_str(), "00203c2d207a65726f");
///
/// // tabs and newlines are `\`es are escaped
/// assert_eq!(format!("{}", fmt_ext::Bytes(b"\t\r\n\\")).as_str(), "\\t\\r\\n\\\\");
///
/// // otherwise the bytes are left unchanged:
/// assert_eq!(format!("{}", fmt_ext::Bytes((b' '..=b'~').collect::<Vec<u8>>().as_slice())).as_str(),
///     " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_`abcdefghijklmnopqrstuvwxyz{|}~");
/// ```
pub struct Bytes<'a>(pub &'a [u8]);

impl Display for Bytes<'_> {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        let mut truncated = false;
        let mut bytes = self.0;

        // disregard anything that won't fit anyhow
        if let Some(precision) = f.precision() {
            if precision < bytes.len() {
                bytes = &bytes[..precision];
                truncated = true;
            }
        }

        let mut buf: Vec<u8> = if bytes
            .iter()
            .all(|&c| matches!(c, b' '..=b'~' | b'\n' | b'\r' | b'\t'))
        {
            let mut byte_iter = bytes.iter();
            let mut todo: Option<u8> = None;

            std::iter::from_fn(|| -> Option<u8> {
                if todo.is_some() {
                    return std::mem::take(&mut todo);
                }

                let (ret, next) = match byte_iter.next()? {
                    b'\n' => (b'\\', Some(b'n')),
                    b'\t' => (b'\\', Some(b't')),
                    b'\r' => (b'\\', Some(b'r')),
                    b'\\' => (b'\\', Some(b'\\')),
                    oth => (*oth, None),
                };

                todo = next;
                Some(ret)
            })
            .collect::<Vec<u8>>()
        } else {
            base16ct::lower::encode_string(bytes).into_bytes()
        };

        let mut result: &mut [u8] = buf.as_mut();

        if let Some(precision) = f.precision() {
            if precision < result.len() {
                result = &mut result[..precision];
                truncated = true;
            }
        }

        if truncated && result.len() >= 3 {
            let result_len = result.len();
            result[result_len - 3..].copy_from_slice(b"...");
        }

        write!(f, "{}", std::str::from_utf8(result).unwrap())
    }
}
