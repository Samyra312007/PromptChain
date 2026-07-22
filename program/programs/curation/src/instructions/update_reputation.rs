use anchor_lang::prelude::*;

use crate::state::*;

#[derive(Accounts)]
pub struct UpdateReputation<'info> {
    #[account(
        mut,
        seeds = [b"reputation", authority.key().as_ref()],
        bump = reputation.bump,
    )]
    pub reputation: Account<'info, UserReputation>,
    #[account(
        seeds = [b"curator", authority.key().as_ref()],
        bump = curator.bump,
    )]
    pub curator: Account<'info, Curator>,
    pub authority: Signer<'info>,
}

pub fn handle_update_reputation(
    ctx: Context<UpdateReputation>,
    prompts_published: u64,
    total_rating_from_prompts_bp: u64,
    curations_performed: u64,
    curation_accuracy_bp: u64,
    consistency_bp: u64,
) -> Result<()> {
    let reputation = &mut ctx.accounts.reputation;
    let clock = Clock::get()?;

    reputation.authority = ctx.accounts.authority.key();
    reputation.prompts_published = prompts_published;
    reputation.total_rating_from_prompts_bp = total_rating_from_prompts_bp;
    reputation.curations_performed = curations_performed;
    reputation.curation_accuracy_bp = curation_accuracy_bp;
    reputation.consistency_bp = consistency_bp;
    reputation.last_updated_slot = clock.slot;

    reputation.recalculate();

    Ok(())
}
