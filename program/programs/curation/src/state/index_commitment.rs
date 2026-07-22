use anchor_lang::prelude::*;

#[account]
pub struct IndexCommitment {
    pub epoch: u64,
    pub merkle_root: [u8; 32],
    pub num_documents: u64,
    pub last_committed_slot: u64,
    pub bump: u8,
}

impl IndexCommitment {
    pub const LEN: usize = 8
        + 8
        + 32
        + 8
        + 8
        + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_index_commitment_len() {
        assert_eq!(IndexCommitment::LEN, 8 + 8 + 32 + 8 + 8 + 1);
    }
}
