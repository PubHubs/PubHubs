//! Translations related matters
use actix_web::HttpMessage as _;
use anyhow::{Context, Result, anyhow};
use expry::{CustomFuncs, DecodedValue, MemoryScope};
use std::collections::HashMap;
use std::fs::{File, read_dir};
use std::path::Path;
use std::sync::Arc;

/// Encapsulates all translations available to pubhubs.
pub struct AllTranslations {
    map: HashMap<String, Translations>,
}

/// Turns an iterator of [Translations] into an [AllTranslations].
impl std::iter::FromIterator<Translations> for AllTranslations {
    fn from_iter<T>(iter: T) -> AllTranslations
    where
        T: IntoIterator<Item = Translations>,
    {
        AllTranslations {
            map: iter
                .into_iter()
                .map(|t: Translations| -> (String, Translations) { (t.lang().to_string(), t) })
                .collect(),
        }
    }
}

impl AllTranslations {
    /// Extracts language part (if there is any) from given uri, and returns
    /// the translations associated to it.
    ///
    /// When no language part is found, `uri` is left unchanged, and
    /// [Translations::NONE] is returned.
    ///
    /// ```
    /// use pubhubs::translate::{AllTranslations, Translations};
    /// use std::collections::HashMap;
    ///
    /// let all : AllTranslations = [Translations::new("nl".to_owned(), HashMap::<String,String>::from([
    ///         ("something".to_owned(), "iets".to_owned()),
    ///     ]))
    /// ].into_iter().collect();
    ///
    /// let mut uri = http::Uri::from_static("/not-a-language/");
    /// assert!(all.extract_lang(&mut uri).is_none());
    /// assert_eq!(uri.to_string(), "/not-a-language/");
    ///
    /// uri = http::Uri::from_static("/?");
    /// assert!(all.extract_lang(&mut uri).is_none());
    /// assert_eq!(uri.to_string(), "/?");
    ///
    /// uri = http::Uri::from_static("https://example.com");
    /// assert!(all.extract_lang(&mut uri).is_none());
    /// assert_eq!(uri.to_string(), "https://example.com/");
    ///
    /// uri = http::Uri::from_static("https://example.com/nl?blaat");
    /// assert_eq!(all.extract_lang(&mut uri).lang(),"nl");
    /// assert_eq!(uri.to_string(), "https://example.com/?blaat");
    ///
    /// uri = http::Uri::from_static("/nl");
    /// assert_eq!(all.extract_lang(&mut uri).lang(),"nl");
    /// assert_eq!(uri.to_string(), "/");
    ///
    /// uri = http::Uri::from_static("https://example.com/nl/what?blaat");
    /// assert_eq!(all.extract_lang(&mut uri).lang(),"nl");
    /// assert_eq!(uri.to_string(), "https://example.com/what?blaat");
    /// ```
    pub fn extract_lang(&self, uri: &mut http::Uri) -> Translations {
        let path = uri.path();

        if path.is_empty() {
            return Translations::NONE;
        }

        if !path.starts_with('/') {
            // Ignoring this anomaly has no ill effects, while panicing would give
            // an unhelpful error.
            log::warn!("unexpected situation: request's path does not start with '/'");
            return Translations::NONE;
        }

        let path = &path[1..]; // remove leading '/'

        let slashpos = path.find('/');
        let maybe_lang = &path[..slashpos.unwrap_or(path.len())];

        let translations = self.for_lang(maybe_lang);

        if translations.is_none() {
            return translations;
        }

        // Remove language from uri
        let path = match slashpos {
            Some(slashpos) => &path[slashpos..],
            // ensure path always starts with a '/'
            None => "/",
        };

        // attach original query..
        let mut uri_parts = uri.clone().into_parts();
        uri_parts.path_and_query = Some(
            http::uri::PathAndQuery::from_maybe_shared(match uri.query() {
                Some(query) => bytes::Bytes::from(format!("{}?{}", path, query)),
                None => bytes::Bytes::copy_from_slice(path.as_bytes()),
            })
            .expect("expected removing language would not cause an invalid path-and-query"),
        );

        // and change uri
        *uri = http::uri::Uri::from_parts(uri_parts)
            .expect("expected removing language would not  cause an invalid uri");
        translations
    }

    /// Returns [Translations] for the given language.
    pub fn for_lang(&self, lang: impl AsRef<str>) -> Translations {
        self.map
            .get(lang.as_ref())
            .cloned()
            .unwrap_or(Translations::NONE)
    }

    pub fn load(dir: &Path) -> Result<Self> {
        let mut translations = HashMap::new();

        for entry in
            read_dir(dir).with_context(|| format!("error while reading {}", dir.display()))?
        {
            let entry = entry
                .with_context(|| format!("error while reading {}'s entries", dir.display()))?;

            let path = entry.path();

            // only interested in files ending with ".json"
            if path.is_dir()
                || !path
                    .to_str()
                    .ok_or_else(|| anyhow!("non utf-8 path"))?
                    .ends_with(".json")
            {
                continue;
            }
            let map: HashMap<String, String> = serde_json::from_reader(File::open(&path)?)
                .with_context(|| format!("Expected to deserialize {}", path.display()))?;

            let key = path
                .file_name()
                .expect("a non-directory dir entry to have a filename")
                .to_str()
                .ok_or_else(|| anyhow!("non utf-8 filename"))?
                .replace(".json", "");
            translations.insert(key.clone(), Translations::new(key, map));
        }
        Ok(AllTranslations { map: translations })
    }
}

