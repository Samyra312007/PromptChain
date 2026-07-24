import { PublicKey } from "@solana/web3.js";
import { getProvider } from "../index";
import {
  ReputationCalculator,
  VerifiableCredentialManager,
  SoulboundRegistry,
  DelegatedIdentityManager,
  IdentityClient,
  CREDENTIAL_TEMPLATES,
  DEFAULT_IDENTITY_CONSTANTS,
  CredentialType,
  DelegatedPermission,
} from "@promptchain/identity";
import {
  REPUTATION_ALPHA_BP,
  REPUTATION_BETA_BP,
  REPUTATION_GAMMA_BP,
  REPUTATION_DELTA_BP,
} from "@promptchain/identity";

export async function identityStatusCommand(
  options: { keypair?: string; rpcUrl: string; wallet?: string },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const authority = options.wallet
      ? new PublicKey(options.wallet)
      : provider.wallet.publicKey;
    const client = new IdentityClient(provider);
    const profile = await client.buildProfile(authority);

    console.log("Identity Profile:");
    console.log(`  Wallet:     ${profile.walletAddress}`);
    console.log(`  Joined:     ${new Date(profile.joinedAt).toISOString()}`);
    console.log(`  Prompts:    ${profile.promptsPublished}`);
    console.log(`  Curations:  ${profile.curationsPerformed}`);

    if (profile.reputation) {
      console.log("\nReputation Score:");
      console.log(`  Overall:              ${(profile.reputation.overallBp / 100).toFixed(2)}%`);
      console.log(`  Curation Accuracy:    ${(profile.reputation.curationAccuracyBp / 100).toFixed(2)}%`);
      console.log(`  Content Quality:      ${(profile.reputation.contentQualityBp / 100).toFixed(2)}%`);
      console.log(`  Community Contrib:    ${(profile.reputation.communityContributionsBp / 100).toFixed(2)}%`);
      console.log(`  Slashing Penalty:     ${(profile.reputation.slashingEventsBp / 100).toFixed(2)}%`);
    } else {
      console.log("\n  Reputation: (not yet initialized)");
    }

    if (profile.soulboundAttestations.length > 0) {
      console.log(`\nSoulbound Attestations (${profile.soulboundAttestations.length}):`);
      for (const a of profile.soulboundAttestations) {
        const status = a.revoked ? "REVOKED" : "active";
        console.log(`  [${status}] ${a.credentialType} — ${a.id.slice(0, 24)}...`);
      }
    }

    if (profile.delegations.length > 0) {
      console.log(`\nDelegations (${profile.delegations.length}):`);
      for (const d of profile.delegations) {
        const status = d.revoked ? "revoked" : "active";
        const expiry = d.expiresAt ? new Date(d.expiresAt).toISOString() : "never";
        console.log(`  [${status}] Cold:${d.coldWallet.slice(0, 8)}... → Hot:${d.hotWallet.slice(0, 8)}... (expires: ${expiry})`);
      }
    }
  } catch (err) {
    console.error("Failed to fetch identity:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function identityReputationCommand(
  options: { keypair?: string; rpcUrl: string },
): Promise<void> {
  try {
    const calculator = new ReputationCalculator();

    console.log("Reputation Formula:");
    console.log(`  R = α·curation_accuracy + β·content_quality + γ·community − δ·slashing`);
    console.log(`  α = ${(REPUTATION_ALPHA_BP / 100).toFixed(2)}%`);
    console.log(`  β = ${(REPUTATION_BETA_BP / 100).toFixed(2)}%`);
    console.log(`  γ = ${(REPUTATION_GAMMA_BP / 100).toFixed(2)}%`);
    console.log(`  δ = ${(REPUTATION_DELTA_BP / 100).toFixed(2)}%`);
    console.log(`  Max score: ${DEFAULT_IDENTITY_CONSTANTS.MAX_REPUTATION.toLocaleString()} (u32)`);
    console.log(`  Half-life: ${DEFAULT_IDENTITY_CONSTANTS.REPUTATION_HALF_LIFE_DAYS} days`);

    const score = calculator.compute({
      curationAccuracyBp: 8500,
      contentQualityBp: 7200,
      communityContributionsBp: 6000,
      slashingEventsBp: 500,
    });

    console.log("\nExample computation:");
    console.log(`  Curation:     85.00% → ${(score.curationAccuracyBp / 100).toFixed(2)}%`);
    console.log(`  Content:      72.00% → ${(score.contentQualityBp / 100).toFixed(2)}%`);
    console.log(`  Community:    60.00% → ${(score.communityContributionsBp / 100).toFixed(2)}%`);
    console.log(`  Slashing:      5.00% → ${(score.slashingEventsBp / 100).toFixed(2)}%`);
    console.log(`  Overall:      ${(score.overallBp / 100).toFixed(2)}%`);

    const provider = await getProvider(options.keypair, options.rpcUrl);
    const client = new IdentityClient(provider);
    const onChainScore = await client.fetchReputationScore(provider.wallet.publicKey);

    if (onChainScore) {
      console.log("\nYour on-chain reputation:");
      console.log(`  Overall: ${(onChainScore.overallBp / 100).toFixed(2)}%`);
    }
  } catch (err) {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function identityCredentialCreateCommand(
  subject: string,
  credentialType: string,
  options: { keypair?: string; rpcUrl: string; attr?: string[] },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const issuer = provider.wallet.publicKey.toBase58();

    const type = credentialType as CredentialType;
    if (!CREDENTIAL_TEMPLATES[type]) {
      console.error(`Unknown credential type: ${credentialType}`);
      console.log("Available types:", Object.keys(CREDENTIAL_TEMPLATES).join(", "));
      process.exit(1);
    }

    const attributes: Record<string, unknown> = {};
    if (options.attr) {
      for (const a of options.attr) {
        const [key, val] = a.split("=");
        if (key) attributes[key] = val || true;
      }
    }

    const manager = new VerifiableCredentialManager();
    const credential = manager.createCredential(subject, issuer, type, attributes);
    const signed = manager.signCredential(credential, issuer);

    console.log("Verifiable Credential created:");
    console.log(`  ID:        ${signed.id}`);
    console.log(`  Type:      ${signed.type.join(", ")}`);
    console.log(`  Subject:   ${signed.credentialSubject.id}`);
    console.log(`  Issuer:    ${signed.issuer}`);
    console.log(`  Issued:    ${signed.issuanceDate}`);
    console.log(`  Expires:   ${signed.expirationDate || "never"}`);
    console.log(`  Proof:     ${signed.proof?.signature.slice(0, 16)}...`);
    console.log(`\n${JSON.stringify(signed, null, 2)}`);
  } catch (err) {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function identityCredentialVerifyCommand(
  credentialJson: string,
): Promise<void> {
  try {
    let credential = JSON.parse(credentialJson);
    const manager = new VerifiableCredentialManager();
    const valid = manager.verifyCredential(credential);
    const expired = manager.isExpired(credential);

    console.log("Credential Verification:");
    console.log(`  Valid:    ${valid ? "YES" : "NO"}`);
    console.log(`  Expired:  ${expired ? "YES" : "NO"}`);
    if (credential.proof) {
      console.log(`  Issuer:   ${credential.issuer}`);
      console.log(`  Type:     ${manager.getCredentialType(credential)}`);
    }
    const daysLeft = manager.daysUntilExpiry(credential);
    if (daysLeft !== null) {
      console.log(`  Expires:  ${daysLeft > 0 ? `in ${daysLeft} days` : "already expired"}`);
    }
  } catch (err) {
    console.error("Failed to verify credential:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function identitySoulboundIssueCommand(
  subject: string,
  credentialType: string,
  options: { keypair?: string; rpcUrl: string; attr?: string[]; expiresIn?: string },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const issuer = provider.wallet.publicKey.toBase58();
    const type = credentialType as CredentialType;

    if (!CREDENTIAL_TEMPLATES[type]) {
      console.error(`Unknown type: ${credentialType}`);
      process.exit(1);
    }

    const attributes: Record<string, unknown> = {};
    if (options.attr) {
      for (const a of options.attr) {
        const [key, val] = a.split("=");
        if (key) attributes[key] = val || true;
      }
    }

    const registry = new SoulboundRegistry();
    const expiresInDays = options.expiresIn ? parseInt(options.expiresIn) : undefined;
    const attestation = registry.issueAttestation(subject, issuer, type, attributes, expiresInDays);

    console.log("Soulbound Attestation issued:");
    console.log(`  ID:        ${attestation.id}`);
    console.log(`  Subject:   ${attestation.subject}`);
    console.log(`  Type:      ${attestation.credentialType}`);
    console.log(`  Issuer:    ${attestation.issuer}`);
    console.log(`  Expires:   ${attestation.expiresAt ? new Date(attestation.expiresAt).toISOString() : "never"}`);
    console.log(`  Proof:     ${attestation.proof.slice(0, 16)}...`);
  } catch (err) {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function identitySoulboundCheckCommand(
  subject: string,
  credentialType?: string,
): Promise<void> {
  try {
    const registry = new SoulboundRegistry();
    const attestations = registry.getAttestationsBySubject(subject);

    if (attestations.length === 0) {
      console.log("No soulbound attestations found for", subject);
      return;
    }

    console.log(`Soulbound Attestations for ${subject}:\n`);
    for (const a of attestations) {
      const valid = registry.verifyAttestation(a.id);
      const status = a.revoked ? "REVOKED" : valid ? "active" : "invalid";
      console.log(`  [${status}] ${a.credentialType}`);
      console.log(`     ID:      ${a.id.slice(0, 32)}...`);
      console.log(`     Issuer:  ${a.issuer.slice(0, 16)}...`);
      console.log(`     Issued:  ${new Date(a.issuedAt).toISOString()}`);
      if (a.expiresAt) console.log(`     Expires: ${new Date(a.expiresAt).toISOString()}`);
      if (a.revokedReason) console.log(`     Reason:  ${a.revokedReason}`);
      console.log();
    }
  } catch (err) {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function identityDelegateCommand(
  hotWallet: string,
  permissions: string,
  options: { keypair?: string; rpcUrl: string; expiresIn?: string },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const coldWallet = provider.wallet.publicKey.toBase58();
    const perms = permissions.split(",").map((p) => p.trim()) as DelegatedPermission[];
    const expiresInDays = options.expiresIn ? parseInt(options.expiresIn) : undefined;

    const manager = new DelegatedIdentityManager();
    const config = manager.delegate(coldWallet, hotWallet, perms, expiresInDays);

    console.log("Delegation created:");
    console.log(`  Cold Wallet:  ${config.coldWallet}`);
    console.log(`  Hot Wallet:   ${config.hotWallet}`);
    console.log(`  Permissions:  ${config.permissions.join(", ")}`);
    console.log(`  Expires:      ${config.expiresAt ? new Date(config.expiresAt).toISOString() : "never"}`);
  } catch (err) {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function identityDelegateRevokeCommand(
  hotWallet: string,
  options: { keypair?: string; rpcUrl: string },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const coldWallet = provider.wallet.publicKey.toBase58();

    const manager = new DelegatedIdentityManager();
    const revoked = manager.revokeDelegation(coldWallet, hotWallet);

    if (revoked) {
      console.log(`Delegation revoked for hot wallet ${hotWallet}`);
    } else {
      console.log("No active delegation found for that wallet pair.");
    }
  } catch (err) {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
