use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::TokenError;
use crate::state::*;

#[derive(Accounts)]
pub struct ClaimCuratorReward<'info> {
    #[account(
        mut,
        seeds = [b"token_config"],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"curator_reward_pool"],
        bump,
    )]
    pub curator_reward_pool: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        seeds = [b"reward_claim_curator", curator.key().as_ref()],
        bump,
        payer = curator,
        space = RewardClaim::LEN,
    )]
    pub reward_claim: Account<'info, RewardClaim>,

    #[account(mut)]
    pub curator_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub curator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_claim_curator_reward(ctx: Context<ClaimCuratorReward>, amount: u64) -> Result<()> {
    require!(amount > 0, TokenError::ZeroAmount);

    let pool = &ctx.accounts.curator_reward_pool;
    require!(pool.amount >= amount, TokenError::RewardPoolExhausted);

    let config_bump = ctx.accounts.token_config.bump;
    let seeds: &[&[u8]] = &[b"token_config", &[config_bump]];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.curator_reward_pool.to_account_info(),
                to: ctx.accounts.curator_token_account.to_account_info(),
                authority: ctx.accounts.token_config.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    let claim = &mut ctx.accounts.reward_claim;
    claim.claimant = ctx.accounts.curator.key();
    claim.total_claimed = claim
        .total_claimed
        .checked_add(amount)
        .ok_or(TokenError::ArithmeticOverflow)?;
    claim.last_claim_ts = Clock::get()?.unix_timestamp;
    claim.bump = ctx.bumps.reward_claim;

    Ok(())
}