#[cfg_attr(test, derive(PartialEq))]
#[derive(Debug)]
struct TranslationsInner {
    translations: HashMap<String, String>,
    prefix: String,
}

/// Cheaply clonable smart pointer to the set of translations for a specific language.
#[derive(Clone)]
pub struct Translations {
    // TODO: replace Arc by Rc
    inner: Option<Arc<TranslationsInner>>,
}

impl Translations {
    /// Use default translations
    pub const NONE: Self = Translations { inner: None };

    pub fn is_none(&self) -> bool {
        self.inner.is_none()
    }

    /// Create translations from language and hashmap.
    pub fn new(prefix: String, map: HashMap<String, String>) -> Self {
        Translations {
            inner: Some(Arc::new(TranslationsInner {
                translations: map,
                prefix,
            })),
        }
    }

    /// Get the language prefix like "/en".  Since the leading slash, "/", of "/en"
    /// is not stored in [Translations], returns an implementation of [core::fmt::Display] that
    /// prepends this "/".
    pub fn prefix(&self) -> Prefix {
        Prefix {
            without_leading_slash: self.lang(),
        }
    }

    /// Returns the language associated to this translations,
    /// which is "" when the translation is none.
    pub fn lang(&self) -> &str {
        match self.inner {
            Some(ref rc) => &rc.prefix,
            None => "",
        }
    }
}

/// Return type of [Translations::prefix] that implements [core::fmt::Display].
#[cfg_attr(test, derive(PartialEq))]
pub struct Prefix<'a> {
    without_leading_slash: &'a str,
}

impl core::fmt::Display for Prefix<'_> {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> Result<(), core::fmt::Error> {
        if self.without_leading_slash.is_empty() {
            return Ok(());
        }
        write!(f, "/{}", self.without_leading_slash)
    }
}

/// So translations may be used in hairy templates.
impl CustomFuncs for Translations {
    fn call<'b, 'c>(
        &'_ mut self,
        name: &'_ str,
        args: &'_ [DecodedValue<'b>],
        scope: &'_ mut MemoryScope<'c>,
    ) -> Result<DecodedValue<'b>, &'b str>
    where
        'c: 'b,
    {
        if name != "tr" {
            return Err("no custom functions defined except for 'tr'");
        }

        let key = match args.first() {
            Some(DecodedValue::String(key)) => {
                core::str::from_utf8(key).unwrap_or("_________NOT_A_KEY")
            }
            _ => return Err("No string key for translation given"),
        };

        let default = args.get(1);
        if default.is_none() {
            return Err("No default for translation given");
        };

        if let Some(ref rc) = self.inner {
            if let Some(translation) = rc.translations.get(key) {
                return Ok(DecodedValue::String(scope.copy_u8(translation.as_bytes())));
            }
        }

        Ok(default.unwrap().clone())
    }
}

/// Allows the use of [Translations] as actix extractor.
impl actix_web::FromRequest for Translations {
    type Error = std::convert::Infallible;
    type Future = std::future::Ready<Result<Self, Self::Error>>;

    fn from_request(req: &actix_web::HttpRequest, _: &mut actix_web::dev::Payload) -> Self::Future {
        std::future::ready(Ok(req
            .extensions()
            .get::<Translations>()
            .cloned()
            .unwrap_or(Translations::NONE)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use expry::ValueRef;
    use hairy::{hairy_compile_html, hairy_eval_html_custom};

    #[test]
    fn test_translations() {
        let mut map = HashMap::new();
        map.insert(String::from("key"), String::from("value"));
        let mut translations = Translations::new("en".to_string(), map);

        assert_eq!(translations.prefix().to_string(), "/en");

        let template = r#"{{=tr("key", "Not a value but the default")}}"#;

        let hair = hairy_compile_html(template, "main.tpl", None, 0).unwrap();
        let value = ValueRef::new();
        let result = String::from_utf8(
            hairy_eval_html_custom(hair.to_ref(), value, &mut translations).unwrap(),
        )
        .unwrap();

        assert_eq!("value", result);

        let result = String::from_utf8(
            hairy_eval_html_custom(hair.to_ref(), value, &mut Translations::NONE.clone()).unwrap(),
        )
        .unwrap();

        assert_eq!("Not a value but the default", result);
    }

    #[test]
    fn test_get_translations_parts() {
        let orig_trs = Translations::new(
            "en".to_string(),
            HashMap::from([("key".to_owned(), "value".to_owned())]),
        );
        let all_trs = AllTranslations {
            map: HashMap::from([("en".to_owned(), orig_trs.clone())]),
        };
        let trs = all_trs.for_lang("en");
        assert_eq!(trs.inner, orig_trs.inner);
        let trs = all_trs.for_lang("unknown");
        assert_eq!(trs.inner, None);
        assert_eq!(trs.prefix().to_string(), "");
    }
}
