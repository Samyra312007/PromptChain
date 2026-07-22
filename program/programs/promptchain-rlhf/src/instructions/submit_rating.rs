use anchor_lang::prelude::*;

use crate::state::{RlhfRating, RlhfSession};
use crate::RlhfError;

#[derive(Accounts)]
#[instruction(rating_id: u64)]
pub struct SubmitRating<'info> {
    #[account(
        mut,
        seeds = [b"rlhf_session", &session.session_id.to_le_bytes()],
        bump = session.bump,
    )]
    pub session: Account<'info, RlhfSession>,

    #[account(
        init,
        payer = rater,
        space = 8 + RlhfRating::INIT_SPACE,
        seeds = [
            b"rlhf_rating",
            &session.session_id.to_le_bytes(),
            &rating_id.to_le_bytes(),
        ],
        bump
    )]
    pub rating: Account<'info, RlhfRating>,

    #[account(mut)]
    pub rater: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubmitRating>,
    _rating_id: u64,
    output_uri: String,
    rating_value: u8,
    criteria: String,
) -> Result<()> {
    let session = &mut ctx.accounts.session;
    require!(session.is_active, RlhfError::SessionNotActive);
    require!(
        (1..=5).contains(&rating_value),
        RlhfError::InvalidRatingValue
    );
    require!(
        output_uri.len() <= RlhfRating::MAX_URI_LEN,
        RlhfError::ArithmeticOverflow
    );
    require!(
        criteria.len() <= RlhfRating::MAX_CRITERIA_LEN,
        RlhfError::ArithmeticOverflow
    );

    let rating = &mut ctx.accounts.rating;
    rating.session = session.key();
    rating.rater = ctx.accounts.rater.key();
    rating.output_uri = output_uri;
    rating.rating_value = rating_value;
    rating.criteria = criteria;
    rating.submitted_ts = Clock::get()?.unix_timestamp;
    rating.reward_claimed = false;
    rating.bump = ctx.bumps.rating;

    session.total_ratings = session
        .total_ratings
        .checked_add(1)
        .ok_or(RlhfError::ArithmeticOverflow)?;

    Ok(())
}
