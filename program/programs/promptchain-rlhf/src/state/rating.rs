use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct RlhfRating {
    pub session: Pubkey,
    pub rating_id: u64,
    pub rater: Pubkey,
    pub output_uri: String,
    pub rating_value: u8,
    pub criteria: String,
    pub submitted_ts: i64,
    pub reward_claimed: bool,
    pub bump: u8,
}

impl RlhfRating {
    pub const MAX_URI_LEN: usize = 200;
    pub const MAX_CRITERIA_LEN: usize = 100;
}
