use anchor_lang::prelude::*;

#[account]
pub struct RewardClaim {
    pub claimant: Pubkey,
    pub total_claimed: u64,
    pub last_claim_ts: i64,
    pub bump: u8,
}

impl RewardClaim {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reward_claim_len() {
        assert_eq!(RewardClaim::LEN, 8 + 32 + 8 + 8 + 1);
    }
}
