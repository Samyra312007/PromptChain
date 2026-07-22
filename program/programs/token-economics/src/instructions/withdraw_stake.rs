use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::TokenError;
use crate::state::*;

#[derive(Accounts)]
pub struct WithdrawStake<'info> {
    #[account(
        mut,
        seeds = [b"stake_position", authority.key().as_ref()],
        bump = stake_position.bump,
    )]
    pub stake_position: Account<'info, StakePosition>,

    #[account(
        mut,
        seeds = [b"stake_vault"],
        bump,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"token_config"],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_withdraw_stake(ctx: Context<WithdrawStake>, amount: u64) -> Result<()> {
    require!(amount > 0, TokenError::ZeroAmount);

    let stake = &mut ctx.accounts.stake_position;
    require!(
        stake.amount >= amount,
        TokenError::InsufficientStakedAmount,
    );

    stake.amount = stake
        .amount
        .checked_sub(amount)
        .ok_or(TokenError::ArithmeticOverflow)?;

    let config_bump = ctx.accounts.token_config.bump;
    let seeds: &[&[u8]] = &[b"token_config", &[config_bump]];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.stake_vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.token_config.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    Ok(())
}
