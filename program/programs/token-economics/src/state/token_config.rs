use anchor_lang::prelude::*;

pub const TOKEN_DECIMALS: u8 = 9;
pub const CAP_TOKENS: u64 = 1_000_000_000;
pub const CAP_RAW: u64 = CAP_TOKENS * 10u64.pow(TOKEN_DECIMALS as u32);
pub const YEAR_1_SUPPLY_TOKENS: u64 = 100_000_000;
pub const YEAR_1_SUPPLY_RAW: u64 = YEAR_1_SUPPLY_TOKENS * 10u64.pow(TOKEN_DECIMALS as u32);
pub const EMISSION_PER_YEAR_TOKENS: u64 = 50_000_000;
pub const EMISSION_PER_YEAR_RAW: u64 =
    EMISSION_PER_YEAR_TOKENS * 10u64.pow(TOKEN_DECIMALS as u32);
pub const ECOSYSTEM_FUND_PCT: u64 = 40;
pub const CREATOR_REWARDS_PCT: u64 = 25;
pub const CURATOR_REWARDS_PCT: u64 = 15;
pub const CORE_CONTRIBUTORS_PCT: u64 = 10;
pub const PUBLIC_SALE_PCT: u64 = 10;
pub const YEAR_SECONDS: i64 = 31_536_000;

#[account]
pub struct TokenConfig {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub total_emitted: u64,
    pub current_emission_year: u64,
    pub last_emission_ts: i64,
    pub ecosystem_fund_token_account: Pubkey,
    pub creator_reward_pool_token_account: Pubkey,
    pub curator_reward_pool_token_account: Pubkey,
    pub bump: u8,
}

impl TokenConfig {
    pub const LEN: usize = 8
        + 32
        + 32
        + 8
        + 8
        + 8
        + 32
        + 32
        + 32
        + 1;
}
