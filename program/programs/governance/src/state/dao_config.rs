use anchor_lang::prelude::*;

pub const VOTING_PERIOD_SECS: i64 = 604_800;
pub const MIN_VOTING_POWER_TOKENS: u64 = 1_000_000_000;
pub const QUORUM_BP: u64 = 1000;
pub const PASS_THRESHOLD_BP: u64 = 5000;
pub const MAX_DESCRIPTION_LEN: usize = 500;
pub const MAX_URI_LEN: usize = 200;
pub const MAX_PROPOSALS: u64 = 100;

#[account]
pub struct DaoConfig {
    pub authority: Pubkey,
    pub voting_period_secs: i64,
    pub min_voting_power_tokens: u64,
    pub quorum_bp: u64,
    pub pass_threshold_bp: u64,
    pub proposal_count: u64,
    pub bump: u8,
}

impl DaoConfig {
    pub const LEN: usize = 8
        + 32
        + 8
        + 8
        + 8
        + 8
        + 8
        + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dao_config_len() {
        assert!(DaoConfig::LEN > 0);
    }
}
