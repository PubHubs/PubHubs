//! Information about hubs

use crate::handle::{Handle, Handles};
use crate::id::Id;

/// Basic public details about hub, as provided by PubHubs Central.
#[derive(serde::Serialize, serde::Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct BasicInfo {
    /// The handles for this hub, using in URLs and other places to be understood by both human and
    /// machine. The first one is the one that's used by default.
    /// **WARNING:**  Handles may be added, but should not be removed.
    pub handles: Handles,

    /// Human-readable short name for this hub
    pub name: String,

    /// Short description for this hub.  This is stored centrally to facilitate searching.
    /// May be changed freely.
    pub description: String,

    /// Hub info endpoint
    /// May be changed freely.
    pub info_url: url::Url,

    /// Immutable and unique identifier
    pub id: Id,
}

impl crate::map::Handled for BasicInfo {
    fn handles(&self) -> &[Handle] {
        &self.handles
    }

    fn id(&self) -> &Id {
        &self.id
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basic_info_serde() {
        assert_eq!(
            serde_json::from_str::<BasicInfo>(
                r#"{"handles": [], "name": "Hub 1", "info_url": "https://example.com", "description": "some hub",
                "id": "bLAPDnkcYj8S5hZ8NuH9OFTWKzypLqSakexoRvlZ_aA"}"#,
            )
            .unwrap_err()
            .to_string(),
            "must have at least one handle at line 1 column 14",
        );
        assert_eq!(
            serde_json::from_str::<BasicInfo>(
                r#"{"handles": ["hub_1"], "name": "Hub 1", "info_url": "https://example.com", "description": "some hub", "id": "bLAPDnkcYj8S5hZ8NuH9OFTWKzypLqSakexoRvlZ_aA"}"#,
            )
            .unwrap(),
            BasicInfo{
                handles: vec!["hub_1".parse().unwrap()].into(),
                name: "Hub 1".to_string(),
                info_url: "https://example.com".parse().unwrap(),
                description: "some hub".to_string(),
                id: "bLAPDnkcYj8S5hZ8NuH9OFTWKzypLqSakexoRvlZ_aA".parse().unwrap(),
            }
        );
    }
}
