use anchor_lang::prelude::*;

use crate::errors::PromptChainError;
use crate::state::*;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct SetLicense<'info> {
    #[account(
        init,
        seeds = [b"license", authority.key().as_ref(), name.as_bytes()],
        bump,
        payer = authority,
        space = License::LEN,
    )]
    pub license: Account<'info, License>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_set_license(
    ctx: Context<SetLicense>,
    name: String,
    commercial_allowed: bool,
    attribution_required: bool,
    royalty_basis_points: u16,
) -> Result<()> {
    require!(!name.is_empty(), PromptChainError::LicenseNameTooLong);
    require!(
        name.len() <= MAX_NAME_LENGTH,
        PromptChainError::LicenseNameTooLong,
    );
    require!(
        royalty_basis_points <= MAX_ROYALTY_BASIS_POINTS,
        PromptChainError::ArithmeticOverflow,
    );

    let license = &mut ctx.accounts.license;
    license.authority = ctx.accounts.authority.key();
    license.name = name;
    license.commercial_allowed = commercial_allowed;
    license.attribution_required = attribution_required;
    license.royalty_basis_points = royalty_basis_points;
    license.bump = ctx.bumps.license;

    Ok(())
}
