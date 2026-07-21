use anchor_lang::prelude::*;

use crate::errors::PromptChainError;
use crate::state::Prompt;

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(
        mut,
        seeds = [b"prompt", &crate::state::prompt::hash_cid(&prompt.ipfs_cid)[..]],
        bump = prompt.bump,
    )]
    pub prompt: Account<'info, Prompt>,
    pub current_authority: Signer<'info>,
}

pub fn handle_transfer(ctx: Context<Transfer>, new_authority: Pubkey) -> Result<()> {
    require!(
        ctx.accounts.current_authority.key() == ctx.accounts.prompt.authority,
        PromptChainError::Unauthorized,
    );
    require!(
        new_authority != ctx.accounts.prompt.authority,
        PromptChainError::SameAuthority,
    );

    let prompt = &mut ctx.accounts.prompt;
    prompt.authority = new_authority;

    Ok(())
}
