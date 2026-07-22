use anchor_lang::prelude::*;

pub const MAX_REPUTATION_BP: u64 = 10_000;

#[account]
pub struct UserReputation {
    pub authority: Pubkey,
    pub prompts_published: u64,
    pub total_rating_from_prompts_bp: u64,
    pub curations_performed: u64,
    pub curation_accuracy_bp: u64,
    pub consistency_bp: u64,
    pub overall_score_bp: u64,
    pub last_updated_slot: u64,
    pub bump: u8,
}

impl UserReputation {
    pub const LEN: usize = 8
        + 32
        + 8
        + 8
        + 8
        + 8
        + 8
        + 8
        + 8
        + 1;
}

impl UserReputation {
    pub fn recalculate(&mut self) {
        let mut score: u64 = 0;
        let mut total_weight: u64 = 0;

        if self.prompts_published > 0 {
            let pub_score = self
                .total_rating_from_prompts_bp
                .checked_div(self.prompts_published.max(1))
                .unwrap_or(0);
            score = score
                .checked_add(pub_score.checked_mul(3).unwrap_or(0))
                .unwrap_or(0);
            total_weight = total_weight.checked_add(3).unwrap_or(0);
        }

        if self.curations_performed > 0 {
            score = score
                .checked_add(self.curation_accuracy_bp)
                .unwrap_or(0);
            total_weight = total_weight.checked_add(2).unwrap_or(0);
        }

        score = score.checked_add(self.consistency_bp).unwrap_or(0);
        total_weight = total_weight.checked_add(1).unwrap_or(0);

        if total_weight > 0 {
            self.overall_score_bp = score
                .checked_div(total_weight)
                .unwrap_or(0)
                .min(MAX_REPUTATION_BP);
        } else {
            self.overall_score_bp = 0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reputation_len() {
        assert_eq!(UserReputation::LEN, 8 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1);
    }

    #[test]
    fn test_recalculate_new_user() {
        let mut rep = UserReputation {
            authority: Pubkey::default(),
            prompts_published: 0,
            total_rating_from_prompts_bp: 0,
            curations_performed: 0,
            curation_accuracy_bp: 0,
            consistency_bp: 0,
            overall_score_bp: 0,
            last_updated_slot: 0,
            bump: 0,
        };
        rep.recalculate();
        assert_eq!(rep.overall_score_bp, 0);
    }

    #[test]
    fn test_recalculate_with_data() {
        let mut rep = UserReputation {
            authority: Pubkey::default(),
            prompts_published: 5,
            total_rating_from_prompts_bp: 25000,
            curations_performed: 10,
            curation_accuracy_bp: 8000,
            consistency_bp: 7000,
            overall_score_bp: 0,
            last_updated_slot: 0,
            bump: 0,
        };
        rep.recalculate();
        assert!(rep.overall_score_bp > 0);
        assert!(rep.overall_score_bp <= MAX_REPUTATION_BP);
    }
}
