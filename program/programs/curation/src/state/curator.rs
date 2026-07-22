use anchor_lang::prelude::*;

pub const MIN_STAKE_LAMPORTS: u64 = 1_000_000_000; // 1 SOL
pub const SYBIL_THRESHOLD_RATINGS: u64 = 100;
pub const SYBIL_WEIGHT_PENALTY_BP: u64 = 1000; // 10x penalty = 1000 basis points (10%)
pub const MAX_REVIEW_URI_LENGTH: usize = 200;

#[account]
pub struct Curator {
    pub authority: Pubkey,
    pub stake_amount: u64,
    pub total_ratings: u64,
    pub accuracy_score_bp: u64,
    pub last_rating_slot: u64,
    pub bump: u8,
}

impl Curator {
    pub const LEN: usize = 8
        + 32
        + 8
        + 8
        + 8
        + 8
        + 1;
}

impl Curator {
    pub fn effective_weight(&self) -> u64 {
        if self.total_ratings < SYBIL_THRESHOLD_RATINGS {
            self.stake_amount
                .checked_mul(SYBIL_WEIGHT_PENALTY_BP)
                .unwrap_or(0)
                .checked_div(10_000)
                .unwrap_or(0)
        } else {
            self.stake_amount
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_curator_len() {
        assert_eq!(Curator::LEN, 8 + 32 + 8 + 8 + 8 + 8 + 1);
    }

    #[test]
    fn test_sybil_threshold() {
        assert_eq!(SYBIL_THRESHOLD_RATINGS, 100);
    }

    #[test]
    fn test_effective_weight_sybil() {
        let curator = Curator {
            authority: Pubkey::default(),
            stake_amount: 1_000_000_000,
            total_ratings: 10,
            accuracy_score_bp: 0,
            last_rating_slot: 0,
            bump: 0,
        };
        assert_eq!(curator.effective_weight(), 100_000_000);
    }

    #[test]
    fn test_effective_weight_established() {
        let curator = Curator {
            authority: Pubkey::default(),
            stake_amount: 1_000_000_000,
            total_ratings: 200,
            accuracy_score_bp: 0,
            last_rating_slot: 0,
            bump: 0,
        };
        assert_eq!(curator.effective_weight(), 1_000_000_000);
    }
}
