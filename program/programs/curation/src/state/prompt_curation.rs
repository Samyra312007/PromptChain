use anchor_lang::prelude::*;

pub const CONSENSUS_STDDEV_BP: u64 = 2000;

#[account]
pub struct PromptCuration {
    pub prompt: Pubkey,
    pub total_ratings: u64,
    pub weighted_sum: u128,
    pub total_weight: u128,
    pub average_rating_bp: u64,
    pub last_updated_slot: u64,
    pub bump: u8,
}

impl PromptCuration {
    pub const LEN: usize = 8
        + 32
        + 8
        + 16
        + 16
        + 8
        + 8
        + 1;
}

impl PromptCuration {
    pub fn calculate_average(&mut self) {
        if self.total_weight == 0 {
            self.average_rating_bp = 0;
            return;
        }
        let avg = self
            .weighted_sum
            .checked_mul(10_000u128)
            .unwrap_or(0)
            .checked_div(self.total_weight)
            .unwrap_or(0);
        self.average_rating_bp = avg as u64;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prompt_curation_len() {
        assert_eq!(PromptCuration::LEN, 8 + 32 + 8 + 16 + 16 + 8 + 8 + 1);
    }

    #[test]
    fn test_calculate_average() {
        let mut pc = PromptCuration {
            prompt: Pubkey::default(),
            total_ratings: 2,
            weighted_sum: 5u128,
            total_weight: 10u128,
            average_rating_bp: 0,
            last_updated_slot: 0,
            bump: 0,
        };
        pc.calculate_average();
        assert_eq!(pc.average_rating_bp, 5000);
    }

    #[test]
    fn test_calculate_average_zero_weight() {
        let mut pc = PromptCuration {
            prompt: Pubkey::default(),
            total_ratings: 0,
            weighted_sum: 0,
            total_weight: 0,
            average_rating_bp: 0,
            last_updated_slot: 0,
            bump: 0,
        };
        pc.calculate_average();
        assert_eq!(pc.average_rating_bp, 0);
    }
}
