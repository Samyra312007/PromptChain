use anchor_lang::prelude::*;

#[account]
pub struct Member {
    pub authority: Pubkey,
    pub token_balance: u64,
    pub reputation_bp: u64,
    pub registered_ts: i64,
    pub bump: u8,
}

impl Member {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_member_len() {
        assert_eq!(Member::LEN, 8 + 32 + 8 + 8 + 8 + 1);
    }
}
