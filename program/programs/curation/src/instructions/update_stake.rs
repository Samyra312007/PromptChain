use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::CurationError;
use crate::state::*;

pub const WITHDRAWAL_COOLDOWN_SLOTS: u64 = 43_200;

#[derive(Accounts)]
pub struct UpdateStake<'info> {
    #[account(
        mut,
        seeds = [b"curator", authority.key().as_ref()],
        bump = curator.bump,
    )]
    pub curator: Account<'info, Curator>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_add_stake(ctx: Context<UpdateStake>, additional_stake: u64) -> Result<()> {
    require!(additional_stake > 0, CurationError::ZeroStake);

    let curator = &mut ctx.accounts.curator;

    curator.stake_amount = curator
        .stake_amount
        .checked_add(additional_stake)
        .ok_or(CurationError::ArithmeticOverflow)?;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.curator.to_account_info(),
            },
        ),
        additional_stake,
    )?;

    Ok(())
}

pub fn handle_withdraw_stake(ctx: Context<UpdateStake>, withdraw_amount: u64) -> Result<()> {
    require!(withdraw_amount > 0, CurationError::ZeroStake);

    let curator = &mut ctx.accounts.curator;

    require!(
        curator.stake_amount >= withdraw_amount,
        CurationError::InsufficientStakeToWithdraw,
    );

    let new_stake = curator
        .stake_amount
        .checked_sub(withdraw_amount)
        .ok_or(CurationError::ArithmeticOverflow)?;

    require!(
        new_stake >= MIN_STAKE_LAMPORTS || new_stake == 0,
        CurationError::InsufficientStake,
    );

    curator.stake_amount = new_stake;

    **curator.to_account_info().try_borrow_mut_lamports()? = curator
        .to_account_info()
        .lamports()
        .checked_sub(withdraw_amount)
        .ok_or(CurationError::ArithmeticOverflow)?;
    **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? = ctx
        .accounts
        .authority
        .to_account_info()
        .lamports()
        .checked_add(withdraw_amount)
        .ok_or(CurationError::ArithmeticOverflow)?;

    Ok(())
}
