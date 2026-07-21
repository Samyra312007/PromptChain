use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F");

#[program]
mod promptchain {
    use super::*;

    pub fn publish(
        ctx: Context<Publish>,
        cid: String,
        metadata_uri: String,
        license: Option<Pubkey>,
    ) -> Result<()> {
        instructions::publish::handle_publish(ctx, cid, metadata_uri, license)
    }

    pub fn create_version(
        ctx: Context<CreateVersion>,
        cid: String,
        metadata_uri: String,
        changelog_uri: String,
    ) -> Result<()> {
        instructions::create_version::handle_create_version(ctx, cid, metadata_uri, changelog_uri)
    }

    pub fn set_license(
        ctx: Context<SetLicense>,
        name: String,
        commercial_allowed: bool,
        attribution_required: bool,
        royalty_basis_points: u16,
    ) -> Result<()> {
        instructions::set_license::handle_set_license(
            ctx,
            name,
            commercial_allowed,
            attribution_required,
            royalty_basis_points,
        )
    }

    pub fn transfer(ctx: Context<Transfer>, new_authority: Pubkey) -> Result<()> {
        instructions::transfer::handle_transfer(ctx, new_authority)
    }

    pub fn use_prompt(ctx: Context<UsePrompt>, max_royalty_payment: u64) -> Result<()> {
        instructions::use_prompt::handle_use_prompt(ctx, max_royalty_payment)
    }
}
