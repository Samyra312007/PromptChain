import { createHash, randomBytes } from "crypto";
import {
  SoulboundAttestation,
  CredentialType,
  DEFAULT_IDENTITY_CONSTANTS,
} from "./types";

export class SoulboundRegistry {
  private attestations: Map<string, SoulboundAttestation> = new Map();
  private subjectAttestations: Map<string, string[]> = new Map();

  issueAttestation(
    subject: string,
    issuer: string,
    credentialType: CredentialType,
    metadata: Record<string, unknown>,
    expiresInDays?: number,
  ): SoulboundAttestation {
    const id = `sb:${randomBytes(16).toString("hex")}:${Date.now()}`;
    const issuedAt = Date.now();
    const expiresAt = expiresInDays
      ? issuedAt + expiresInDays * 24 * 60 * 60 * 1000
      : null;

    const proofPayload = `${subject}|${issuer}|${credentialType}|${issuedAt}|${JSON.stringify(metadata)}`;
    const proof = createHash("sha256").update(proofPayload, "utf8").digest("hex");

    const attestation: SoulboundAttestation = {
      id,
      subject,
      issuer,
      credentialType,
      issuedAt,
      expiresAt,
      revoked: false,
      metadata,
      proof,
    };

    this.attestations.set(id, attestation);
    const existing = this.subjectAttestations.get(subject) || [];
    existing.push(id);
    this.subjectAttestations.set(subject, existing);

    return attestation;
  }

  revokeAttestation(id: string, reason?: string): boolean {
    const attestation = this.attestations.get(id);
    if (!attestation || attestation.revoked) return false;

    attestation.revoked = true;
    attestation.revokedAt = Date.now();
    attestation.revokedReason = reason;
    return true;
  }

  verifyAttestation(id: string): boolean {
    const attestation = this.attestations.get(id);
    if (!attestation) return false;
    if (attestation.revoked) return false;
    if (attestation.expiresAt && Date.now() > attestation.expiresAt) return false;

    const proofPayload = `${attestation.subject}|${attestation.issuer}|${attestation.credentialType}|${attestation.issuedAt}|${JSON.stringify(attestation.metadata)}`;
    const expectedProof = createHash("sha256").update(proofPayload, "utf8").digest("hex");
    return attestation.proof === expectedProof;
  }

  getAttestation(id: string): SoulboundAttestation | undefined {
    return this.attestations.get(id);
  }

  getAttestationsBySubject(subject: string): SoulboundAttestation[] {
    const ids = this.subjectAttestations.get(subject) || [];
    return ids.map((id) => this.attestations.get(id)!).filter(Boolean);
  }

  getActiveAttestationsBySubject(subject: string): SoulboundAttestation[] {
    return this.getAttestationsBySubject(subject).filter((a) => this.verifyAttestation(a.id));
  }

  isSubjectVerified(subject: string, credentialType: CredentialType): boolean {
    return this.getAttestationsBySubject(subject).some(
      (a) => a.credentialType === credentialType && this.verifyAttestation(a.id),
    );
  }

  getAllAttestations(): SoulboundAttestation[] {
    return Array.from(this.attestations.values());
  }

  getAttestationCount(): number {
    return this.attestations.size;
  }

  getRevokedAttestations(): SoulboundAttestation[] {
    return this.getAllAttestations().filter((a) => a.revoked);
  }

  exportState(): { attestations: SoulboundAttestation[] } {
    return {
      attestations: this.getAllAttestations(),
    };
  }

  importState(state: { attestations: SoulboundAttestation[] }): void {
    this.attestations.clear();
    this.subjectAttestations.clear();
    for (const a of state.attestations) {
      this.attestations.set(a.id, a);
      const existing = this.subjectAttestations.get(a.subject) || [];
      existing.push(a.id);
      this.subjectAttestations.set(a.subject, existing);
    }
  }
}
