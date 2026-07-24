use anchor_lang::prelude::*;

declare_id!("8zYp2wQkLx7a3bCdEfGhIjKlMnOpQrStUvWxYz12345");

mod errors;
mod instructions;
mod state;

use errors::*;
use instructions::*;

#[program]
pub mod promptchain_translation_dao {
    use super::*;

    pub fn register_translation(
        ctx: Context<RegisterTranslation>,
        prompt_pubkey: Pubkey,
        lang: String,
        metadata_uri: String,
        original_lang: String,
    ) -> Result<()> {
        instructions::register_translation::handler(ctx, prompt_pubkey, lang, metadata_uri, original_lang)
    }

    pub fn verify_translation(
        ctx: Context<VerifyTranslation>,
    ) -> Result<()> {
        instructions::verify_translation::handler(ctx)
    }

    pub fn claim_translator_reward(
        ctx: Context<ClaimTranslatorReward>,
    ) -> Result<()> {
        instructions::claim_translator_reward::handler(ctx)
    }

    pub fn submit_translation_review(
        ctx: Context<SubmitTranslationReview>,
        rating: u8,
        review_uri: String,
    ) -> Result<()> {
        instructions::submit_translation_review::handler(ctx, rating, review_uri)
    }

    pub fn update_translator_reputation(
        ctx: Context<UpdateTranslatorReputation>,
    ) -> Result<()> {
        instructions::update_translator_reputation::handler(ctx)
    }
}
