import { ModelTarget, getTarget } from './targets';
import { applyTemplate } from './templates';
import { PromptMetadata } from '@promptchain/schema';

export interface CompileOptions {
  role?: string;
  includeMetadata?: boolean;
  instructionFormat?: 'direct' | 'chain-of-thought' | 'few-shot';
  examples?: Array<{ input: string; output: string }>;
}

export interface CompilationResult {
  source: string;
  target: ModelTarget;
  compiled: string;
  tokenEstimate: number;
  warnings: string[];
  metadata: {
    compiledAt: string;
    compilerVersion: string;
    format: string;
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatExamples(examples: Array<{ input: string; output: string }>): string {
  return examples
    .map((ex, i) => `Example ${i + 1}:\nInput: ${ex.input}\nOutput: ${ex.output}\n`)
    .join('\n');
}

function buildChainOfThought(prompt: string): string {
  return `${prompt}\n\nThink through this step by step:\n1. First, understand the requirements\n2. Break down the problem\n3. Implement the solution\n4. Verify correctness`;
}

export class PromptCompiler {
  readonly version = '0.1.0';

  compile(
    prompt: string,
    target: ModelTarget,
    options?: CompileOptions
  ): CompilationResult {
    const warnings: string[] = [];
    let compiled = prompt;

    if (options?.instructionFormat === 'chain-of-thought') {
      compiled = buildChainOfThought(compiled);
    }

    if (options?.examples && options.examples.length > 0) {
      compiled = `${compiled}\n\n${formatExamples(options.examples)}`;
    }

    compiled = applyTemplate(compiled, target, options?.role);

    if (compiled.length > target.maxTokens * 4) {
      warnings.push(
        `Output exceeds ${target.maxTokens} token limit by ~${Math.ceil((compiled.length - target.maxTokens * 4) / 4)} tokens`
      );
    }

    if (options?.includeMetadata) {
      const metadata: Partial<PromptMetadata> = {
        target_model: {
          provider: target.provider,
          model_id: target.modelId,
        },
        category: 'compiled',
        tags: ['compiled', target.provider, target.modelId],
        description: `Compiled for ${target.label}`,
        language: 'en',
        name: `Compiled: ${prompt.slice(0, 40)}...`,
        prompt_text: compiled,
        task_description: prompt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      warnings.push(`Metadata: ${JSON.stringify(metadata)}`);
    }

    return {
      source: prompt,
      target,
      compiled,
      tokenEstimate: estimateTokens(compiled),
      warnings,
      metadata: {
        compiledAt: new Date().toISOString(),
        compilerVersion: this.version,
        format: target.systemFormat,
      },
    };
  }

  compileForModel(
    prompt: string,
    modelId: string,
    options?: CompileOptions
  ): CompilationResult {
    const target = getTarget(modelId);
    if (!target) {
      throw new Error(`Unknown model: ${modelId}. Use getTargets() to see available models.`);
    }
    return this.compile(prompt, target, options);
  }

  compileMulti(
    prompt: string,
    targets: ModelTarget[],
    options?: CompileOptions
  ): CompilationResult[] {
    return targets.map((t) => this.compile(prompt, t, options));
  }
}
