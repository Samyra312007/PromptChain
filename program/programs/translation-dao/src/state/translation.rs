use anchor_lang::prelude::*;

pub const MAX_LANG_LEN: usize = 10;
pub const MAX_METADATA_URI_LEN: usize = 200;
pub const MAX_REVIEW_URI_LEN: usize = 200;

#[account]
pub struct Translation {
    pub translator: Pubkey,
    pub prompt_pubkey: Pubkey,
    pub lang: String,
    pub metadata_uri: String,
    pub original_lang: String,
    pub verified: bool,
    pub rating_sum: u64,
    pub rating_count: u64,
    pub submitted_at: i64,
    pub verified_at: i64,
    pub bump: u8,
}

impl Translation {
    pub const LEN: usize = 8
        + 32
        + 32
        + 4 + MAX_LANG_LEN
        + 4 + MAX_METADATA_URI_LEN
        + 4 + MAX_LANG_LEN
        + 1
        + 8
        + 8
        + 8
        + 8
        + 1;
}
