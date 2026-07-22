export const PROMPTCHAIN_PROGRAM_ID = "D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F";

export const CURATION_PROGRAM_ID = "2eWqZR6HriWjKJs5MozSZKERxP98JM7FEwn8FA7Hh1cK";

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
