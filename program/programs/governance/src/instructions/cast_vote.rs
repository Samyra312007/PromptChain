use anchor_lang::prelude::*;

use crate::errors::GovernanceError;
use crate::state::*;

#[derive(Accounts)]
pub struct CastVote<'info> {
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

    #[account(
        seeds = [b"member", voter.key().as_ref()],
        bump = member.bump,
    )]
    pub member: Account<'info, Member>,

    #[account(
        init,
        seeds = [b"vote", voter.key().as_ref(), proposal.key().as_ref()],
        bump,
        payer = voter,
        space = Vote::LEN,
    )]
    pub vote: Account<'info, Vote>,

    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_cast_vote(
    ctx: Context<CastVote>,
    vote_type: VoteType,
) -> Result<()> {
    let proposal_key = ctx.accounts.proposal.key();
    let status = &ctx.accounts.proposal.status;
    let voting_end_ts = ctx.accounts.proposal.voting_end_ts;
    let current_for = ctx.accounts.proposal.for_votes;
    let current_against = ctx.accounts.proposal.against_votes;
    let current_abstain = ctx.accounts.proposal.abstain_votes;

    require!(
        *status == ProposalStatus::Voting,
        GovernanceError::ProposalNotVoting,
    );

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    require!(now < voting_end_ts, GovernanceError::ProposalExpired);

    let member = &ctx.accounts.member;
    let voting_power = member
        .token_balance
        .checked_add(
            (member.token_balance as u128)
                .checked_mul(member.reputation_bp as u128)
                .ok_or(GovernanceError::ArithmeticOverflow)?
                .checked_div(10_000u128)
                .ok_or(GovernanceError::ArithmeticOverflow)? as u64,
        )
        .ok_or(GovernanceError::ArithmeticOverflow)?;

    require!(
        voting_power >= ctx.accounts.dao_config.min_voting_power_tokens,
        GovernanceError::InsufficientVotingPower,
    );

    let proposal = &mut ctx.accounts.proposal;
    let vote = &mut ctx.accounts.vote;
    vote.voter = ctx.accounts.voter.key();
    vote.proposal = proposal_key;
    vote.vote_type = vote_type.clone();
    vote.voting_power = voting_power;
    vote.token_weight = member.token_balance;
    vote.reputation_weight = member.reputation_bp;
    vote.bump = ctx.bumps.vote;

    match vote_type {
        VoteType::For => {
            proposal.for_votes = current_for
                .checked_add(voting_power)
                .ok_or(GovernanceError::ArithmeticOverflow)?;
        }
        VoteType::Against => {
            proposal.against_votes = current_against
                .checked_add(voting_power)
                .ok_or(GovernanceError::ArithmeticOverflow)?;
        }
        VoteType::Abstain => {
            proposal.abstain_votes = current_abstain
                .checked_add(voting_power)
                .ok_or(GovernanceError::ArithmeticOverflow)?;
        }
    }

    Ok(())
}
