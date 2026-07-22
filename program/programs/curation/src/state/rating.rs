use anchor_lang::prelude::*;

pub const MIN_RATING: u8 = 1;
pub const MAX_RATING: u8 = 5;
pub const HALF_LIFE_SLOTS: u64 = 19_440_000;

#[account]
pub struct Rating {
    pub curator: Pubkey,
    pub prompt: Pubkey,
    pub rating_value: u8,
    pub review_uri: String,
    pub submitted_slot: u64,
    pub curator_stake_at_submission: u64,
    pub bump: u8,
}

impl Rating {
    pub const LEN: usize = 8
        + 32
        + 32
        + 1
        + 4 + super::curator::MAX_REVIEW_URI_LENGTH
        + 8
        + 8
        + 1;
}

impl Rating {
    pub fn decayed_weight(&self, current_slot: u64) -> u128 {
        let effective = self.effective_weight_at_submission();
        let elapsed = current_slot.saturating_sub(self.submitted_slot);
        let halvings = elapsed / HALF_LIFE_SLOTS;

        if halvings >= 64 {
            return 0;
        }

        let weight = (effective as u128)
            .checked_shr(halvings as u32)
            .unwrap_or(0);

        let remainder = elapsed % HALF_LIFE_SLOTS;
        if remainder > 0 && weight > 0 {
            let linear_decay = weight
                .checked_mul(HALF_LIFE_SLOTS.saturating_sub(remainder) as u128)
                .unwrap_or(0)
                .checked_div(HALF_LIFE_SLOTS as u128)
                .unwrap_or(0);
            return linear_decay;
        }

        weight
    }

    fn effective_weight_at_submission(&self) -> u64 {
        self.curator_stake_at_submission
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rating_len() {
        assert_eq!(Rating::LEN, 8 + 32 + 32 + 1 + 4 + 200 + 8 + 8 + 1);
    }

    #[test]
    fn test_rating_bounds() {
        assert_eq!(MIN_RATING, 1);
        assert_eq!(MAX_RATING, 5);
    }

    #[test]
    fn test_decayed_weight_no_decay() {
        let rating = Rating {
            curator: Pubkey::default(),
            prompt: Pubkey::default(),
            rating_value: 5,
            review_uri: String::new(),
            submitted_slot: 1000,
            curator_stake_at_submission: 1_000_000_000,
            bump: 0,
        };
        assert_eq!(rating.decayed_weight(1000), 1_000_000_000);
    }

    #[test]
    fn test_decayed_weight_partial() {
        let rating = Rating {
            curator: Pubkey::default(),
            prompt: Pubkey::default(),
            rating_value: 5,
            review_uri: String::new(),
            submitted_slot: 1000,
            curator_stake_at_submission: 1_000_000_000,
            bump: 0,
        };
        let weight = rating.decayed_weight(1000 + HALF_LIFE_SLOTS / 2);
        assert!(weight > 0);
        assert!(weight < 1_000_000_000);
    }
}
