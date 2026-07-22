use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::VoteType;

declare_id!("HvNzxKHRDNHMqeYRv5GPo2oV5fQABRPVLZMFMBE73tvu");

#[program]
pub mod promptchain_governance {
    use super::*;

    pub fn init_dao(
        ctx: Context<InitDao>,
        voting_period_secs: i64,
        min_voting_power_tokens: u64,
        quorum_bp: u64,
        pass_threshold_bp: u64,
    ) -> Result<()> {
        instructions::init_dao::handle_init_dao(
            ctx,
            voting_period_secs,
            min_voting_power_tokens,
            quorum_bp,
            pass_threshold_bp,
        )
    }

    pub fn init_member(
        ctx: Context<InitMember>,
        token_balance: u64,
        reputation_bp: u64,
    ) -> Result<()> {
        instructions::init_member::handle_init_member(ctx, token_balance, reputation_bp)
    }

    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        description: String,
        uri: String,
    ) -> Result<()> {
        instructions::create_proposal::handle_create_proposal(ctx, description, uri)
    }

    pub fn cast_vote(
        ctx: Context<CastVote>,
        vote_type: VoteType,
    ) -> Result<()> {
        instructions::cast_vote::handle_cast_vote(ctx, vote_type)
    }

    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        instructions::execute_proposal::handle_execute_proposal(ctx)
    }
}
