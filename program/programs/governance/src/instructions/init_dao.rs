use anchor_lang::prelude::*;

use crate::errors::GovernanceError;
use crate::state::*;

#[derive(Accounts)]
pub struct InitDao<'info> {
    #[account(
        init,
        seeds = [b"dao_config"],
        bump,
        payer = authority,
        space = DaoConfig::LEN,
    )]
    pub dao_config: Account<'info, DaoConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_init_dao(
    ctx: Context<InitDao>,
    voting_period_secs: i64,
    min_voting_power_tokens: u64,
    quorum_bp: u64,
    pass_threshold_bp: u64,
) -> Result<()> {
    require!(quorum_bp <= 10_000, GovernanceError::ArithmeticOverflow);
    require!(pass_threshold_bp <= 10_000, GovernanceError::ArithmeticOverflow);

    let config = &mut ctx.accounts.dao_config;
    config.authority = ctx.accounts.authority.key();
    config.voting_period_secs = voting_period_secs;
    config.min_voting_power_tokens = min_voting_power_tokens;
    config.quorum_bp = quorum_bp;
    config.pass_threshold_bp = pass_threshold_bp;
    config.proposal_count = 0;
    config.bump = ctx.bumps.dao_config;

    Ok(())
}
