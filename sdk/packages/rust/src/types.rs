use borsh::{BorshDeserialize, BorshSerialize};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize, PartialEq)]
pub struct Prompt {
    pub authority: [u8; 32],
    pub original_authority: [u8; 32],
    pub ipfs_cid: String,
    pub metadata_uri: String,
    pub license: [u8; 32],
    pub total_versions: u32,
    pub total_uses: u64,
    pub bump: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize, PartialEq)]
pub struct PromptVersion {
    pub parent: [u8; 32],
    pub version_number: u32,
    pub author: [u8; 32],
    pub ipfs_cid: String,
    pub metadata_uri: String,
    pub changelog_uri: String,
    pub bump: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize, PartialEq)]
pub struct License {
    pub authority: [u8; 32],
    pub name: String,
    pub commercial_allowed: bool,
    pub attribution_required: bool,
    pub royalty_basis_points: u16,
    pub bump: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptMetadata {
    pub name: String,
    pub description: String,
    pub prompt_text: String,
    pub target_model: Option<TargetModel>,
    pub benchmarks: Option<Vec<Benchmark>>,
    pub category: String,
    pub tags: Vec<String>,
    pub task_description: String,
    pub changelog: Option<String>,
    pub fork_of: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetModel {
    pub provider: String,
    pub model_id: String,
    pub version: Option<String>,
    pub parameters: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Benchmark {
    pub metric: String,
    pub score: f64,
    pub dataset: Option<String>,
    pub methodology: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishParams {
    pub cid: String,
    pub metadata_uri: String,
    pub license: Option<[u8; 32]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateVersionParams {
    pub prompt: [u8; 32],
    pub cid: String,
    pub metadata_uri: String,
    pub changelog_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetLicenseParams {
    pub name: String,
    pub commercial_allowed: bool,
    pub attribution_required: bool,
    pub royalty_basis_points: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferParams {
    pub prompt: [u8; 32],
    pub new_authority: [u8; 32],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsePromptParams {
    pub prompt: [u8; 32],
    pub license: Option<[u8; 32]>,
    pub license_authority: [u8; 32],
    pub max_royalty_payment: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitCuratorParams {
    pub stake_amount: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitRatingParams {
    pub curator: [u8; 32],
    pub prompt: [u8; 32],
    pub rating_value: u8,
    pub review_uri: String,
}

impl Prompt {
    pub const LEN: usize = 8 + 32 + 32 + 4 + 70 + 4 + 200 + 32 + 4 + 8 + 1;
}

impl License {
    pub const LEN: usize = 8 + 32 + 4 + 50 + 1 + 1 + 2 + 1;
}

impl PromptVersion {
    pub const LEN: usize = 8 + 32 + 4 + 32 + 4 + 70 + 4 + 200 + 4 + 200 + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prompt_len() {
        assert!(Prompt::LEN > 0);
    }

    #[test]
    fn test_license_len() {
        assert!(License::LEN > 0);
    }

    #[test]
    fn test_prompt_version_len() {
        assert!(PromptVersion::LEN > 0);
    }

    #[test]
    fn test_prompt_metadata_serialization() {
        let metadata = PromptMetadata {
            name: "Test Prompt".into(),
            description: "A test".into(),
            prompt_text: "Write code".into(),
            target_model: None,
            benchmarks: None,
            category: "code".into(),
            tags: vec!["rust".into()],
            task_description: "Write Rust".into(),
            changelog: None,
            fork_of: None,
            created_at: "2024-01-01".into(),
            updated_at: "2024-01-01".into(),
            language: "en".into(),
        };
        let json = serde_json::to_string(&metadata).unwrap();
        let deserialized: PromptMetadata = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "Test Prompt");
    }
}
