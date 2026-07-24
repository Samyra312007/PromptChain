use anchor_lang::prelude::*;
use crate::state::translator::Translator;
use crate::state::translation::Translation;

#[derive(Accounts)]
pub struct UpdateTranslatorReputation<'info> {
    #[account(
        mut,
        seeds = [b"translator", authority.key().as_ref()],
        bump = translator.bump,
    )]
    pub translator: Account<'info, Translator>,

    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateTranslatorReputation>) -> Result<()> {
    let translator = &mut ctx.accounts.translator;

    if translator.total_translations == 0 {
        translator.reputation_bp = 0;
        return Ok(());
    }

    let verified_ratio = translator.verified_translations
        .checked_mul(10_000)
        .and_then(|v| v.checked_div(translator.total_translations))
        .unwrap_or(0);

    translator.reputation_bp = verified_ratio as u64;

    Ok(())
}
