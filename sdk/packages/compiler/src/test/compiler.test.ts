import { describe, it, expect } from 'vitest';
import { PromptCompiler } from '../compiler';
import { modelTargets, getTarget, getRecommendedTargets } from '../targets';

describe('ModelTargets', () => {
  it('should have recommended targets', () => {
    const recommended = getRecommendedTargets();
    expect(recommended.length).toBeGreaterThan(0);
  });

  it('should find target by model id', () => {
    const target = getTarget('gpt-4o');
    expect(target).toBeDefined();
    expect(target?.provider).toBe('openai');
  });

  it('should return undefined for unknown model', () => {
    const target = getTarget('nonexistent');
    expect(target).toBeUndefined();
  });
});

describe('PromptCompiler', () => {
  const compiler = new PromptCompiler();

  it('should compile a prompt for a target', () => {
    const target = getTarget('gpt-4o')!;
    const result = compiler.compile('Write a sorting function in Rust', target);
    expect(result.target.modelId).toBe('gpt-4o');
    expect(result.compiled).toContain('sorting function');
    expect(result.warnings).toHaveLength(0);
  });

  it('should throw for unknown model', () => {
    expect(() => compiler.compileForModel('test', 'unknown-model')).toThrow();
  });

  it('should compile for multiple targets', () => {
    const targets = modelTargets.filter((t) => t.recommended);
    const results = compiler.compileMulti('Write a function', targets);
    expect(results.length).toBe(targets.length);
    results.forEach((r) => {
      expect(r.compiled).toBeDefined();
      expect(r.tokenEstimate).toBeGreaterThan(0);
    });
  });

  it('should apply chain-of-thought format', () => {
    const target = getTarget('claude-3-5-sonnet')!;
    const result = compiler.compile('Solve math problem', target, {
      instructionFormat: 'chain-of-thought',
    });
    expect(result.compiled).toContain('step by step');
  });

  it('should include examples when provided', () => {
    const target = getTarget('gpt-4o')!;
    const result = compiler.compile('Write code', target, {
      examples: [
        { input: 'add two numbers', output: '2 + 3 = 5' },
      ],
    });
    expect(result.compiled).toContain('Example 1');
  });

  it('should generate token estimates', () => {
    const target = getTarget('gpt-4o')!;
    const result = compiler.compile('Hello world', target);
    expect(result.tokenEstimate).toBeGreaterThan(0);
    expect(result.tokenEstimate).toBeLessThan(100);
  });
});
