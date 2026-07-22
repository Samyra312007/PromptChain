use anchor_lang::prelude::*;

use crate::state::*;
use crate::state::dao_config::*;

#[derive(Accounts)]
pub struct InitMember<'info> {
    #[account(
        seeds = [b"dao_config"],
        bump = dao_config.bump,
    )]
    pub dao_config: Account<'info, DaoConfig>,

    #[account(
        init,
        seeds = [b"member", authority.key().as_ref()],
        bump,
        payer = authority,
        space = Member::LEN,
    )]
    pub member: Account<'info, Member>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_init_member(
    ctx: Context<InitMember>,
    token_balance: u64,
    reputation_bp: u64,
) -> Result<()> {
    let member = &mut ctx.accounts.member;
    member.authority = ctx.accounts.authority.key();
    member.token_balance = token_balance;
    member.reputation_bp = reputation_bp;
    member.registered_ts = Clock::get()?.unix_timestamp;
    member.bump = ctx.bumps.member;

    Ok(())
}
