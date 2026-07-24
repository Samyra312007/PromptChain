use anchor_lang::prelude::*;
use crate::state::translation::Translation;
use crate::state::translator::Translator;
use crate::errors::TranslationDaoError;

#[derive(Accounts)]
pub struct VerifyTranslation<'info> {
    #[account(
        mut,
        seeds = [b"translation", translation.prompt_pubkey.as_ref(), translation.lang.as_bytes()],
        bump = translation.bump,
    )]
    pub translation: Account<'info, Translation>,

    #[account(
        mut,
        seeds = [b"translator", translation.translator.as_ref()],
        bump,
    )]
    pub translator: Account<'info, Translator>,

    #[account(mut)]
    pub verifier: Signer<'info>,
}

pub fn handler(ctx: Context<VerifyTranslation>) -> Result<()> {
    let translation = &mut ctx.accounts.translation;
    require!(!translation.verified, TranslationDaoError::AlreadyVerified);

    translation.verified = true;
    translation.verified_at = Clock::get()?.unix_timestamp;

    let translator = &mut ctx.accounts.translator;
    translator.verified_translations = translator.verified_translations.checked_add(1)
        .ok_or(TranslationDaoError::ArithmeticOverflow)?;

    Ok(())
}
