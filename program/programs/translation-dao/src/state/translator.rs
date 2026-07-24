use anchor_lang::prelude::*;

#[account]
pub struct Translator {
    pub authority: Pubkey,
    pub total_translations: u64,
    pub verified_translations: u64,
    pub reputation_bp: u64,
    pub total_rewards: u64,
    pub claimed_rewards: u64,
    pub bump: u8,
}

impl Translator {
    pub const LEN: usize = 8
        + 32
        + 8
        + 8
        + 8
        + 8
        + 8
        + 1;
}
