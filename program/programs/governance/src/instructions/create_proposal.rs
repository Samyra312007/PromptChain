use anchor_lang::prelude::*;

use crate::errors::GovernanceError;
use crate::state::*;
use crate::state::dao_config::*;

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(
        mut,
        seeds = [b"dao_config"],
        bump = dao_config.bump,
    )]
    pub dao_config: Account<'info, DaoConfig>,

    #[account(
        seeds = [b"member", proposer.key().as_ref()],
        bump = member.bump,
    )]
    pub member: Account<'info, Member>,

    #[account(
        init,
        seeds = [b"proposal", dao_config.key().as_ref(), &dao_config.proposal_count.to_le_bytes()],
        bump,
        payer = proposer,
        space = Proposal::BASE_LEN,
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(mut)]
    pub proposer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_create_proposal(
    ctx: Context<CreateProposal>,
    description: String,
    uri: String,
) -> Result<()> {
    require!(
        description.len() <= MAX_DESCRIPTION_LEN,
        GovernanceError::DescriptionTooLong,
    );
    require!(uri.len() <= MAX_URI_LEN, GovernanceError::UriTooLong);

    let config_key = ctx.accounts.dao_config.key();
    let config = &mut ctx.accounts.dao_config;
    let proposal_id = config.proposal_count;

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    let voting_end = now
        .checked_add(config.voting_period_secs)
        .ok_or(GovernanceError::ArithmeticOverflow)?;

    let proposal = &mut ctx.accounts.proposal;
    proposal.proposer = ctx.accounts.proposer.key();
    proposal.dao_config = config_key;
    proposal.proposal_id = proposal_id;
    proposal.description = description;
    proposal.uri = uri;
    proposal.status = ProposalStatus::Voting;
    proposal.for_votes = 0;
    proposal.against_votes = 0;
    proposal.abstain_votes = 0;
    proposal.created_ts = now;
    proposal.voting_end_ts = voting_end;
    proposal.executed_ts = 0;
    proposal.bump = ctx.bumps.proposal;

    config.proposal_count = config
        .proposal_count
        .checked_add(1)
        .ok_or(GovernanceError::ArithmeticOverflow)?;

    Ok(())
}
