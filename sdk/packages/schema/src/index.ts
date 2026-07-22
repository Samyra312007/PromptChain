export const PROMPTCHAIN_PROGRAM_ID = "D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F";

export const CURATION_PROGRAM_ID = "2eWqZR6HriWjKJs5MozSZKERxP98JM7FEwn8FA7Hh1cK";

export const TOKEN_ECONOMICS_PROGRAM_ID = "8mNqGqRJSkix3yCskAQBfTBhTyWMzYGMFmnfsEiyZnJU";

export const GOVERNANCE_PROGRAM_ID = "HvNzxKHRDNHMqeYRv5GPo2oV5fQABRPVLZMFMBE73tvu";

export interface PromptMetadata {
  name: string;
  description: string;
  prompt_text: string;
  target_model?: {
    provider: "openai" | "anthropic" | "google" | "meta" | "mistral" | "other";
    model_id: string;
    version?: string;
    parameters?: Record<string, string>;
  };
  benchmarks?: Array<{
    metric: string;
    score: number;
    dataset?: string;
    methodology?: string;
  }>;
  category: string;
  tags: string[];
  task_description: string;
  changelog?: string;
  fork_of?: string;
  created_at: string;
  updated_at: string;
  language: string;
}

export const PDA_SEEDS = {
  PROMPT: Buffer.from("prompt"),
  VERSION: Buffer.from("version"),
  LICENSE: Buffer.from("license"),
  CURATOR: Buffer.from("curator"),
  RATING: Buffer.from("rating"),
  PROMPT_CURATION: Buffer.from("prompt_curation"),
  REPUTATION: Buffer.from("reputation"),
  INDEX_COMMITMENT: Buffer.from("index_commitment"),
  TOKEN_CONFIG: Buffer.from("token_config"),
  TOKEN_MINT: Buffer.from("token_mint"),
  ECOSYSTEM_FUND: Buffer.from("ecosystem_fund"),
  CREATOR_REWARD_POOL: Buffer.from("creator_reward_pool"),
  CURATOR_REWARD_POOL: Buffer.from("curator_reward_pool"),
  STAKE_POSITION: Buffer.from("stake_position"),
  STAKE_VAULT: Buffer.from("stake_vault"),
  VESTING: Buffer.from("vesting"),
  DAO_CONFIG: Buffer.from("dao_config"),
  MEMBER: Buffer.from("member"),
  PROPOSAL: Buffer.from("proposal"),
  VOTE: Buffer.from("vote"),
  REWARD_CLAIM: Buffer.from("reward_claim"),
} as const;

export const CURATION_CONSTANTS = {
  MIN_STAKE_LAMPORTS: 1_000_000_000,
  MIN_RATING: 1,
  MAX_RATING: 5,
  MAX_REVIEW_URI_LENGTH: 200,
  HALF_LIFE_SLOTS: 19_440_000,
  SYBIL_THRESHOLD_RATINGS: 100,
  SYBIL_WEIGHT_PENALTY_BP: 1000,
  CONSENSUS_STDDEV_BP: 2000,
  MAX_REPUTATION_BP: 10_000,
} as const;

export const TOKEN_CONSTANTS = {
  DECIMALS: 9,
  CAP_TOKENS: 1_000_000_000,
  YEAR_1_SUPPLY_TOKENS: 100_000_000,
  EMISSION_PER_YEAR_TOKENS: 50_000_000,
  ECOSYSTEM_FUND_PCT: 40,
  CREATOR_REWARDS_PCT: 25,
  CURATOR_REWARDS_PCT: 15,
  CORE_CONTRIBUTORS_PCT: 10,
  PUBLIC_SALE_PCT: 10,
  YEAR_SECONDS: 31_536_000,
} as const;

export const GOVERNANCE_CONSTANTS = {
  DEFAULT_VOTING_PERIOD_SECS: 604_800,
  DEFAULT_MIN_VOTING_POWER_TOKENS: 1_000_000_000,
  DEFAULT_QUORUM_BP: 1000,
  DEFAULT_PASS_THRESHOLD_BP: 5000,
  MAX_DESCRIPTION_LEN: 500,
  MAX_URI_LEN: 200,
} as const;
