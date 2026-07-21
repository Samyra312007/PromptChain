use anchor_lang::prelude::*;

use crate::errors::PromptChainError;
use crate::state::*;

#[derive(Accounts)]
#[instruction(cid: String, metadata_uri: String, changelog_uri: String)]
pub struct CreateVersion<'info> {
    #[account(
        mut,
        seeds = [b"prompt", &hash_cid(&prompt.ipfs_cid)[..]],
        bump = prompt.bump,
    )]
    pub prompt: Account<'info, Prompt>,
    #[account(
        init,
        seeds = [b"version", prompt.key().as_ref(), &prompt.total_versions.to_le_bytes()],
        bump,
        payer = authority,
        space = PromptVersion::LEN,
    )]
    pub version: Account<'info, PromptVersion>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_version(
    ctx: Context<CreateVersion>,
    cid: String,
    metadata_uri: String,
    changelog_uri: String,
) -> Result<()> {
    require!(!cid.is_empty(), PromptChainError::EmptyCid);
    require!(cid.len() <= MAX_CID_LENGTH, PromptChainError::CidTooLong);
    require!(!metadata_uri.is_empty(), PromptChainError::EmptyMetadataUri);
    require!(
        metadata_uri.len() <= MAX_URI_LENGTH,
        PromptChainError::MetadataUriTooLong,
    );
    require!(
        changelog_uri.len() <= MAX_CHANGELOG_LENGTH,
        PromptChainError::ChangelogUriTooLong,
    );

    let prompt = &mut ctx.accounts.prompt;
    require!(
        ctx.accounts.authority.key() == prompt.authority,
        PromptChainError::Unauthorized,
    );

    let version = &mut ctx.accounts.version;
    version.parent = prompt.key();
    version.version_number = prompt.total_versions;
    version.author = prompt.authority;
    version.ipfs_cid = cid;
    version.metadata_uri = metadata_uri;
    version.changelog_uri = changelog_uri;
    version.bump = ctx.bumps.version;

    prompt.total_versions = prompt
        .total_versions
        .checked_add(1)
        .ok_or(PromptChainError::ArithmeticOverflow)?;

    Ok(())
}
