use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::errors::TokenError;
use crate::state::*;

#[derive(Accounts)]
pub struct InitTokenConfig<'info> {
    #[account(
        init,
        seeds = [b"token_config"],
        bump,
        payer = authority,
        space = TokenConfig::LEN,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        seeds = [b"token_mint"],
        bump,
        payer = authority,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = token_config,
        mint::freeze_authority = token_config,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        seeds = [b"ecosystem_fund"],
        bump,
        payer = authority,
        token::mint = mint,
        token::authority = token_config,
    )]
    pub ecosystem_fund: Account<'info, TokenAccount>,

    #[account(
        init,
        seeds = [b"creator_reward_pool"],
        bump,
        payer = authority,
        token::mint = mint,
        token::authority = token_config,
    )]
    pub creator_reward_pool: Account<'info, TokenAccount>,

    #[account(
        init,
        seeds = [b"curator_reward_pool"],
        bump,
        payer = authority,
        token::mint = mint,
        token::authority = token_config,
    )]
    pub curator_reward_pool: Account<'info, TokenAccount>,

    #[account(
        init,
        seeds = [b"stake_vault"],
        bump,
        payer = authority,
        token::mint = mint,
        token::authority = token_config,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_init_token_config(ctx: Context<InitTokenConfig>) -> Result<()> {
    let config_bump = ctx.bumps.token_config;
    let token_program = ctx.accounts.token_program.to_account_info();
    let mint = ctx.accounts.mint.to_account_info();
    let ecosystem_fund = ctx.accounts.ecosystem_fund.to_account_info();
    let creator_reward_pool = ctx.accounts.creator_reward_pool.to_account_info();
    let curator_reward_pool = ctx.accounts.curator_reward_pool.to_account_info();
    let token_config_info = ctx.accounts.token_config.to_account_info();

    let ecosystem_amount = YEAR_1_SUPPLY_RAW
        .checked_mul(ECOSYSTEM_FUND_PCT)
        .ok_or(TokenError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(TokenError::ArithmeticOverflow)?;

    let creator_amount = YEAR_1_SUPPLY_RAW
        .checked_mul(CREATOR_REWARDS_PCT)
        .ok_or(TokenError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(TokenError::ArithmeticOverflow)?;

    let curator_amount = YEAR_1_SUPPLY_RAW
        .checked_mul(CURATOR_REWARDS_PCT)
        .ok_or(TokenError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(TokenError::ArithmeticOverflow)?;

    let _contributor_amount = YEAR_1_SUPPLY_RAW
        .checked_mul(CORE_CONTRIBUTORS_PCT)
        .ok_or(TokenError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(TokenError::ArithmeticOverflow)?;

    let _public_sale_amount = YEAR_1_SUPPLY_RAW
        .checked_mul(PUBLIC_SALE_PCT)
        .ok_or(TokenError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(TokenError::ArithmeticOverflow)?;

    let seeds: &[&[u8]] = &[b"token_config", &[config_bump]];
    let signer_seeds = &[&seeds[..]];

    token::mint_to(
        CpiContext::new_with_signer(
            token_program.clone(),
            MintTo {
                mint: mint.clone(),
                to: ecosystem_fund,
                authority: token_config_info.clone(),
            },
            signer_seeds,
        ),
        ecosystem_amount,
    )?;

    token::mint_to(
        CpiContext::new_with_signer(
            token_program.clone(),
            MintTo {
                mint: mint.clone(),
                to: creator_reward_pool,
                authority: token_config_info.clone(),
            },
            signer_seeds,
        ),
        creator_amount,
    )?;

    token::mint_to(
        CpiContext::new_with_signer(
            token_program,
            MintTo {
                mint,
                to: curator_reward_pool,
                authority: token_config_info,
            },
            signer_seeds,
        ),
        curator_amount,
    )?;

    let config = &mut ctx.accounts.token_config;
    config.authority = ctx.accounts.authority.key();
    config.mint = ctx.accounts.mint.key();
    config.total_emitted = ecosystem_amount
        .checked_add(creator_amount)
        .ok_or(TokenError::ArithmeticOverflow)?
        .checked_add(curator_amount)
        .ok_or(TokenError::ArithmeticOverflow)?;
    config.current_emission_year = 1;
    config.last_emission_ts = Clock::get()?.unix_timestamp;
    config.ecosystem_fund_token_account = ctx.accounts.ecosystem_fund.key();
    config.creator_reward_pool_token_account = ctx.accounts.creator_reward_pool.key();
    config.curator_reward_pool_token_account = ctx.accounts.curator_reward_pool.key();
    config.bump = config_bump;

    Ok(())
}
