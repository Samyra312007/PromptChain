use anchor_lang::prelude::*;

pub const MAX_CID_LENGTH: usize = 70;
pub const MAX_URI_LENGTH: usize = 200;

#[account]
pub struct Prompt {
    pub authority: Pubkey,
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
        + 4 + MAX_CID_LENGTH
        + 4 + MAX_URI_LENGTH
        + 32
        + 4
        + 8
        + 1;
}
