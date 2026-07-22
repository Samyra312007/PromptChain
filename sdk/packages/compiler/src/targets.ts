export interface ModelTarget {
  provider: string;
  modelId: string;
  label: string;
  systemFormat: 'openai' | 'anthropic' | 'llama' | 'gemini' | 'mistral';
  maxTokens: number;
  recommended: boolean;
}

export const modelTargets: ModelTarget[] = [
  {
    provider: 'openai',
    modelId: 'gpt-4o',
    label: 'GPT-4o',
    systemFormat: 'openai',
    maxTokens: 128000,
    recommended: true,
  },
  {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    systemFormat: 'openai',
    maxTokens: 128000,
    recommended: true,
  },
  {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet',
    label: 'Claude 3.5 Sonnet',
    systemFormat: 'anthropic',
    maxTokens: 200000,
    recommended: true,
  },
  {
    provider: 'anthropic',
    modelId: 'claude-3-haiku',
    label: 'Claude 3 Haiku',
    systemFormat: 'anthropic',
    maxTokens: 200000,
    recommended: false,
  },
  {
    provider: 'meta',
    modelId: 'llama-3.1-70b',
    label: 'Llama 3.1 70B',
    systemFormat: 'llama',
    maxTokens: 131072,
    recommended: true,
  },
  {
    provider: 'meta',
    modelId: 'llama-3.1-8b',
    label: 'Llama 3.1 8B',
    systemFormat: 'llama',
    maxTokens: 131072,
    recommended: false,
  },
  {
    provider: 'google',
    modelId: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    systemFormat: 'gemini',
    maxTokens: 1048576,
    recommended: true,
  },
  {
    provider: 'mistral',
    modelId: 'mistral-large',
    label: 'Mistral Large',
    systemFormat: 'mistral',
    maxTokens: 131072,
    recommended: false,
  },
];

export function getTarget(modelId: string): ModelTarget | undefined {
  return modelTargets.find((t) => t.modelId === modelId);
}

export function getRecommendedTargets(): ModelTarget[] {
  return modelTargets.filter((t) => t.recommended);
}
