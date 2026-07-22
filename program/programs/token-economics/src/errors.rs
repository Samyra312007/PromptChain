use anchor_lang::error_code;

#[error_code]
pub enum TokenError {
    #[msg("Already initialized")]
    AlreadyInitialized,
    #[msg("Not initialized")]
    NotInitialized,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Supply cap exceeded")]
    SupplyCapExceeded,
    #[msg("Invalid emission year")]
    InvalidEmissionYear,
    #[msg("Vesting schedule not found")]
    VestingNotFound,
    #[msg("Vesting cliff not reached")]
    VestingCliffNotReached,
    #[msg("Vesting fully released")]
    VestingFullyReleased,
    #[msg("Insufficient vested amount available")]
    InsufficientVestedAmount,
    #[msg("Stake position not found")]
    StakeNotFound,
    #[msg("Insufficient staked amount")]
    InsufficientStakedAmount,
    #[msg("Amount must be positive")]
    ZeroAmount,
    #[msg("Reward pool exhausted")]
    RewardPoolExhausted,
    #[msg("No rewards available to claim")]
    NoRewardsAvailable,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    #[msg("Mint authority error")]
    MintAuthorityError,
}
