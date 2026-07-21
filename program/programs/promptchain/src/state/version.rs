use anchor_lang::prelude::*;

use super::prompt::MAX_CID_LENGTH;
use super::prompt::MAX_URI_LENGTH;

pub const MAX_CHANGELOG_LENGTH: usize = 500;

#[account]
pub struct PromptVersion {
    pub parent: Pubkey,
    pub version_number: u32,
    pub author: Pubkey,
    pub ipfs_cid: String,
    pub metadata_uri: String,
    pub changelog_uri: String,
    pub bump: u8,
}

impl PromptVersion {
    pub const LEN: usize = 8
        + 32
        + 4
        + 32
        + 4 + MAX_CID_LENGTH
        + 4 + MAX_URI_LENGTH
        + 4 + MAX_CHANGELOG_LENGTH
        + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_len() {
        assert!(PromptVersion::LEN > 0);
        assert_eq!(
            PromptVersion::LEN,
            8 + 32 + 4 + 32 + 4 + MAX_CID_LENGTH + 4 + MAX_URI_LENGTH + 4 + MAX_CHANGELOG_LENGTH + 1
        );
    }

    #[test]
    fn test_max_changelog_length() {
        assert_eq!(MAX_CHANGELOG_LENGTH, 500);
    }
}
