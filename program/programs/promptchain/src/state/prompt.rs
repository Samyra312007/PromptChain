use anchor_lang::prelude::*;
use solana_sha256_hasher::hashv as sha256_hashv;

pub const MAX_CID_LENGTH: usize = 70;
pub const MAX_URI_LENGTH: usize = 200;

pub fn hash_cid(cid: &str) -> [u8; 32] {
    sha256_hashv(&[cid.as_bytes()]).to_bytes()
}

#[account]
pub struct Prompt {
    pub authority: Pubkey,
    pub original_authority: Pubkey,
    pub ipfs_cid: String,
    pub metadata_uri: String,
    pub license: Pubkey,
    pub total_versions: u32,
    pub total_uses: u64,
    pub bump: u8,
}

impl Prompt {
    pub const LEN: usize = 8
        + 32
        + 32
        + 4 + MAX_CID_LENGTH
        + 4 + MAX_URI_LENGTH
        + 32
        + 4
        + 8
        + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prompt_len() {
        assert!(Prompt::LEN > 0);
        assert_eq!(Prompt::LEN, 8 + 32 + 32 + 4 + MAX_CID_LENGTH + 4 + MAX_URI_LENGTH + 32 + 4 + 8 + 1);
    }

    #[test]
    fn test_max_cid_length() {
        assert_eq!(MAX_CID_LENGTH, 70);
    }

    #[test]
    fn test_max_uri_length() {
        assert_eq!(MAX_URI_LENGTH, 200);
    }

    #[test]
    fn test_hash_cid_returns_32_bytes() {
        let hash = hash_cid("QmTest123");
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_hash_cid_is_deterministic() {
        let a = hash_cid("QmTest123");
        let b = hash_cid("QmTest123");
        assert_eq!(a, b);
    }

    #[test]
    fn test_hash_cid_differs_for_different_inputs() {
        let a = hash_cid("QmTest123");
        let b = hash_cid("QmTest456");
        assert_ne!(a, b);
    }
}
