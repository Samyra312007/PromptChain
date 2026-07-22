use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProposalStatus {
    Voting,
    Passed,
    Executed,
    Cancelled,
    Expired,
}

#[account]
pub struct Proposal {
    pub proposer: Pubkey,
    pub dao_config: Pubkey,
    pub proposal_id: u64,
    pub description: String,
    pub uri: String,
    pub status: ProposalStatus,
    pub for_votes: u64,
    pub against_votes: u64,
    pub abstain_votes: u64,
    pub created_ts: i64,
    pub voting_end_ts: i64,
    pub executed_ts: i64,
    pub bump: u8,
}

impl Proposal {
    pub const BASE_LEN: usize = 8
        + 32
        + 32
        + 8
        + 4 + MAX_DESCRIPTION_LEN
        + 4 + MAX_URI_LEN
        + 1
        + 8
        + 8
        + 8
        + 8
        + 8
        + 1;
}

use crate::state::dao_config::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proposal_base_len() {
        assert!(Proposal::BASE_LEN > 0);
    }
}
