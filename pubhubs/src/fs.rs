use anyhow::Result;
use std::fs::{DirEntry, ReadDir};
use std::path::{Path, PathBuf};

/// Walks the file tree rooted at root depth first
/// calling cb for all directories and files in the tree.
pub fn walk(
    root: impl AsRef<Path>,
    mut cb: impl FnMut(&Path, &DirEntry) -> Result<()>,
) -> Result<()> {
    let root: &Path = root.as_ref();

    struct Todo {
        path: PathBuf,
        it: ReadDir,
    }

    impl Todo {
        fn new(root: &Path, path: PathBuf) -> Result<Todo> {
            let it = std::fs::read_dir(root.join(&path))?;

            Ok(Todo { path, it })
        }
    }

    let mut todos = vec![Todo::new(root, PathBuf::from(""))?];

    while !todos.is_empty() {
        let idx = todos.len() - 1;

        if let Some(entry_or_err) = todos[idx].it.next() {
            let entry = entry_or_err?;

            let entry_path = todos[idx].path.join(entry.file_name());

            cb(&entry_path, &entry)?;

            if entry.path().is_dir() {
                todos.push(Todo::new(root, entry_path)?);
            }
        } else {
            todos.pop();
        }
    }

    Ok(())
}

pub struct TempDirGuard {
    path: PathBuf,
}

impl std::ops::Deref for TempDirGuard {
    type Target = Path;

    fn deref(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempDirGuard {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.path).expect("failed to remove temporary directory");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::fs;
    use uuid::Uuid;

    /// temp_dir creates a new temporary directory and returns it wrapped
    /// inside a TempDirGuard which removes the temporary directory when
    /// it is dropped.
    pub fn temp_dir() -> Result<TempDirGuard> {
        let path: PathBuf = std::env::temp_dir().join(Uuid::new_v4().to_string());

        std::fs::create_dir(&path)?;

        Ok(TempDirGuard { path })
    }

    #[test]
    fn temp_dir_is_created_and_removed() -> Result<()> {
        let td = temp_dir()?;
        assert!(td.is_dir());

        // create a copy of the path to see if it has been removed after
        // we drop the TempDirGuard
        let path: PathBuf = td.to_path_buf();

        drop(td);
        assert!(!path.exists());
        Ok(())
    }

    #[test]
    fn walk_works() -> Result<()> {
        let td = temp_dir()?;

        fs::create_dir(td.join("a"))?;
        fs::write(td.join("f"), "blaat")?;
        fs::create_dir(td.join("a/1"))?;
        fs::create_dir(td.join("a/2"))?;
        fs::create_dir(td.join("c"))?;
        fs::create_dir(td.join("c/1"))?;
        fs::create_dir(td.join("c/2"))?;
        fs::write(td.join("c/2/f"), "blaat")?;

        let mut results = HashSet::<PathBuf>::new();

        {
            let cb = |p: &Path, _entry: &DirEntry| -> Result<()> {
                results.insert(p.to_path_buf());
                Ok(())
            };

            walk(&*td, cb)?;
        }

        let expected_results = vec!["a", "a/1", "f", "a/2", "c", "c/1", "c/2", "c/2/f"];

        assert_eq!(
            results,
            expected_results
                .iter()
                .map(|s| PathBuf::from(s))
                .collect::<HashSet<PathBuf>>()
        );

        Ok(())
    }
}
