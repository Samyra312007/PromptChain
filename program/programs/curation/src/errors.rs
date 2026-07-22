use anchor_lang::error_code;

#[error_code]
pub enum CurationError {
    #[msg("Insufficient stake amount (minimum 1 SOL)")]
    InsufficientStake,
    #[msg("Rating value must be between 1 and 5")]
    InvalidRatingValue,
    #[msg("Review URI exceeds maximum length")]
    ReviewUriTooLong,
    #[msg("Curator not found")]
    CuratorNotFound,
    #[msg("Prompt curation not found")]
    PromptCurationNotFound,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    #[msg("Already rated this prompt")]
    AlreadyRated,
    #[msg("Insufficient stake to withdraw")]
    InsufficientStakeToWithdraw,
    #[msg("Curator must be a signer")]
    UnauthorizedCurator,
    #[msg("Stake amount must be positive")]
    ZeroStake,
    #[msg("Withdrawal cooldown not elapsed")]
    WithdrawalCooldown,
    #[msg("Reputation account not initialized")]
    ReputationNotFound,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("No ratings to resolve")]
    NoRatings,
    #[msg("Not enough curators for consensus")]
    InsufficientCurators,
}
