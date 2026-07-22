import { describe, it, expect } from 'vitest';
import { Prover } from '../prover';
import { Verifier } from '../verifier';
import { padProof } from '../types';

describe('Prover', () => {
  const prover = new Prover({ defaultProvider: 'openai', defaultModel: 'gpt-4o' });

  it('should create a proof for a prompt execution', async () => {
    const proof = await prover.createProof(
      'QmTestPromptCid',
      'def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)'
    );
    expect(proof.commitment).toBeDefined();
    expect(proof.commitment.claim.promptCid).toBe('QmTestPromptCid');
    expect(proof.commitment.claim.model.modelId).toBe('gpt-4o');
    expect(proof.commitment.commitmentHash).toBeTruthy();
    expect(proof.commitment.claim.nonce).toBeTruthy();
  });

  it('should create a batch proof', async () => {
    const batch = await prover.createBatchProof([
      { promptCid: 'QmA', output: 'output1' },
      { promptCid: 'QmB', output: 'output2' },
      { promptCid: 'QmC', output: 'output3' },
    ]);
    expect(batch.proofs.length).toBe(3);
    expect(batch.root).toBeTruthy();
    expect(batch.totalOutputs).toBe(3);
  });
});

describe('Verifier', () => {
  const prover = new Prover();
  const verifier = new Verifier(86400);

  it('should verify a valid proof', async () => {
    const output = 'test output for verification';
    const proof = await prover.createProof('QmTest', output);
    const result = await verifier.verify(proof, output);
    expect(result.verified).toBe(true);
    expect(result.status).toBe('verified');
  });
});

describe('padProof', () => {
  it('should be deterministic with same nonce', () => {
    const a = padProof('test output', 'nonce123');
    const b = padProof('test output', 'nonce123');
    expect(a).toBe(b);
  });

  it('should differ with different nonce', () => {
    const a = padProof('test output', 'nonce1');
    const b = padProof('test output', 'nonce2');
    expect(a).not.toBe(b);
  });
});
