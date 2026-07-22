use anchor_lang::prelude::*;

use crate::errors::CurationError;
use crate::state::*;

#[derive(Accounts)]
#[instruction(rating_value: u8, review_uri: String)]
pub struct SubmitRating<'info> {
    #[account(
        mut,
        seeds = [b"curator", authority.key().as_ref()],
        bump = curator.bump,
    )]
    pub curator: Account<'info, Curator>,
    #[account(
        init,
        seeds = [b"rating", curator.key().as_ref(), prompt.key().as_ref()],
        bump,
        payer = authority,
        space = Rating::LEN,
    )]
    pub rating: Account<'info, Rating>,
    #[account(
        init_if_needed,
        seeds = [b"prompt_curation", prompt.key().as_ref()],
        bump,
        payer = authority,
        space = PromptCuration::LEN,
    )]
    pub prompt_curation: Account<'info, PromptCuration>,
    /// CHECK: The prompt account from the kernel program
    pub prompt: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_submit_rating(
    ctx: Context<SubmitRating>,
    rating_value: u8,
    review_uri: String,
) -> Result<()> {
    require!(
        rating_value >= MIN_RATING && rating_value <= MAX_RATING,
        CurationError::InvalidRatingValue,
    );
    require!(
        review_uri.len() <= MAX_REVIEW_URI_LENGTH,
        CurationError::ReviewUriTooLong,
    );

    let clock = Clock::get()?;
    let curator = &mut ctx.accounts.curator;
    let rating = &mut ctx.accounts.rating;

    rating.curator = curator.key();
    rating.prompt = ctx.accounts.prompt.key();
    rating.rating_value = rating_value;
    rating.review_uri = review_uri;
    rating.submitted_slot = clock.slot;
    rating.curator_stake_at_submission = curator.stake_amount;
    rating.bump = ctx.bumps.rating;

    let effective_weight = curator.effective_weight();
    let prompt_curation = &mut ctx.accounts.prompt_curation;

    if prompt_curation.prompt == Pubkey::default() {
        prompt_curation.prompt = ctx.accounts.prompt.key();
        prompt_curation.total_ratings = 0;
        prompt_curation.weighted_sum = 0;
        prompt_curation.total_weight = 0;
        prompt_curation.average_rating_bp = 0;
        prompt_curation.last_updated_slot = clock.slot;
        prompt_curation.bump = ctx.bumps.prompt_curation;
    }

    prompt_curation.weighted_sum = prompt_curation
        .weighted_sum
        .checked_add((effective_weight as u128).checked_mul(rating_value as u128).unwrap_or(0))
        .ok_or(CurationError::ArithmeticOverflow)?;
    prompt_curation.total_weight = prompt_curation
        .total_weight
        .checked_add(effective_weight as u128)
        .ok_or(CurationError::ArithmeticOverflow)?;
    prompt_curation.total_ratings = prompt_curation
        .total_ratings
        .checked_add(1)
        .ok_or(CurationError::ArithmeticOverflow)?;
    prompt_curation.last_updated_slot = clock.slot;
    prompt_curation.calculate_average();

    curator.total_ratings = curator
        .total_ratings
        .checked_add(1)
        .ok_or(CurationError::ArithmeticOverflow)?;
    curator.last_rating_slot = clock.slot;

    Ok(())
}
