export const PROMPTCHAIN_PROGRAM_ID = "D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F";

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
} as const;
