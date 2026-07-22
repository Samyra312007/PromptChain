use anchor_lang::prelude::*;

#[account]
pub struct StakePosition {
    pub authority: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

impl StakePosition {
    pub const LEN: usize = 8 + 32 + 8 + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stake_position_len() {
        assert_eq!(StakePosition::LEN, 8 + 32 + 8 + 1);
    }
}
