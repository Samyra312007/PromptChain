use anchor_lang::prelude::*;

pub const MAX_NAME_LENGTH: usize = 50;
pub const MAX_ROYALTY_BASIS_POINTS: u16 = 10_000;

#[account]
pub struct License {
    pub authority: Pubkey,
    pub name: String,
    pub commercial_allowed: bool,
    pub attribution_required: bool,
    pub royalty_basis_points: u16,
    pub bump: u8,
}

impl License {
    pub const LEN: usize = 8
        + 32
        + 4 + MAX_NAME_LENGTH
        + 1
        + 1
        + 2
        + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_license_len() {
        assert!(License::LEN > 0);
        assert_eq!(License::LEN, 8 + 32 + 4 + MAX_NAME_LENGTH + 1 + 1 + 2 + 1);
    }

    #[test]
    fn test_max_name_length() {
        assert_eq!(MAX_NAME_LENGTH, 50);
    }

    #[test]
    fn test_max_royalty_basis_points() {
        assert_eq!(MAX_ROYALTY_BASIS_POINTS, 10_000);
    }
}
