use anchor_lang::prelude::*;

use crate::state::*;

#[derive(Accounts)]
pub struct InitReputation<'info> {
    #[account(
        init,
        seeds = [b"reputation", authority.key().as_ref()],
        bump,
        payer = authority,
        space = UserReputation::LEN,
    )]
    pub reputation: Account<'info, UserReputation>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_reputation(ctx: Context<InitReputation>) -> Result<()> {
    let reputation = &mut ctx.accounts.reputation;
    let clock = Clock::get()?;

    reputation.authority = ctx.accounts.authority.key();
    reputation.prompts_published = 0;
    reputation.total_rating_from_prompts_bp = 0;
    reputation.curations_performed = 0;
    reputation.curation_accuracy_bp = 0;
    reputation.consistency_bp = 0;
    reputation.overall_score_bp = 0;
    reputation.last_updated_slot = clock.slot;
    reputation.bump = ctx.bumps.reputation;

    Ok(())
}
