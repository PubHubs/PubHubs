//! Extensions to [`object_store`]

use object_store::*;

use futures::future::BoxFuture;
use futures::stream::BoxStream;

/// Implementation of [`ObjectStore`] using a [sqlite](https://sqlite.org) database.
///
/// The main reason for creating this store is that the [`object_store::LocalFileSystem`] store does
/// not support [`PutMode::Update`].
#[derive(Debug)]
pub struct SqliteStore {
    /// Underlying [`rusqlite::Connection`].  Must be protected by a [`tokio::sync::Mutex`], because
    /// [`rusqlite::Connection`] is [`!Sync`].
    connection: tokio::sync::Mutex<rusqlite::Connection>,

    /// For display purposes
    path: std::path::PathBuf,
}

impl SqliteStore {
    pub fn new(path: impl AsRef<std::path::Path>) -> rusqlite::Result<Self> {
        Ok(Self {
            path: path.as_ref().to_owned(),
            connection: tokio::sync::Mutex::new(rusqlite::Connection::open(path)?),
        })
    }
}

impl std::fmt::Display for SqliteStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "SqliteStore({path})", path = self.path.to_string_lossy())
    }
}

impl ObjectStore for SqliteStore {
    fn put_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        location: &'life1 path::Path,
        payload: PutPayload,
        opts: PutOptions,
    ) -> BoxFuture<'async_trait, Result<PutResult>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        todo! {}
    }

    fn put_multipart_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        location: &'life1 path::Path,
        opts: PutMultipartOpts,
    ) -> BoxFuture<'async_trait, Result<Box<dyn MultipartUpload>>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        todo! {}
    }

    fn get_opts<'life0, 'life1, 'async_trait>(
        &'life0 self,
        location: &'life1 path::Path,
        options: GetOptions,
    ) -> BoxFuture<'async_trait, Result<GetResult>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        todo! {}
    }

    fn delete<'life0, 'life1, 'async_trait>(
        &'life0 self,
        location: &'life1 path::Path,
    ) -> BoxFuture<'async_trait, Result<()>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        todo! {}
    }

    fn list(&self, prefix: Option<&path::Path>) -> BoxStream<'static, Result<ObjectMeta>> {
        todo! {}
    }

    fn list_with_delimiter<'life0, 'life1, 'async_trait>(
        &'life0 self,
        prefix: Option<&'life1 path::Path>,
    ) -> BoxFuture<'async_trait, Result<ListResult>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
    {
        todo! {}
    }

    fn copy<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        from: &'life1 path::Path,
        to: &'life2 path::Path,
    ) -> BoxFuture<'async_trait, Result<()>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
    {
        todo! {}
    }

    fn copy_if_not_exists<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        from: &'life1 path::Path,
        to: &'life2 path::Path,
    ) -> BoxFuture<'async_trait, Result<()>>
    where
        Self: 'async_trait,
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
    {
        todo! {}
    }
}
