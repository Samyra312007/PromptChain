use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("8mNqGqRJSkix3yCskAQBfTBhTyWMzYGMFmnfsEiyZnJU");

#[program]
pub mod promptchain_token_economics {
    use super::*;

    pub fn init_token_config(ctx: Context<InitTokenConfig>) -> Result<()> {
        instructions::init_token_config::handle_init_token_config(ctx)
    }

    pub fn claim_creator_reward(
        ctx: Context<ClaimCreatorReward>,
        amount: u64,
    ) -> Result<()> {
        instructions::claim_creator_reward::handle_claim_creator_reward(ctx, amount)
    }

    pub fn claim_curator_reward(
        ctx: Context<ClaimCuratorReward>,
        amount: u64,
    ) -> Result<()> {
        instructions::claim_curator_reward::handle_claim_curator_reward(ctx, amount)
    }

    pub fn stake_tokens(ctx: Context<StakeTokens>, amount: u64) -> Result<()> {
        instructions::stake_tokens::handle_stake_tokens(ctx, amount)
    }

    pub fn withdraw_stake(ctx: Context<WithdrawStake>, amount: u64) -> Result<()> {
        instructions::withdraw_stake::handle_withdraw_stake(ctx, amount)
    }

    pub fn init_vesting(
        ctx: Context<InitVesting>,
        total_amount: u64,
        start_ts: i64,
        cliff_duration_secs: i64,
        total_duration_secs: i64,
    ) -> Result<()> {
        instructions::init_vesting::handle_init_vesting(
            ctx,
            total_amount,
            start_ts,
            cliff_duration_secs,
            total_duration_secs,
        )
    }

    pub fn claim_vested(ctx: Context<ClaimVested>) -> Result<()> {
        instructions::claim_vested::handle_claim_vested(ctx)
    }
}
