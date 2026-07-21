use anchor_lang::prelude::*;

use crate::errors::PromptChainError;
use crate::state::*;

#[derive(Accounts)]
#[instruction(cid: String, metadata_uri: String)]
pub struct Publish<'info> {
    #[account(
        init,
        seeds = [b"prompt", &hash_cid(&cid)[..]],
        bump,
        payer = authority,
        space = Prompt::LEN,
    )]
    pub prompt: Account<'info, Prompt>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_publish(
    ctx: Context<Publish>,
    cid: String,
    metadata_uri: String,
    license: Option<Pubkey>,
) -> Result<()> {
    require!(!cid.is_empty(), PromptChainError::EmptyCid);
    require!(cid.len() <= MAX_CID_LENGTH, PromptChainError::CidTooLong);
    require!(!metadata_uri.is_empty(), PromptChainError::EmptyMetadataUri);
    require!(
        metadata_uri.len() <= MAX_URI_LENGTH,
        PromptChainError::MetadataUriTooLong,
    );

    let prompt = &mut ctx.accounts.prompt;
    prompt.authority = ctx.accounts.authority.key();
    prompt.original_authority = ctx.accounts.authority.key();
    prompt.ipfs_cid = cid;
    prompt.metadata_uri = metadata_uri;
    prompt.license = license.unwrap_or(Pubkey::default());
    prompt.total_versions = 1;
    prompt.total_uses = 0;
    prompt.bump = ctx.bumps.prompt;

    Ok(())
}
