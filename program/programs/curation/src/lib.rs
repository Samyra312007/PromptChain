use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("2eWqZR6HriWjKJs5MozSZKERxP98JM7FEwn8FA7Hh1cK");

#[program]
pub mod promptchain_curation {
    use super::*;

    pub fn init_curator(ctx: Context<InitCurator>, stake_amount: u64) -> Result<()> {
        instructions::init_curator::handle_init_curator(ctx, stake_amount)
    }

    pub fn init_reputation(ctx: Context<InitReputation>) -> Result<()> {
        instructions::init_reputation::handle_init_reputation(ctx)
    }

    pub fn submit_rating(
        ctx: Context<SubmitRating>,
        rating_value: u8,
        review_uri: String,
    ) -> Result<()> {
        instructions::submit_rating::handle_submit_rating(ctx, rating_value, review_uri)
    }

    pub fn add_stake(ctx: Context<UpdateStake>, additional_stake: u64) -> Result<()> {
        instructions::update_stake::handle_add_stake(ctx, additional_stake)
    }

    pub fn withdraw_stake(ctx: Context<UpdateStake>, withdraw_amount: u64) -> Result<()> {
        instructions::update_stake::handle_withdraw_stake(ctx, withdraw_amount)
    }

    pub fn resolve_slashing(
        ctx: Context<ResolveSlashing>,
        rating_value: u8,
        consensus_bp: u64,
    ) -> Result<()> {
        instructions::resolve_slashing::handle_resolve_slashing(ctx, rating_value, consensus_bp)
    }

    pub fn update_reputation(
        ctx: Context<UpdateReputation>,
        prompts_published: u64,
        total_rating_from_prompts_bp: u64,
        curations_performed: u64,
        curation_accuracy_bp: u64,
        consistency_bp: u64,
    ) -> Result<()> {
        instructions::update_reputation::handle_update_reputation(
            ctx,
            prompts_published,
            total_rating_from_prompts_bp,
            curations_performed,
            curation_accuracy_bp,
            consistency_bp,
        )
    }

    pub fn commit_index(
        ctx: Context<CommitIndex>,
        epoch: u64,
        merkle_root: [u8; 32],
        num_documents: u64,
    ) -> Result<()> {
        instructions::commit_index::handle_commit_index(ctx, epoch, merkle_root, num_documents)
    }

    pub fn refresh_curation(ctx: Context<RefreshCuration>) -> Result<()> {
        instructions::refresh_curation::handle_refresh_curation(ctx)
    }
}
