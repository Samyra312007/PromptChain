use anchor_lang::prelude::*;

use crate::state::RlhfReward;
use crate::RlhfError;

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(
        mut,
        seeds = [
            b"rlhf_reward",
            &rater.key().to_bytes(),
            &session.to_account_info().key().to_bytes(),
        ],
        bump = reward.bump,
        has_one = rater,
    )]
    pub reward: Account<'info, RlhfReward>,

    /// CHECK: Session account, validated by seed derivation
    pub session: AccountInfo<'info>,

    #[account(mut)]
    pub rater: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimReward>) -> Result<()> {
    let reward = &mut ctx.accounts.reward;
    require!(
        reward.total_earned > reward.claimed_amount,
        RlhfError::NoRewardsToClaim
    );

    let claimable = reward.total_earned.saturating_sub(reward.claimed_amount);
    reward.claimed_amount = reward.claimed_amount.saturating_add(claimable);

    emit!(RewardClaimed {
        rater: reward.rater,
        session: reward.session,
        amount: claimable,
    });

    Ok(())
}

#[event]
pub struct RewardClaimed {
    pub rater: Pubkey,
    pub session: Pubkey,
    pub amount: u64,
}
