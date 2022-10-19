use anyhow::{anyhow, Context, Result};
use expry::{CustomFuncs, DecodedValue, MemoryScope};
use std::collections::HashMap;
use std::fs::{read_dir, File};
use std::path::Path;

pub fn load_translations(dir: &Path) -> Result<HashMap<String, HashMap<String, String>>> {
    let mut translations = HashMap::new();

    for entry in read_dir(dir).with_context(|| format!("error while reading {}", dir.display()))? {
        let entry =
            entry.with_context(|| format!("error while reading {}'s entries", dir.display()))?;

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
        translations.insert(key, map);
    }
    Ok(translations)
}

/// Given the translations into all languages, and the parts of the uri's
/// path (excluding any empty first part), removes any initial language part
/// such as "en" from parts, and returns an associated [Translations] for
/// this language (which can be used in [hairy::hairy_eval_html_custom].)
pub fn get_translations<'a>(
    translations: &'a HashMap<String, HashMap<String, String>>,
    parts: &'a [&'a str],
) -> (&'a [&'a str], Translations<'a>) {
    if parts.is_empty() {
        return (parts, Translations::None);
    }

    let lang = parts[0];

    let translations = translations.get(lang);

    if translations.is_none() {
        return (parts, Translations::None);
    }

    (
        &parts[1..],
        Translations::Some {
            translations: translations.unwrap(),
            prefix: lang,
        },
    )
}

#[derive(Clone)]
pub enum Translations<'a> {
    Some {
        translations: &'a HashMap<String, String>,
        prefix: &'a str,
    },
    None,
}

impl<'a> Translations<'a> {
    /// Get the language prefix like "/en".  Since the leading slash, "/", of "/en"
    /// is not stored in [Translations], returns an implementation of [core::fmt::Display] that
    /// prepends this "/".
    pub fn get_prefix(&self) -> Prefix<'a> {
        Prefix {
            without_leading_slash: match *self {
                Translations::Some {
                    translations: _,
                    prefix,
                } => prefix,
                Translations::None => "",
            },
        }
    }
}

/// Return type of [Translations::get_prefix] that implements [core::fmt::Display].
pub struct Prefix<'a> {
    without_leading_slash: &'a str,
}

impl<'a> core::fmt::Display for Prefix<'a> {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> Result<(), core::fmt::Error> {
        if self.without_leading_slash.is_empty() {
            return Ok(());
        }
        write!(f, "/{}", self.without_leading_slash)
    }
}

impl<'a> CustomFuncs for Translations<'a> {
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

        let key = match args.get(0) {
            Some(DecodedValue::String(key)) => {
                core::str::from_utf8(key).unwrap_or("_________NOT_A_KEY")
            }
            _ => return Err("No string key for translation given"),
        };

        let default = args.get(1);
        if default.is_none() {
            return Err("No default for translation given");
        };

        if let Translations::Some {
            translations,
            prefix: _,
        } = self
        {
            if let Some(translation) = translations.get(key) {
                return Ok(DecodedValue::String(scope.copy_u8(translation.as_bytes())));
            }
        }

        Ok(default.unwrap().clone())
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
        let mut translations = Translations::Some {
            translations: &map,
            prefix: "en",
        };

        assert_eq!(translations.get_prefix().to_string(), "/en");

        let template = r#"{{=tr("key", "Not a value but the default")}}"#;

        let hair = hairy_compile_html(template, "main.tpl", None, 0).unwrap();
        let value = ValueRef::new();
        let result = String::from_utf8(
            hairy_eval_html_custom(hair.to_ref(), value, &mut translations).unwrap(),
        )
        .unwrap();

        assert_eq!("value", result);

        let result = String::from_utf8(
            hairy_eval_html_custom(hair.to_ref(), value, &mut Translations::None).unwrap(),
        )
        .unwrap();

        assert_eq!("Not a value but the default", result);
    }

    #[test]
    fn test_get_translations_parts() {
        let all_trs = HashMap::from([(
            "en".to_owned(),
            HashMap::from([("key".to_owned(), "value".to_owned())]),
        )]);
        let (parts, sp_trs) = get_translations(&all_trs, &["en", "some", "other"]);
        assert_eq!(parts, ["some", "other"]);
        assert_eq!(sp_trs.get_prefix().to_string(), "/en");
        let (parts, sp_trs) = get_translations(&all_trs, &["unknown", "some", "other"]);
        assert_eq!(parts, ["unknown", "some", "other"]);
        assert_eq!(sp_trs.get_prefix().to_string(), "");
    }
}
