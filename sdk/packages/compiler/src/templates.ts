import { ModelTarget } from './targets';

type SystemTemplate = (prompt: string) => string;

const systemTemplates: Record<string, SystemTemplate> = {
  openai: (prompt: string) =>
    `You are an expert AI assistant. Follow the instructions below precisely.\n\n${prompt}`,

  anthropic: (prompt: string) =>
    `${prompt}`,

  llama: (prompt: string) =>
    `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\nYou are a helpful AI assistant.\n<|eot_id|>\n<|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|>\n<|start_header_id|>assistant<|end_header_id|>`,

  gemini: (prompt: string) =>
    `${prompt}`,

  mistral: (prompt: string) =>
    `[INST] ${prompt} [/INST]`,
};

const roleTemplates: Record<string, SystemTemplate> = {
  openai: (prompt: string) =>
    `You are an expert at ${prompt}. Provide clear, accurate, and well-structured responses.`,

  anthropic: (prompt: string) =>
    `I am an expert at ${prompt}. I will provide clear, accurate results.`,

  llama: (prompt: string) => prompt,
  gemini: (prompt: string) => prompt,
  mistral: (prompt: string) => prompt,
};

export function applyTemplate(
  prompt: string,
  target: ModelTarget,
  role?: string
): string {
  const template = role
    ? roleTemplates[target.systemFormat]
    : systemTemplates[target.systemFormat];
  const wrapped = role ? template(`act as ${role}`) : template(prompt);
  return wrapped;
}

export function registerTemplate(
  format: string,
  systemFn: SystemTemplate,
  roleFn?: SystemTemplate
): void {
  systemTemplates[format] = systemFn;
  if (roleFn) {
    roleTemplates[format] = roleFn;
  }
}
