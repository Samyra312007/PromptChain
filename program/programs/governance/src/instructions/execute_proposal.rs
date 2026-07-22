use anchor_lang::prelude::*;

use crate::errors::GovernanceError;
use crate::state::*;

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(
        seeds = [b"dao_config"],
        bump = dao_config.bump,
    )]
    pub dao_config: Account<'info, DaoConfig>,

    #[account(
        mut,
        seeds = [b"proposal", dao_config.key().as_ref(), &proposal.proposal_id.to_le_bytes()],
        bump = proposal.bump,
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(mut)]
    pub executor: Signer<'info>,
}

pub fn handle_execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;

    require!(
        proposal.status == ProposalStatus::Voting,
        GovernanceError::ProposalNotVoting,
    );

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    require!(now >= proposal.voting_end_ts, GovernanceError::VotingPeriodNotEnded);

    let total_votes = proposal
        .for_votes
        .checked_add(proposal.against_votes)
        .ok_or(GovernanceError::ArithmeticOverflow)?
        .checked_add(proposal.abstain_votes)
        .ok_or(GovernanceError::ArithmeticOverflow)?;

    let config = &ctx.accounts.dao_config;

    let quorum_votes = (config.min_voting_power_tokens as u128)
        .checked_mul(config.quorum_bp as u128)
        .ok_or(GovernanceError::ArithmeticOverflow)?
        .checked_div(10_000u128)
        .ok_or(GovernanceError::ArithmeticOverflow)? as u64;

    require!(total_votes >= quorum_votes, GovernanceError::QuorumNotReached);

    let for_pct = if total_votes > 0 {
        (proposal.for_votes as u128)
            .checked_mul(10_000u128)
            .ok_or(GovernanceError::ArithmeticOverflow)?
            .checked_div(total_votes as u128)
            .ok_or(GovernanceError::ArithmeticOverflow)?
    } else {
        0
    };

    if for_pct >= config.pass_threshold_bp as u128 {
        proposal.status = ProposalStatus::Passed;
        proposal.executed_ts = now;
    } else {
        return Err(GovernanceError::ProposalDidNotPass.into());
    }

    Ok(())
}
