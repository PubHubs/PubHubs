//! Sealing data using symmetric crypto

use std::marker::PhantomData;

use serde::{Deserialize, Serialize};

use crate::misc::serde_ext::bytes_wrapper::B64UU;

/// A symmetrically encrypted encoding of `T`.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(transparent)]
pub struct Sealed<T> {
    inner: B64UU,

    phanton_data: PhantomData<T>,
}
