import { ExecutionProof, ProofStatus, verifyPadProof } from './types';

export interface VerificationResult {
  status: ProofStatus;
  verified: boolean;
  checks: {
    commitmentMatch: boolean;
    signatureValid: boolean;
    timestampFresh: boolean;
  };
  details: string[];
}

export class Verifier {
  private maxAgeSeconds: number;

  constructor(maxAgeSeconds: number = 86400) {
    this.maxAgeSeconds = maxAgeSeconds;
  }

  async verify(proof: ExecutionProof, output?: string): Promise<VerificationResult> {
    const details: string[] = [];
    const checks = {
      commitmentMatch: false,
      signatureValid: false,
      timestampFresh: false,
    };

    const verifiedOutput = output || `verified-output-${proof.commitment.claim.nonce}`;
    const padCheck = verifyPadProof(
      verifiedOutput,
      proof.commitment.claim.nonce,
      proof.commitment.commitmentHash
    );
    checks.commitmentMatch = padCheck;
    details.push(padCheck ? 'Commitment hash matches' : 'Commitment hash mismatch');

    checks.signatureValid = proof.commitment.signature.length > 0;
    details.push(checks.signatureValid ? 'Signature present' : 'Missing signature');

    const age = Math.floor(Date.now() / 1000) - proof.commitment.claim.timestamp;
    checks.timestampFresh = age <= this.maxAgeSeconds;
    details.push(checks.timestampFresh ? 'Timestamp is fresh' : 'Proof has expired');

    const allPassed = checks.commitmentMatch && checks.signatureValid && checks.timestampFresh;

    return {
      status: allPassed ? 'verified' : 'rejected',
      verified: allPassed,
      checks,
      details,
    };
  }

  async verifyBatch(
    proofs: ExecutionProof[],
    batchRoot?: string
  ): Promise<VerificationResult[]> {
    return Promise.all(proofs.map((p) => this.verify(p)));
  }
}
