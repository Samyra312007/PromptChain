use anchor_lang::error_code;

#[error_code]
pub enum PromptChainError {
    #[msg("CID exceeds maximum length")]
    CidTooLong,
    #[msg("Metadata URI exceeds maximum length")]
    MetadataUriTooLong,
    #[msg("Changelog URI exceeds maximum length")]
    ChangelogUriTooLong,
    #[msg("License name exceeds maximum length")]
    LicenseNameTooLong,
    #[msg("The provided license account does not match the prompt's license")]
    LicenseMismatch,
    #[msg("Prompt authority signer is required")]
    Unauthorized,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    #[msg("License account not found or invalid")]
    InvalidLicense,
    #[msg("CID cannot be empty")]
    EmptyCid,
    #[msg("Metadata URI cannot be empty")]
    EmptyMetadataUri,
    #[msg("New authority must be different from current authority")]
    SameAuthority,
    #[msg("License name cannot be empty")]
    EmptyName,
    #[msg("Royalty basis points exceeds maximum allowed (10000)")]
    RoyaltyTooHigh,
}
