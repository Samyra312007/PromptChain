use anchor_lang::prelude::*;

use crate::errors::TokenError;
use crate::state::*;

#[derive(Accounts)]
pub struct InitVesting<'info> {
    #[account(
        init,
        seeds = [b"vesting", beneficiary.key().as_ref()],
        bump,
        payer = authority,
        space = Vesting::LEN,
    )]
    pub vesting: Account<'info, Vesting>,

    /// CHECK: Beneficiary receiving the vesting schedule
    pub beneficiary: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_init_vesting(
    ctx: Context<InitVesting>,
    total_amount: u64,
    start_ts: i64,
    cliff_duration_secs: i64,
    total_duration_secs: i64,
) -> Result<()> {
    require!(total_amount > 0, TokenError::ZeroAmount);
    require!(total_duration_secs > 0, TokenError::ArithmeticOverflow);

    let vesting = &mut ctx.accounts.vesting;
    vesting.beneficiary = ctx.accounts.beneficiary.key();
    vesting.total_amount = total_amount;
    vesting.released_amount = 0;
    vesting.start_ts = start_ts;
    vesting.cliff_duration_secs = cliff_duration_secs;
    vesting.total_duration_secs = total_duration_secs;
    vesting.bump = ctx.bumps.vesting;

    Ok(())
}
