use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VoteType {
    For,
    Against,
    Abstain,
}

#[account]
pub struct Vote {
    pub voter: Pubkey,
    pub proposal: Pubkey,
    pub vote_type: VoteType,
    pub voting_power: u64,
    pub token_weight: u64,
    pub reputation_weight: u64,
    pub bump: u8,
}

impl Vote {
    pub const LEN: usize = 8
        + 32
        + 32
        + 1
        + 8
        + 8
        + 8
        + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vote_len() {
        assert_eq!(Vote::LEN, 8 + 32 + 32 + 1 + 8 + 8 + 8 + 1);
    }
}
