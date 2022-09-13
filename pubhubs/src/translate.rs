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

pub(crate) fn get_translations<'a>(
    translations: &'a HashMap<String, HashMap<String, String>>,
    parts: Vec<&'a str>,
) -> (Vec<&'a str>, TranslateFuncs) {
    let (parts, translations, prefix) = match parts.get(1) {
        Some(&"en") => {
            let mut parts = parts.clone();
            parts.remove(0);
            (parts, translations.get("en"), "/en")
        }
        _ => (parts, None, ""), //Use default values
    };
    let translations = match translations {
        None => TranslateFuncs::default(),
        Some(a) => TranslateFuncs::new(a.clone(), prefix),
    };
    (parts, translations)
}

pub struct TranslateFuncs {
    translations: HashMap<String, String>,
    prefix: String,
}
impl TranslateFuncs {
    pub fn new(translations: HashMap<String, String>, prefix: &str) -> Self {
        Self {
            translations,
            prefix: String::from(prefix),
        }
    }

    pub fn get_prefix(&self) -> &str {
        &self.prefix
    }
}

impl Default for TranslateFuncs {
    fn default() -> Self {
        Self::new(HashMap::new(), "")
    }
}

impl CustomFuncs for TranslateFuncs {
    fn call<'b, 'c>(
        &'_ mut self,
        name: &'_ str,
        args: &'_ [DecodedValue<'b>],
        scope: &'_ mut MemoryScope<'c>,
    ) -> Result<DecodedValue<'b>, &'b str>
    where
        'c: 'b,
    {
        if name == "tr" {
            let key = match args.get(0) {
                Some(DecodedValue::String(key)) => {
                    core::str::from_utf8(key).unwrap_or("_________NOT_A_KEY")
                }
                _ => return Err("No string key for translation given"),
            };

            let default = match args.get(1) {
                None => return Err("No default for translation given"),
                Some(default) => default.clone(),
            };

            match self.translations.get(key) {
                None => Ok(default),
                Some(translation) => {
                    Ok(DecodedValue::String(scope.copy_u8(translation.as_bytes())))
                }
            }
        } else {
            Err("no custom functions defined except for 'tr'")
        }
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
        let mut translations = TranslateFuncs::new(map, "/en");

        let template = r#"{{=tr("key", "Not a value but the default")}}"#;

        let hair = hairy_compile_html(template, "main.tpl", None, 0).unwrap();
        let value = ValueRef::new();
        let result = String::from_utf8(
            hairy_eval_html_custom(hair.to_ref(), value, &mut translations).unwrap(),
        )
        .unwrap();

        assert_eq!("value", result);

        let result = String::from_utf8(
            hairy_eval_html_custom(hair.to_ref(), value, &mut TranslateFuncs::default()).unwrap(),
        )
        .unwrap();

        assert_eq!("Not a value but the default", result);
    }
}
