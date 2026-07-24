use anchor_lang::prelude::*;
use crate::state::translation::{Translation, MAX_REVIEW_URI_LEN};
use crate::errors::TranslationDaoError;

#[derive(Accounts)]
pub struct SubmitTranslationReview<'info> {
    #[account(
        mut,
        seeds = [b"translation", translation.prompt_pubkey.as_ref(), translation.lang.as_bytes()],
        bump = translation.bump,
    )]
    pub translation: Account<'info, Translation>,

    #[account(mut)]
    pub reviewer: Signer<'info>,
}

pub fn handler(ctx: Context<SubmitTranslationReview>, rating: u8, review_uri: String) -> Result<()> {
    require!(rating >= 1 && rating <= 5, TranslationDaoError::InvalidRating);
    require!(review_uri.len() <= MAX_REVIEW_URI_LEN, TranslationDaoError::ReviewUriTooLong);

    let translation = &mut ctx.accounts.translation;
    translation.rating_sum = translation.rating_sum.checked_add(rating as u64)
        .ok_or(TranslationDaoError::ArithmeticOverflow)?;
    translation.rating_count = translation.rating_count.checked_add(1)
        .ok_or(TranslationDaoError::ArithmeticOverflow)?;

    Ok(())
}
