import { randomBytes, createHash } from 'crypto';
import {
  BatchProof,
  ExecutionClaim,
  ExecutionProof,
  ProofCommitment,
  padProof,
} from './types';

export interface ProverOptions {
  executorKeypair?: Uint8Array;
  defaultModel?: string;
  defaultProvider?: string;
}

export class Prover {
  private options: ProverOptions;

  constructor(options?: ProverOptions) {
    this.options = options || {};
  }

  async createProof(
    promptCid: string,
    output: string,
    modelId?: string,
    provider?: string
  ): Promise<ExecutionProof> {
    const nonce = randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);
    const outputCid = this.computeOutputCid(output);

    const claim: ExecutionClaim = {
      promptCid,
      model: {
        provider: provider || this.options.defaultProvider || 'openai',
        modelId: modelId || this.options.defaultModel || 'gpt-4o',
      },
      outputCid,
      executor: 'placeholder-wallet',
      timestamp,
      nonce,
    };

    const commitmentHash = padProof(output, nonce);
    const commitment: ProofCommitment = {
      claim,
      commitmentHash,
      signature: 'placeholder-signature',
      publicKey: 'placeholder-pubkey',
    };

    return { commitment };
  }

  async createBatchProof(
    outputs: Array<{ promptCid: string; output: string; modelId?: string; provider?: string }>
  ): Promise<BatchProof> {
    const proofs: ExecutionProof[] = [];
    for (const entry of outputs) {
      const proof = await this.createProof(
        entry.promptCid,
        entry.output,
        entry.modelId,
        entry.provider
      );
      proofs.push(proof);
    }

    const root = this.computeMerkleRoot(proofs);
    return {
      root,
      proofs,
      timestamp: Math.floor(Date.now() / 1000),
      totalOutputs: proofs.length,
    };
  }

  private computeOutputCid(output: string): string {
    const hash = createHash('sha256').update(output).digest('hex');
    return `Qm${hash.slice(0, 44)}`;
  }

  private computeMerkleRoot(proofs: ExecutionProof[]): string {
    const leaves = proofs.map((p) =>
      createHash('sha256')
        .update(JSON.stringify(p.commitment))
        .digest('hex')
    );

    let current = leaves;
    while (current.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        if (i + 1 < current.length) {
          const hash = createHash('sha256')
            .update(current[i] + current[i + 1])
            .digest('hex');
          next.push(hash);
        } else {
          next.push(current[i]);
        }
      }
      current = next;
    }

    return current[0] || '000';
  }
}
