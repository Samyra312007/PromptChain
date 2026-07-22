use anchor_lang::prelude::*;

#[error_code]
pub enum RlhfError {
    #[msg("Session is not active")]
    SessionNotActive,
    #[msg("Session has already ended")]
    SessionAlreadyEnded,
    #[msg("Maximum number of preferences reached")]
    MaxPreferencesReached,
    #[msg("Preference already exists")]
    PreferenceAlreadyExists,
    #[msg("Rating already exists")]
    RatingAlreadyExists,
    #[msg("Invalid rating value (must be 1-5)")]
    InvalidRatingValue,
    #[msg("Reward already claimed")]
    RewardAlreadyClaimed,
    #[msg("No rewards to claim")]
    NoRewardsToClaim,
    #[msg("Not authorized to finalize this session")]
    UnauthorizedFinalize,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
