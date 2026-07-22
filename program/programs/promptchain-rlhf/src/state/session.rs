use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct RlhfSession {
    pub authority: Pubkey,
    pub session_id: u64,
    pub prompt_cid: String,
    pub model_name: String,
    pub max_preferences: u64,
    pub reward_per_preference: u64,
    pub total_preferences: u64,
    pub total_ratings: u64,
    pub total_reward_pool: u64,
    pub distributed_rewards: u64,
    pub is_active: bool,
    pub created_ts: i64,
    pub ended_ts: i64,
    pub bump: u8,
}

impl RlhfSession {
    pub const MAX_CID_LEN: usize = 70;
    pub const MAX_MODEL_NAME_LEN: usize = 50;
}
