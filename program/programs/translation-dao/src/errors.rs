use anchor_lang::prelude::*;

#[error_code]
pub enum TranslationDaoError {
    #[msg("Language code exceeds maximum length of 10 bytes")]
    LangTooLong,
    #[msg("Language code cannot be empty")]
    EmptyLang,
    #[msg("Metadata URI exceeds maximum length of 200 bytes")]
    MetadataUriTooLong,
    #[msg("Metadata URI cannot be empty")]
    EmptyMetadataUri,
    #[msg("Original language cannot be same as translation language")]
    SameLanguage,
    #[msg("Unsupported language code")]
    UnsupportedLanguage,
    #[msg("Translation already exists for this prompt and language")]
    TranslationAlreadyExists,
    #[msg("Translation not found")]
    TranslationNotFound,
    #[msg("Translation already verified")]
    AlreadyVerified,
    #[msg("Rating must be between 1 and 5")]
    InvalidRating,
    #[msg("Review URI too long")]
    ReviewUriTooLong,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("No rewards to claim")]
    NoRewardsToClaim,
    #[msg("Reward already claimed for this period")]
    AlreadyClaimed,
}
