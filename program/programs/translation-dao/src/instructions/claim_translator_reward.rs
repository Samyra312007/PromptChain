use anchor_lang::prelude::*;
use crate::state::translator::Translator;
use crate::errors::TranslationDaoError;

#[derive(Accounts)]
pub struct ClaimTranslatorReward<'info> {
    #[account(
        mut,
        seeds = [b"translator", authority.key().as_ref()],
        bump = translator.bump,
    )]
    pub translator: Account<'info, Translator>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimTranslatorReward>) -> Result<()> {
    let translator = &mut ctx.accounts.translator;
    require!(translator.total_rewards > translator.claimed_rewards, TranslationDaoError::NoRewardsToClaim);

    let claimable = translator.total_rewards
        .checked_sub(translator.claimed_rewards)
        .ok_or(TranslationDaoError::ArithmeticOverflow)?;

    **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? = ctx
        .accounts
        .authority
        .to_account_info()
        .lamports()
        .checked_add(claimable)
        .ok_or(TranslationDaoError::ArithmeticOverflow)?;

    **translator.to_account_info().try_borrow_mut_lamports()? = translator
        .to_account_info()
        .lamports()
        .checked_sub(claimable)
        .ok_or(TranslationDaoError::ArithmeticOverflow)?;

    translator.claimed_rewards = translator.total_rewards;

    Ok(())
}
