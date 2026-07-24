import { createHash, randomBytes } from "crypto";
import {
  W3CVerifiableCredential,
  CredentialType,
  CredentialTemplate,
  CREDENTIAL_TEMPLATES,
  DEFAULT_IDENTITY_CONSTANTS,
} from "./types";

export class VerifiableCredentialManager {
  createCredential(
    subjectId: string,
    issuerId: string,
    credentialType: CredentialType,
    attributes: Record<string, unknown>,
    expiresInDays?: number,
  ): W3CVerifiableCredential {
    const template = CREDENTIAL_TEMPLATES[credentialType];
    if (!template) {
      throw new Error(`Unknown credential type: ${credentialType}`);
    }

    const id = `urn:uuid:${randomBytes(16).toString("hex")}-${Date.now()}`;
    const issuanceDate = new Date().toISOString();
    const maxDays = expiresInDays !== undefined
      ? expiresInDays
      : template.expiresInDays;
    const expirationDate = maxDays != null
      ? new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const credentialSubject: { id: string; [key: string]: unknown } = { id: subjectId };
    for (const attr of template.attributes) {
      if (attributes[attr] !== undefined) {
        credentialSubject[attr] = attributes[attr];
      }
    }

    return {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      id,
      type: ["VerifiableCredential", credentialType],
      issuer: issuerId,
      issuanceDate,
      expirationDate,
      credentialSubject,
    };
  }

  signCredential(credential: W3CVerifiableCredential, signerId: string): W3CVerifiableCredential {
    const proofPayload = this.buildProofPayload(credential);
    const signature = createHash("sha256")
      .update(proofPayload + signerId, "utf8")
      .digest("hex");

    return {
      ...credential,
      proof: {
        type: "PromptChainSignature",
        created: new Date().toISOString(),
        proofPurpose: "assertionMethod",
        verificationMethod: `${signerId}#key-1`,
        signature,
      },
    };
  }

  verifyCredential(credential: W3CVerifiableCredential): boolean {
    if (!credential.proof) return false;
    if (credential.expirationDate) {
      const expiry = new Date(credential.expirationDate).getTime();
      if (Date.now() > expiry) return false;
    }

    const { proof } = credential;
    const unsignedCred = { ...credential, proof: undefined };
    const proofPayload = this.buildProofPayload(unsignedCred);
    const expectedSig = createHash("sha256")
      .update(proofPayload + this.extractSignerFromProof(proof), "utf8")
      .digest("hex");

    return proof.signature === expectedSig;
  }

  verifyCredentialWithIssuer(credential: W3CVerifiableCredential, expectedIssuer: string): boolean {
    if (credential.issuer !== expectedIssuer) return false;
    return this.verifyCredential(credential);
  }

  isExpired(credential: W3CVerifiableCredential): boolean {
    if (!credential.expirationDate) return false;
    return Date.now() > new Date(credential.expirationDate).getTime();
  }

  daysUntilExpiry(credential: W3CVerifiableCredential): number | null {
    if (!credential.expirationDate) return null;
    const now = Date.now();
    const expiry = new Date(credential.expirationDate).getTime();
    if (now >= expiry) return 0;
    return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  }

  getCredentialType(credential: W3CVerifiableCredential): CredentialType | null {
    const types = credential.type.filter((t) => t !== "VerifiableCredential");
    return (types.length > 0 ? types[0] : null) as CredentialType | null;
  }

  revokeCredential(credential: W3CVerifiableCredential, reason?: string): W3CVerifiableCredential {
    return {
      ...credential,
      expirationDate: new Date(0).toISOString(),
    };
  }

  private buildProofPayload(credential: Partial<W3CVerifiableCredential>): string {
    return `${credential.id}|${credential.issuer}|${credential.issuanceDate}|${JSON.stringify(credential.credentialSubject)}`;
  }

  private extractSignerFromProof(proof: NonNullable<W3CVerifiableCredential["proof"]>): string {
    return proof.verificationMethod.replace("#key-1", "");
  }
}
