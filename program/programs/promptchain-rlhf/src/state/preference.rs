use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Preference {
    pub session: Pubkey,
    pub preference_id: u64,
    pub rater: Pubkey,
    pub preferred_output_uri: String,
    pub rejected_output_uri: String,
    pub criteria: String,
    pub submitted_ts: i64,
    pub reward_claimed: bool,
    pub bump: u8,
}

impl Preference {
    pub const MAX_URI_LEN: usize = 200;
    pub const MAX_CRITERIA_LEN: usize = 100;
}
