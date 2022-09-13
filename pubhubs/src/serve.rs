use anyhow::{anyhow, Result};
use hyper::{header, Body, Request, Response, StatusCode};
use std::collections::HashMap;
use std::ffi::OsStr;
use std::fs::DirEntry;
use std::path::Path;

/// With StaticAssetss::from_dir, a file tree can be loaded into memory
/// to serve http requests using the `serve` method.
pub struct StaticAssets {
    assets: HashMap<String, StaticAsset>,
}

impl StaticAssets {
    /// When we have a static item for the path mentioned in the request,
    /// return an appropriate Response to serve;  otherwise returns None.
    pub fn serve(&self, req: &Request<Body>) -> Option<Response<Body>> {
        if req.method() != "GET" {
            return None;
        }

        Some(
            self.assets
                .get(&req.uri().path().to_string())?
                .serve_request(req),
        )
    }

    pub fn from_dir(path: impl AsRef<Path>) -> Result<StaticAssets> {
        let path = path.as_ref();
        let mime_types = mime_types();

        let mut result = StaticAssets {
            assets: HashMap::new(),
        };

        let cb = |path: &Path, entry: &DirEntry| -> Result<()> {
            let full_path = entry.path();

            if !full_path.is_file() {
                // don't serve directories
                return Ok(());
            }

            if path.file_name().unwrap().to_str().unwrap().starts_with('.') {
                // don't serve hidden files like ".gitkeep"
                return Ok(());
            }

            let content: Vec<u8> = std::fs::read(&full_path)?;

            let mut h = openssl::sha::Sha256::new();
            h.update(&content);

            let hash: [u8; 32] = h.finish();

            let etag = format!("\"{}\"", openssl::base64::encode_block(&hash));

            let extension = path.extension().ok_or_else(|| {
                anyhow!(
                    "file {} has no extension (which is needed to determine its mime type)",
                    path.display(),
                )
            })?;

            let content_type = mime_types
                .get(extension)
                .ok_or_else(|| {
                    anyhow!(
                        "no mime type configured for the extension {}",
                        extension.to_string_lossy()
                    )
                })?
                .to_string();

            let path_str: String = path
                .to_str()
                .ok_or_else(|| anyhow!("path contains invalid characters"))?
                .to_string();

            result.assets.insert(
                // paths in http requests must have leading slashes
                String::from("/") + &path_str,
                StaticAsset {
                    content,
                    etag,
                    content_type,
                },
            );

            Ok(())
        };

        crate::fs::walk(path, cb)?;

        Ok(result)
    }
}

struct StaticAsset {
    content: Vec<u8>,
    etag: String,
    content_type: String,
}

impl StaticAsset {
    fn serve_request(&self, req: &Request<Body>) -> Response<Body> {
        if let Some(inm_header) = req.headers().get(header::IF_NONE_MATCH) {
            if etag_matches(&self.etag, inm_header) {
                return Response::builder()
                    .status(StatusCode::NOT_MODIFIED)
                    .body(Body::empty())
                    .unwrap();
            }
        }

        self.serve()
    }

    fn serve(&self) -> Response<Body> {
        Response::builder()
            .header(header::CONTENT_TYPE, self.content_type.clone())
            .header(header::ETAG, self.etag.clone())
            .body(Body::from(self.content.clone()))
            .unwrap()
    }
}

/// Returns whether the etag (including the '"'s) matches the pattern
/// used by the If-(None-)Match headers.  This code assumes
/// ',' is not used in the etag.
fn etag_matches(etag: &str, pattern: &header::HeaderValue) -> bool {
    if let Ok(pattern) = pattern.to_str() {
        etag_matches_str(etag, pattern)
    } else {
        false
    }
}

fn etag_matches_str(etag: &str, pattern: &str) -> bool {
    pattern
        .split(',')
        .map(str::trim)
        .any(|s| s == etag || s == "*")
}

/// mime_types returns a HashMap that maps extensions to their mime type.
/// We only include extensions actually used by pubhubs.
//
// TODO: make these mime_types configurable at runtime.
fn mime_types() -> HashMap<&'static OsStr, &'static str> {
    HashMap::from([
        (OsStr::new("png"), "image/png"),
        (OsStr::new("html"), "text/html"),
        (OsStr::new("js"), "application/javascript"),
        (OsStr::new("css"), "text/css"),
        (OsStr::new("map"), "application/x-navimap"),
        (OsStr::new("svg"), "image/svg+xml"),
        (OsStr::new("ttf"), "font/ttf"),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn etag_matches_behaves() {
        assert!(etag_matches_str(
            "\"blaat\"",
            " \"123\",  \"blaat\",   \"\""
        ));
        assert!(!etag_matches_str(
            "\"blaat\"",
            " \"123\",  \"blat\",   \"\""
        ));
        assert!(etag_matches_str(
            "\"blaat\"",
            " \"123\", * ,   \"blat\",   \"\"",
        ));
        // When provided with opaque octets (128-255), fail.
        assert!(!etag_matches(
            "\"blaat\"",
            &header::HeaderValue::from_bytes(b"\"blaat\",\"\xfa\"").unwrap()
        ));
    }
}
