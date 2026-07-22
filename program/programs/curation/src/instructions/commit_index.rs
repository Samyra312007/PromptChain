use anchor_lang::prelude::*;

use crate::state::IndexCommitment;

#[derive(Accounts)]
#[instruction(epoch: u64)]
pub struct CommitIndex<'info> {
    #[account(
        init,
        seeds = [b"index_commitment", epoch.to_le_bytes().as_ref()],
        bump,
        payer = authority,
        space = IndexCommitment::LEN,
    )]
    pub index_commitment: Account<'info, IndexCommitment>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_commit_index(
    ctx: Context<CommitIndex>,
    epoch: u64,
    merkle_root: [u8; 32],
    num_documents: u64,
) -> Result<()> {
    let clock = Clock::get()?;
    let commitment = &mut ctx.accounts.index_commitment;

    commitment.epoch = epoch;
    commitment.merkle_root = merkle_root;
    commitment.num_documents = num_documents;
    commitment.last_committed_slot = clock.slot;
    commitment.bump = ctx.bumps.index_commitment;

    Ok(())
}
