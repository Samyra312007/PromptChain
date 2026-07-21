use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::PromptChainError;
use crate::state::*;

#[derive(Accounts)]
pub struct UsePrompt<'info> {
    #[account(
        mut,
        seeds = [b"prompt", &hash_cid(&prompt.ipfs_cid)[..]],
        bump = prompt.bump,
    )]
    pub prompt: Account<'info, Prompt>,
    /// CHECK: Validated in handle_use_prompt based on prompt.license field
    pub license: Option<Account<'info, License>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Verified as matching license.authority when license is set
    #[account(mut)]
    pub license_authority: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_use_prompt(ctx: Context<UsePrompt>, max_royalty_payment: u64) -> Result<()> {
    let prompt = &mut ctx.accounts.prompt;

    if prompt.license != Pubkey::default() {
        let license = ctx
            .accounts
            .license
            .as_ref()
            .ok_or(PromptChainError::InvalidLicense)?;

        require!(
            license.key() == prompt.license,
            PromptChainError::LicenseMismatch,
        );
        require!(
            ctx.accounts.license_authority.key() == license.authority,
            PromptChainError::InvalidLicense,
        );

        if license.royalty_basis_points > 0 && max_royalty_payment > 0 {
            let royalty_amount = (max_royalty_payment as u128)
                .checked_mul(license.royalty_basis_points as u128)
                .ok_or(PromptChainError::ArithmeticOverflow)?
                .checked_div(10_000u128)
                .ok_or(PromptChainError::ArithmeticOverflow)?;

            let royalty_lamports = u64::try_from(royalty_amount)
                .map_err(|_| PromptChainError::ArithmeticOverflow)?;

            if royalty_lamports > 0 {
                system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: ctx.accounts.payer.to_account_info(),
                            to: ctx.accounts.license_authority.to_account_info(),
                        },
                    ),
                    royalty_lamports,
                )?;
            }
        }
    }

    prompt.total_uses = prompt
        .total_uses
        .checked_add(1)
        .ok_or(PromptChainError::ArithmeticOverflow)?;

    Ok(())
}
