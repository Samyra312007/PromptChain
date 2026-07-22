use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::TokenError;
use crate::state::*;

#[derive(Accounts)]
pub struct StakeTokens<'info> {
    #[account(
        init_if_needed,
        seeds = [b"stake_position", authority.key().as_ref()],
        bump,
        payer = authority,
        space = StakePosition::LEN,
    )]
    pub stake_position: Account<'info, StakePosition>,

    #[account(
        mut,
        seeds = [b"stake_vault"],
        bump,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_stake_tokens(ctx: Context<StakeTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, TokenError::ZeroAmount);

    require!(
        ctx.accounts.user_token_account.amount >= amount,
        TokenError::InsufficientStakedAmount,
    );

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.stake_vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
    )?;

    let stake = &mut ctx.accounts.stake_position;
    stake.authority = ctx.accounts.authority.key();
    stake.amount = stake
        .amount
        .checked_add(amount)
        .ok_or(TokenError::ArithmeticOverflow)?;
    stake.bump = ctx.bumps.stake_position;

    Ok(())
}
