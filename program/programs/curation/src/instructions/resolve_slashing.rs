use anchor_lang::prelude::*;

use crate::errors::CurationError;
use crate::state::*;

#[derive(Accounts)]
pub struct ResolveSlashing<'info> {
    #[account(
        mut,
        seeds = [b"curator", slashed_authority.key().as_ref()],
        bump = curator.bump,
    )]
    pub curator: Account<'info, Curator>,
    #[account(
        mut,
        seeds = [b"prompt_curation", prompt.key().as_ref()],
        bump = prompt_curation.bump,
    )]
    pub prompt_curation: Account<'info, PromptCuration>,
    /// CHECK: The prompt account (read-only, from kernel)
    pub prompt: AccountInfo<'info>,
    /// CHECK: The slashed curator's authority
    pub slashed_authority: AccountInfo<'info>,
    /// CHECK: The accurate curator receiving rewards
    #[account(mut)]
    pub accurate_curator: AccountInfo<'info>,
    #[account(mut)]
    pub resolver: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_resolve_slashing(ctx: Context<ResolveSlashing>, rating_value: u8, consensus_bp: u64) -> Result<()> {
    let curator = &mut ctx.accounts.curator;
    let prompt_curation = &ctx.accounts.prompt_curation;

    require!(curator.stake_amount > 0, CurationError::InsufficientStake);
    require!(prompt_curation.average_rating_bp > 0, CurationError::NoRatings);

    let rating_bp = (rating_value as u64).checked_mul(2000).unwrap_or(0);
    let deviation = if rating_bp > consensus_bp {
        rating_bp.checked_sub(consensus_bp).unwrap_or(0)
    } else {
        consensus_bp.checked_sub(rating_bp).unwrap_or(0)
    };

    if deviation <= CONSENSUS_STDDEV_BP {
        return Ok(());
    }

    let slash_amount = curator.stake_amount.checked_div(2).unwrap_or(0);
    let burn_amount = slash_amount.checked_div(2).unwrap_or(0);
    let reward_amount = slash_amount.checked_sub(burn_amount).unwrap_or(0);

    curator.stake_amount = curator
        .stake_amount
        .checked_sub(slash_amount)
        .ok_or(CurationError::ArithmeticOverflow)?;

    let curator_lamports = curator.to_account_info().lamports();
    **curator.to_account_info().try_borrow_mut_lamports()? = curator_lamports
        .checked_sub(slash_amount)
        .ok_or(CurationError::ArithmeticOverflow)?;

    **ctx.accounts.accurate_curator.to_account_info().try_borrow_mut_lamports()? = ctx
        .accounts
        .accurate_curator
        .to_account_info()
        .lamports()
        .checked_add(reward_amount)
        .ok_or(CurationError::ArithmeticOverflow)?;

    Ok(())
}
