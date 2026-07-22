use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct RlhfReward {
    pub rater: Pubkey,
    pub session: Pubkey,
    pub total_preferences: u64,
    pub total_ratings: u64,
    pub total_earned: u64,
    pub claimed_amount: u64,
    pub bump: u8,
}
