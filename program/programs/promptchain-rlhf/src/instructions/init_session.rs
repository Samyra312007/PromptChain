use anchor_lang::prelude::*;

use crate::state::RlhfSession;
use crate::RlhfError;

#[derive(Accounts)]
#[instruction(session_id: u64)]
pub struct InitSession<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + RlhfSession::INIT_SPACE,
        seeds = [b"rlhf_session", &session_id.to_le_bytes()],
        bump
    )]
    pub session: Account<'info, RlhfSession>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitSession>,
    session_id: u64,
    prompt_cid: String,
    model_name: String,
    max_preferences: u64,
    reward_per_preference: u64,
) -> Result<()> {
    require!(
        prompt_cid.len() <= RlhfSession::MAX_CID_LEN,
        RlhfError::ArithmeticOverflow
    );
    require!(
        model_name.len() <= RlhfSession::MAX_MODEL_NAME_LEN,
        RlhfError::ArithmeticOverflow
    );

    let session = &mut ctx.accounts.session;
    session.authority = ctx.accounts.authority.key();
    session.session_id = session_id;
    session.prompt_cid = prompt_cid;
    session.model_name = model_name;
    session.max_preferences = max_preferences;
    session.reward_per_preference = reward_per_preference;
    session.total_preferences = 0;
    session.total_ratings = 0;
    session.total_reward_pool = max_preferences.saturating_mul(reward_per_preference);
    session.distributed_rewards = 0;
    session.is_active = true;
    session.created_ts = Clock::get()?.unix_timestamp;
    session.ended_ts = 0;
    session.bump = ctx.bumps.session;
    Ok(())
}
