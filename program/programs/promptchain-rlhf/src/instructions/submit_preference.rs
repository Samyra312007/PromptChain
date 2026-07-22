use anchor_lang::prelude::*;

use crate::state::{Preference, RlhfSession};
use crate::RlhfError;

#[derive(Accounts)]
#[instruction(preference_id: u64)]
pub struct SubmitPreference<'info> {
    #[account(
        mut,
        seeds = [b"rlhf_session", &session.session_id.to_le_bytes()],
        bump = session.bump,
    )]
    pub session: Account<'info, RlhfSession>,

    #[account(
        init,
        payer = rater,
        space = 8 + Preference::INIT_SPACE,
        seeds = [
            b"rlhf_preference",
            &session.session_id.to_le_bytes(),
            &preference_id.to_le_bytes(),
        ],
        bump
    )]
    pub preference: Account<'info, Preference>,

    #[account(
        init,
        payer = rater,
        seeds = [
            b"rlhf_reward",
            &rater.key().to_bytes(),
            &session.session_id.to_le_bytes(),
        ],
        bump,
        space = 8 + crate::state::RlhfReward::INIT_SPACE,
    )]
    pub reward: Option<Account<'info, crate::state::RlhfReward>>,

    #[account(mut)]
    pub rater: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubmitPreference>,
    preference_id: u64,
    preferred_output_uri: String,
    rejected_output_uri: String,
    criteria: String,
) -> Result<()> {
    let session = &mut ctx.accounts.session;
    require!(session.is_active, RlhfError::SessionNotActive);
    require!(
        session.total_preferences < session.max_preferences,
        RlhfError::MaxPreferencesReached
    );
    require!(
        preferred_output_uri.len() <= Preference::MAX_URI_LEN,
        RlhfError::ArithmeticOverflow
    );
    require!(
        rejected_output_uri.len() <= Preference::MAX_URI_LEN,
        RlhfError::ArithmeticOverflow
    );
    require!(
        criteria.len() <= Preference::MAX_CRITERIA_LEN,
        RlhfError::ArithmeticOverflow
    );

    let preference = &mut ctx.accounts.preference;
    preference.session = session.key();
    preference.preference_id = preference_id;
    preference.rater = ctx.accounts.rater.key();
    preference.preferred_output_uri = preferred_output_uri;
    preference.rejected_output_uri = rejected_output_uri;
    preference.criteria = criteria;
    preference.submitted_ts = Clock::get()?.unix_timestamp;
    preference.reward_claimed = false;
    preference.bump = ctx.bumps.preference;

    session.total_preferences = session
        .total_preferences
        .checked_add(1)
        .ok_or(RlhfError::ArithmeticOverflow)?;
    session.distributed_rewards = session
        .distributed_rewards
        .checked_add(session.reward_per_preference)
        .ok_or(RlhfError::ArithmeticOverflow)?;

    if let Some(reward) = &mut ctx.accounts.reward {
        reward.rater = ctx.accounts.rater.key();
        reward.session = session.key();
        reward.total_preferences = 1;
        reward.total_ratings = 0;
        reward.total_earned = session.reward_per_preference;
        reward.claimed_amount = 0;
        reward.bump = ctx.bumps.reward.unwrap_or(0);
    }

    Ok(())
}
