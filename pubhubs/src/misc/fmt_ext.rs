//! Tools for formatting

/// [std::fmt::Display] given type `T` by serializing it to json.
pub struct Json<T: serde::Serialize>(pub T);

impl<T: serde::Serialize> std::fmt::Display for Json<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            serde_json::to_string(&self.0).expect("failed to format")
        )
    }
}
