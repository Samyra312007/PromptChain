use anchor_lang::prelude::*;
use crate::state::translation::{Translation, MAX_LANG_LEN, MAX_METADATA_URI_LEN};
use crate::state::translator::Translator;
use crate::errors::TranslationDaoError;

#[derive(Accounts)]
#[instruction(prompt_pubkey: Pubkey, lang: String)]
pub struct RegisterTranslation<'info> {
    #[account(
        init,
        seeds = [b"translation", prompt_pubkey.as_ref(), lang.as_bytes()],
        bump,
        payer = authority,
        space = Translation::LEN,
    )]
    pub translation: Account<'info, Translation>,

    #[account(
        init_if_needed,
        seeds = [b"translator", authority.key().as_ref()],
        bump,
        payer = authority,
        space = Translator::LEN,
    )]
    pub translator: Account<'info, Translator>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterTranslation>,
    prompt_pubkey: Pubkey,
    lang: String,
    metadata_uri: String,
    original_lang: String,
) -> Result<()> {
    require!(lang.len() > 0 && lang.len() <= MAX_LANG_LEN, TranslationDaoError::LangTooLong);
    require!(metadata_uri.len() > 0 && metadata_uri.len() <= MAX_METADATA_URI_LEN, TranslationDaoError::MetadataUriTooLong);
    require!(lang != original_lang, TranslationDaoError::SameLanguage);

    let translation = &mut ctx.accounts.translation;
    translation.translator = ctx.accounts.authority.key();
    translation.prompt_pubkey = prompt_pubkey;
    translation.lang = lang;
    translation.metadata_uri = metadata_uri;
    translation.original_lang = original_lang;
    translation.verified = false;
    translation.rating_sum = 0;
    translation.rating_count = 0;
    translation.submitted_at = Clock::get()?.unix_timestamp;
    translation.verified_at = 0;

    let translator = &mut ctx.accounts.translator;
    translator.authority = ctx.accounts.authority.key();
    translator.total_translations = translator.total_translations.checked_add(1)
        .ok_or(TranslationDaoError::ArithmeticOverflow)?;

    Ok(())
}
