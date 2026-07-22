use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::TokenError;
use crate::state::*;

#[derive(Accounts)]
pub struct ClaimVested<'info> {
    #[account(
        mut,
        seeds = [b"vesting", beneficiary.key().as_ref()],
        bump = vesting.bump,
    )]
    pub vesting: Account<'info, Vesting>,

    #[account(
        mut,
        seeds = [b"token_config"],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"stake_vault"],
        bump,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub beneficiary_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub beneficiary: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_claim_vested(ctx: Context<ClaimVested>) -> Result<()> {
    let vesting = &mut ctx.accounts.vesting;
    let current_ts = Clock::get()?.unix_timestamp;

    require!(
        current_ts >= vesting.start_ts.checked_add(vesting.cliff_duration_secs).ok_or(TokenError::ArithmeticOverflow)?,
        TokenError::VestingCliffNotReached,
    );

    let releasable = vesting
        .releasable_amount(current_ts)
        .ok_or(TokenError::ArithmeticOverflow)?;

    require!(releasable > 0, TokenError::InsufficientVestedAmount);

    let config_bump = ctx.accounts.token_config.bump;
    let seeds: &[&[u8]] = &[b"token_config", &[config_bump]];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.stake_vault.to_account_info(),
                to: ctx.accounts.beneficiary_token_account.to_account_info(),
                authority: ctx.accounts.token_config.to_account_info(),
            },
            signer_seeds,
        ),
        releasable,
    )?;

    vesting.released_amount = vesting
        .released_amount
        .checked_add(releasable)
        .ok_or(TokenError::ArithmeticOverflow)?;

    Ok(())
}
