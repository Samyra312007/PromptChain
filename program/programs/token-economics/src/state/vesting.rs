use anchor_lang::prelude::*;

pub const CLIFF_DURATION_SECS: i64 = 31_536_000;
pub const VESTING_DURATION_SECS: i64 = 126_144_000;

#[account]
pub struct Vesting {
    pub beneficiary: Pubkey,
    pub total_amount: u64,
    pub released_amount: u64,
    pub start_ts: i64,
    pub cliff_duration_secs: i64,
    pub total_duration_secs: i64,
    pub bump: u8,
}

impl Vesting {
    pub const LEN: usize = 8
        + 32
        + 8
        + 8
        + 8
        + 8
        + 8
        + 1;

    pub fn releasable_amount(&self, current_ts: i64) -> Option<u64> {
        if current_ts < self.start_ts.checked_add(self.cliff_duration_secs)? {
            return Some(0);
        }
        let elapsed = current_ts.checked_sub(self.start_ts)?;
        let elapsed = std::cmp::min(elapsed, self.total_duration_secs);
        let vested = (self.total_amount as u128)
            .checked_mul(elapsed as u128)?
            .checked_div(self.total_duration_secs as u128)?;
        let released = self.released_amount as u128;
        let available = vested.checked_sub(released)?;
        Some(u64::try_from(available).ok()?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vesting_len() {
        assert!(Vesting::LEN > 0);
    }

    #[test]
    fn test_releasable_before_cliff() {
        let v = Vesting {
            beneficiary: Pubkey::default(),
            total_amount: 100_000_000,
            released_amount: 0,
            start_ts: 1000,
            cliff_duration_secs: 1000,
            total_duration_secs: 4000,
            bump: 255,
        };
        assert_eq!(v.releasable_amount(1500), Some(0));
    }

    #[test]
    fn test_releasable_at_cliff() {
        let v = Vesting {
            beneficiary: Pubkey::default(),
            total_amount: 100_000_000,
            released_amount: 0,
            start_ts: 0,
            cliff_duration_secs: 1000,
            total_duration_secs: 4000,
            bump: 255,
        };
        let amount = v.releasable_amount(1000).unwrap();
        assert!(amount == 25_000_000 || amount == 25_000_000);
    }

    #[test]
    fn test_releasable_partial_release() {
        let v = Vesting {
            beneficiary: Pubkey::default(),
            total_amount: 100_000_000,
            released_amount: 10_000_000,
            start_ts: 0,
            cliff_duration_secs: 0,
            total_duration_secs: 1000,
            bump: 255,
        };
        let amount = v.releasable_amount(500).unwrap();
        assert_eq!(amount, 40_000_000);
    }

    #[test]
    fn test_releasable_fully_vested() {
        let v = Vesting {
            beneficiary: Pubkey::default(),
            total_amount: 100_000_000,
            released_amount: 0,
            start_ts: 0,
            cliff_duration_secs: 0,
            total_duration_secs: 1000,
            bump: 255,
        };
        let amount = v.releasable_amount(2000).unwrap();
        assert_eq!(amount, 100_000_000);
    }

    #[test]
    fn test_releasable_all_released() {
        let v = Vesting {
            beneficiary: Pubkey::default(),
            total_amount: 100_000_000,
            released_amount: 100_000_000,
            start_ts: 0,
            cliff_duration_secs: 0,
            total_duration_secs: 1000,
            bump: 255,
        };
        assert_eq!(v.releasable_amount(2000), Some(0));
    }
}
