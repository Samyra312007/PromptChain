import { createHash } from 'crypto';

/**
 * Represents a proof that a prompt was executed against a specific model
 * producing a specific output. Uses a commitment scheme: the executor hashes
 * the (prompt, model, output, timestamp) tuple and signs it.
 * Full zkSNARK integration is an open research problem (see planning.md Layer 6).
 */
export interface ExecutionClaim {
  promptCid: string;
  model: ModelInfo;
  outputCid: string;
  executor: string;
  timestamp: number;
  nonce: string;
}

export interface ModelInfo {
  provider: string;
  modelId: string;
  version?: string;
}

export interface ProofCommitment {
  claim: ExecutionClaim;
  commitmentHash: string;
  signature: string;
  publicKey: string;
}

export interface ExecutionProof {
  commitment: ProofCommitment;
  merklePath?: string[];
  batchRoot?: string;
}

export interface BatchProof {
  root: string;
  proofs: ExecutionProof[];
  timestamp: number;
  totalOutputs: number;
}

export type ProofStatus = 'pending' | 'verified' | 'rejected' | 'expired';

/**
 * Simple Proof-of-Execution-and-Delivery (PAD) proof.
 * The executor appends a deterministic padding to the output and hashes it.
 * The verifier can check that the output was produced without re-execution.
 */
export function padProof(output: string, nonce: string): string {
  return createHash('sha256').update(output + nonce).digest('hex');
}

export function verifyPadProof(
  output: string,
  nonce: string,
  expectedHash: string
): boolean {
  const computed = padProof(output, nonce);
  return computed === expectedHash;
}
