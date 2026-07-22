use anchor_lang::prelude::*;

use crate::state::PromptCuration;

#[derive(Accounts)]
pub struct RefreshCuration<'info> {
    #[account(
        mut,
        seeds = [b"prompt_curation", prompt.key().as_ref()],
        bump = prompt_curation.bump,
    )]
    pub prompt_curation: Account<'info, PromptCuration>,
    /// CHECK: The prompt account (read-only)
    pub prompt: AccountInfo<'info>,
}

pub fn handle_refresh_curation(ctx: Context<RefreshCuration>) -> Result<()> {
    let clock = Clock::get()?;
    let prompt_curation = &mut ctx.accounts.prompt_curation;

    prompt_curation.calculate_average();
    prompt_curation.last_updated_slot = clock.slot;

    Ok(())
}
