use anchor_lang::prelude::*;

use crate::state::RlhfSession;
use crate::RlhfError;

#[derive(Accounts)]
pub struct FinalizeSession<'info> {
    #[account(
        mut,
        seeds = [b"rlhf_session", &session.session_id.to_le_bytes()],
        bump = session.bump,
        has_one = authority,
    )]
    pub session: Account<'info, RlhfSession>,

    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<FinalizeSession>) -> Result<()> {
    let session = &mut ctx.accounts.session;
    require!(session.is_active, RlhfError::SessionNotActive);

    session.is_active = false;
    session.ended_ts = Clock::get()?.unix_timestamp;

    emit!(SessionFinalized {
        session_id: session.session_id,
        prompt_cid: session.prompt_cid.clone(),
        total_preferences: session.total_preferences,
        total_ratings: session.total_ratings,
        total_rewards_distributed: session.distributed_rewards,
    });

    Ok(())
}

#[event]
pub struct SessionFinalized {
    pub session_id: u64,
    pub prompt_cid: String,
    pub total_preferences: u64,
    pub total_ratings: u64,
    pub total_rewards_distributed: u64,
}
