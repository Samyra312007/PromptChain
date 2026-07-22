use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::CurationError;
use crate::state::*;

#[derive(Accounts)]
pub struct InitCurator<'info> {
    #[account(
        init,
        seeds = [b"curator", authority.key().as_ref()],
        bump,
        payer = authority,
        space = Curator::LEN,
    )]
    pub curator: Account<'info, Curator>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_curator(ctx: Context<InitCurator>, stake_amount: u64) -> Result<()> {
    require!(stake_amount >= MIN_STAKE_LAMPORTS, CurationError::InsufficientStake);

    let curator = &mut ctx.accounts.curator;
    curator.authority = ctx.accounts.authority.key();
    curator.stake_amount = stake_amount;
    curator.total_ratings = 0;
    curator.accuracy_score_bp = 0;
    curator.last_rating_slot = 0;
    curator.bump = ctx.bumps.curator;

    if stake_amount > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ctx.accounts.curator.to_account_info(),
                },
            ),
            stake_amount,
        )?;
    }

    Ok(())
}
