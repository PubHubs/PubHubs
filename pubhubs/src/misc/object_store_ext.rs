//! *(Work in progress)* Tools for dealing with [`object_store`]s.

use std::fmt::Display;
use std::pin::Pin;

use core::future::Future;

use futures::stream::BoxStream;
use futures::FutureExt as _;
use futures_util::future::BoxFuture;

use object_store::{
    self, path::Path, Error, GetOptions, GetResult, ListResult, MultipartUpload, ObjectMeta,
    ObjectStore, PutMode, PutMultipartOpts, PutOptions, PutPayload, PutResult, Result,
};

/// Wraps an existing [`ObjectStore`] adding support for [`object_store::PutMode::Update`].
///
/// It does so by assigning a version number (`0`, `1`, ...) to each `/object/path`, and storing
/// the object at `/object/path/v<version_number>` in the underlying object store.
///
/// If multiple versions for an object exist, the largest version number counts.
///
/// To **create** an object at `/object/path`,
///  1. It is checked no versions of the object exist;
///  2. The object `/object/path/v0` is created;
///  3. It is checked that no other version of the object exist.
///     If there are, the outdated versions are deleted and [`Error::AlreadyExists`]
///     is returned.
///
/// To **update** the object at `/object/path` given version number `123`.
///  1. The object `/object/path/v124` is created in the underlying object store. If this fails
///     some other invocation of update outpaced us; fail with [`Error::Precondition`].
///  2. Check that `v123` and `v124` are in the object store, and `v124` is the latest verson.  
///     If not, return [`Error::Precondition`], but before doing so, delete all outdated versions,
///     also when everything was alright.
///
#[allow(dead_code)]
#[derive(Debug)]
struct VersionedObjectStore<T> {
    inner: T,
}

/// Represents the version of an object in a [`VersionedObjectStore`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[allow(dead_code)]
struct Version(pub u64);

impl Version {
    /// Tries to interpret the given filename as a version number.
    #[allow(dead_code)]
    fn maybe_from_filename(filename: impl AsRef<str>) -> Option<Self> {
        let filename = filename.as_ref();

        if filename.get(0..1) != Some("v") {
            return None;
        }

        let version_str = filename.get(1..)?;

        // before parsing version_str, let's make sure there are no characters in there that
        // 'parse' accepts, but would make the representation of the version non-unique, such as
        // "+".
        if !(version_str.chars().all(|c| char::is_digit(c, 10))) {
            return None;
        }

        let Ok(version): Result<u64, _> = version_str.parse() else {
            return None;
        };

        Some(Version(version))
    }
}

impl<T: ObjectStore> VersionedObjectStore<T> {
    /// Gets a sorted list of all versions present of the object at `location`, with the latest
    /// (and current) version last.
    ///
    /// Beware: when you get back the result the situation might have already changed.
    #[allow(dead_code)]
    async fn get_versions(&self, location: &Path) -> Result<Vec<Version>> {
        let lr = self.inner.list_with_delimiter(Some(location)).await?;

        let mut versions: Vec<Version> = lr
            .objects
            .into_iter()
            .filter_map(|obj_meta| {
                Version::maybe_from_filename(
                    obj_meta
                        .location
                        .filename()
                        .expect("unexpected empty filename"),
                )
            })
            .collect();

        versions.sort();

        Ok(versions)
    }

    #[allow(dead_code)]
    async fn create(
        &self,
        location: &Path,
        payload: PutPayload,
        opts: PutOptions,
    ) -> Result<PutResult> {
        assert!(matches!(opts.mode, PutMode::Create));

        if !self.get_versions(location).await?.is_empty() {
            return Err(Error::AlreadyExists {
                path: location.to_string(),
                source: "already exists".into(),
            });
        }

        let v0_location = location.child("v0");

        self.inner.put_opts(&v0_location, payload, opts).await?;

        todo! {}
    }
}

impl<T: ObjectStore> ObjectStore for VersionedObjectStore<T> {
    fn put_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        location: &'life1 Path,
        payload: PutPayload,
        opts: PutOptions,
    ) -> BoxFuture<'async_trait, Result<PutResult>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        #[expect(clippy::needless_return)]
        match opts.mode {
            PutMode::Overwrite => return async { Err(Error::NotImplemented) }.boxed(),
            PutMode::Create => return self.create(location, payload, opts).boxed(),
            PutMode::Update(..) => todo! {},
        }

        // todo! {}
    }

    fn put_multipart_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        _location: &'life1 Path,
        _opts: PutMultipartOpts,
    ) -> Pin<Box<dyn Future<Output = Result<Box<dyn MultipartUpload>>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        unimplemented! {}
    }

    fn get_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        _location: &'life1 Path,
        _options: GetOptions,
    ) -> Pin<Box<dyn Future<Output = Result<GetResult>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        todo! {}
    }

    fn delete<'life0, 'life1, 'async_trait>(
        &'life0 self,
        _location: &'life1 Path,
    ) -> Pin<Box<dyn Future<Output = Result<()>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        todo! {}
    }

    fn list(&self, _prefix: Option<&Path>) -> BoxStream<'static, Result<ObjectMeta>> {
        unimplemented! {}
    }

    fn list_with_delimiter<'life0, 'life1, 'async_trait>(
        &'life0 self,
        _prefix: Option<&'life1 Path>,
    ) -> Pin<Box<dyn Future<Output = Result<ListResult>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        unimplemented! {}
    }

    fn copy<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        _from: &'life1 Path,
        _to: &'life2 Path,
    ) -> Pin<Box<dyn Future<Output = Result<()>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
    {
        unimplemented! {}
    }

    fn copy_if_not_exists<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        _from: &'life1 Path,
        _to: &'life2 Path,
    ) -> Pin<Box<dyn Future<Output = Result<()>> + Send + 'async_trait>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
    {
        unimplemented! {}
    }
}

impl<T: Display> Display for VersionedObjectStore<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "VersionedObjectStore({}, ...)", self.inner)
    }
}
