use anchor_lang::prelude::*;

declare_id!("HWCLoMcpEYxCmR8VqztWF9YF7wYN7pjpKuZQPs5utrmT");

pub mod errors;
pub mod instructions;
pub mod state;

pub use errors::*;
pub use instructions::*;
pub use state::*;

#[program]
pub mod promptchain_rlhf {
    use super::*;

    pub fn init_session(
        ctx: Context<InitSession>,
        session_id: u64,
        prompt_cid: String,
        model_name: String,
        max_preferences: u64,
        reward_per_preference: u64,
    ) -> Result<()> {
        instructions::init_session::handler(
            ctx,
            session_id,
            prompt_cid,
            model_name,
            max_preferences,
            reward_per_preference,
        )
    }

    pub fn submit_preference(
        ctx: Context<SubmitPreference>,
        preference_id: u64,
        preferred_output_uri: String,
        rejected_output_uri: String,
        criteria: String,
    ) -> Result<()> {
        instructions::submit_preference::handler(
            ctx,
            preference_id,
            preferred_output_uri,
            rejected_output_uri,
            criteria,
        )
    }

    pub fn submit_rating(
        ctx: Context<SubmitRating>,
        rating_id: u64,
        output_uri: String,
        rating_value: u8,
        criteria: String,
    ) -> Result<()> {
        instructions::submit_rating::handler(ctx, rating_id, output_uri, rating_value, criteria)
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        instructions::claim_reward::handler(ctx)
    }

    pub fn finalize_session(ctx: Context<FinalizeSession>) -> Result<()> {
        instructions::finalize_session::handler(ctx)
    }
}
