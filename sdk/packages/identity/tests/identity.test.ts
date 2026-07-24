import { describe, it, expect } from "vitest";
import { ReputationCalculator } from "../src/reputation-calculator";
import { VerifiableCredentialManager } from "../src/verifiable-credential";
import { SoulboundRegistry } from "../src/soulbound-registry";
import { DelegatedIdentityManager } from "../src/delegated-identity";
import {
  ReputationFactors,
  ReputationScore,
  BPS_DENOMINATOR,
  CREDENTIAL_TEMPLATES,
  DEFAULT_IDENTITY_CONSTANTS,
} from "../src/types";

describe("ReputationCalculator", () => {
  const calculator = new ReputationCalculator();

  it("computes reputation with default coefficients", () => {
    const factors: ReputationFactors = {
      curationAccuracyBp: 8000,
      contentQualityBp: 7000,
      communityContributionsBp: 5000,
      slashingEventsBp: 0,
    };
    const score = calculator.compute(factors);
    expect(score.curationAccuracyBp).toBe(8000);
    expect(score.contentQualityBp).toBe(7000);
    expect(score.communityContributionsBp).toBe(5000);
    expect(score.overallBp).toBeGreaterThan(0);
    expect(score.version).toBe("0.1.0");
  });

  it("applies slashing penalty", () => {
    const withoutSlashing = calculator.compute({
      curationAccuracyBp: 8000,
      contentQualityBp: 7000,
      communityContributionsBp: 5000,
      slashingEventsBp: 0,
    });
    const withSlashing = calculator.compute({
      curationAccuracyBp: 8000,
      contentQualityBp: 7000,
      communityContributionsBp: 5000,
      slashingEventsBp: 5000,
    });
    expect(withSlashing.overallBp).toBeLessThan(withoutSlashing.overallBp);
  });

  it("clamps values to valid range", () => {
    const score = calculator.compute({
      curationAccuracyBp: 999999,
      contentQualityBp: -100,
      communityContributionsBp: 5000,
      slashingEventsBp: -50,
    });
    expect(score.curationAccuracyBp).toBeLessThanOrEqual(BPS_DENOMINATOR);
    expect(score.contentQualityBp).toBeGreaterThanOrEqual(0);
    expect(score.communityContributionsBp).toBe(5000);
  });

  it("computes maximum reputation", () => {
    const score = calculator.compute({
      curationAccuracyBp: 10000,
      contentQualityBp: 10000,
      communityContributionsBp: 10000,
      slashingEventsBp: 0,
    });
    const expected = Math.floor((10000 * 4000 + 10000 * 3000 + 10000 * 2000) / 10000);
    expect(score.overallBp).toBe(expected);
  });

  it("aggregates slashing events", () => {
    const total = calculator.aggregateSlashing([
      { curatorAddress: "a", promptCid: "p1", amountBp: 1000, reason: "bad rating", timestamp: Date.now() },
      { curatorAddress: "b", promptCid: "p2", amountBp: 2000, reason: "spam", timestamp: Date.now() },
    ]);
    expect(total).toBe(3000);
  });

  it("caps slashing at 100%", () => {
    const total = calculator.aggregateSlashing([
      { curatorAddress: "a", promptCid: "p1", amountBp: 8000, reason: "x", timestamp: Date.now() },
      { curatorAddress: "b", promptCid: "p2", amountBp: 8000, reason: "y", timestamp: Date.now() },
    ]);
    expect(total).toBe(BPS_DENOMINATOR);
  });

  it("applies decay over time", () => {
    const decayed = calculator.decayScore(10000, 90);
    expect(decayed).toBeLessThan(10000);
    expect(decayed).toBeGreaterThan(0);
  });

  it("does not decay when daysSince is 0", () => {
    const decayed = calculator.decayScore(5000, 0);
    expect(decayed).toBe(5000);
  });

  it("returns empty score for empty array in compare", () => {
    const avg = calculator.compare([]);
    expect(avg.overallBp).toBe(0);
  });

  it("averages multiple scores in compare", () => {
    const scores: ReputationScore[] = [
      calculator.compute({ curationAccuracyBp: 8000, contentQualityBp: 6000, communityContributionsBp: 4000, slashingEventsBp: 0 }),
      calculator.compute({ curationAccuracyBp: 6000, contentQualityBp: 4000, communityContributionsBp: 2000, slashingEventsBp: 0 }),
    ];
    const avg = calculator.compare(scores);
    expect(avg.curationAccuracyBp).toBe(7000);
    expect(avg.contentQualityBp).toBe(5000);
  });
});

describe("VerifiableCredentialManager", () => {
  const manager = new VerifiableCredentialManager();

  it("creates a verifiable credential", () => {
    const vc = manager.createCredential(
      "subjectWallet",
      "issuerWallet",
      "PromptChainReputation",
      { overallScoreBp: 8500, curationAccuracyBp: 7200 },
    );
    expect(vc["@context"]).toContain("https://www.w3.org/2018/credentials/v1");
    expect(vc.type).toContain("PromptChainReputation");
    expect(vc.issuer).toBe("issuerWallet");
    expect(vc.credentialSubject.id).toBe("subjectWallet");
    expect(vc.credentialSubject.overallScoreBp).toBe(8500);
    expect(vc.expirationDate).toBeTruthy();
  });

  it("creates credential without expiry for types that don't expire", () => {
    const vc = manager.createCredential(
      "subject",
      "issuer",
      "PromptChainCreator",
      { totalPrompts: 10 },
    );
    expect(vc.expirationDate).toBeUndefined();
  });

  it("signs a credential", () => {
    const vc = manager.createCredential("sub", "issuer", "PromptChainCommunityMember", { joinedAt: Date.now() });
    const signed = manager.signCredential(vc, "issuer");
    expect(signed.proof).toBeDefined();
    expect(signed.proof!.type).toBe("PromptChainSignature");
    expect(signed.proof!.signature).toBeTruthy();
  });

  it("verifies a valid signed credential", () => {
    const vc = manager.createCredential("sub", "issuer", "PromptChainCurator", { stakeAmount: "100" });
    const signed = manager.signCredential(vc, "issuer");
    expect(manager.verifyCredential(signed)).toBe(true);
  });

  it("fails verification for unsigned credential", () => {
    const vc = manager.createCredential("sub", "issuer", "PromptChainCurator", {});
    expect(manager.verifyCredential(vc)).toBe(false);
  });

  it("rejects credential with wrong issuer", () => {
    const vc = manager.createCredential("sub", "issuerA", "PromptChainCurator", {});
    const signed = manager.signCredential(vc, "issuerA");
    expect(manager.verifyCredentialWithIssuer(signed, "issuerB")).toBe(false);
  });

  it("detects expired credential", () => {
    const vc = manager.createCredential("sub", "issuer", "PromptChainCurator", {}, -1);
    expect(manager.isExpired(vc)).toBe(true);
  });

  it("returns days until expiry", () => {
    const vc = manager.createCredential("sub", "issuer", "PromptChainReputation", { overallScoreBp: 5000 });
    const days = manager.daysUntilExpiry(vc);
    expect(days).toBeGreaterThan(0);
  });

  it("returns null daysUntilExpiry when no expiry", () => {
    const vc = manager.createCredential("sub", "issuer", "PromptChainCreator", {});
    expect(manager.daysUntilExpiry(vc)).toBeNull();
  });

  it("gets credential type", () => {
    const vc = manager.createCredential("sub", "issuer", "PromptChainModerator", {});
    expect(manager.getCredentialType(vc)).toBe("PromptChainModerator");
  });

  it("revokes credential by setting expiry to epoch 0", () => {
    const vc = manager.createCredential("sub", "issuer", "PromptChainCurator", {});
    const revoked = manager.revokeCredential(vc);
    expect(manager.isExpired(revoked)).toBe(true);
  });

  it("throws for unknown credential type", () => {
    expect(() =>
      manager.createCredential("sub", "issuer", "UnknownType" as any, {}),
    ).toThrow();
  });

  it("has all credential templates defined", () => {
    const types = Object.keys(CREDENTIAL_TEMPLATES);
    expect(types).toContain("PromptChainReputation");
    expect(types).toContain("PromptChainCurator");
    expect(types).toContain("PromptChainCreator");
    expect(types).toContain("PromptChainVerifiedResearcher");
    expect(types).toContain("PromptChainCommunityMember");
    expect(types).toContain("PromptChainTranslationDAO");
    expect(types).toContain("PromptChainModerator");
  });
});

describe("SoulboundRegistry", () => {
  const registry = new SoulboundRegistry();

  it("issues a soulbound attestation", () => {
    const a = registry.issueAttestation("subject1", "issuer1", "PromptChainCurator", { stakeAmount: 1000 });
    expect(a.subject).toBe("subject1");
    expect(a.issuer).toBe("issuer1");
    expect(a.credentialType).toBe("PromptChainCurator");
    expect(a.revoked).toBe(false);
    expect(a.proof).toBeTruthy();
  });

  it("verifies a valid attestation", () => {
    const a = registry.issueAttestation("subject2", "issuer2", "PromptChainCreator", { totalPrompts: 5 });
    expect(registry.verifyAttestation(a.id)).toBe(true);
  });

  it("revokes an attestation", () => {
    const a = registry.issueAttestation("subject3", "issuer3", "PromptChainModerator", {});
    expect(registry.revokeAttestation(a.id, "misconduct")).toBe(true);
    expect(registry.verifyAttestation(a.id)).toBe(false);
    expect(registry.getAttestation(a.id)!.revokedReason).toBe("misconduct");
  });

  it("fails to revoke already revoked attestation", () => {
    const a = registry.issueAttestation("subject4", "issuer4", "PromptChainCurator", {});
    registry.revokeAttestation(a.id);
    expect(registry.revokeAttestation(a.id)).toBe(false);
  });

  it("returns attestations by subject", () => {
    const s = "subject-list";
    registry.issueAttestation(s, "issuer", "PromptChainCurator", {});
    registry.issueAttestation(s, "issuer2", "PromptChainCreator", {});
    const attestations = registry.getAttestationsBySubject(s);
    expect(attestations.length).toBe(2);
  });

  it("filters active attestations", () => {
    const s = "subject-active";
    const a1 = registry.issueAttestation(s, "issuer", "PromptChainCurator", {});
    const a2 = registry.issueAttestation(s, "issuer", "PromptChainCreator", {});
    registry.revokeAttestation(a2.id);
    const active = registry.getActiveAttestationsBySubject(s);
    expect(active.length).toBe(1);
    expect(active[0].id).toBe(a1.id);
  });

  it("checks subject verification by type", () => {
    const s = "subject-verify";
    registry.issueAttestation(s, "issuer", "PromptChainModerator", {});
    expect(registry.isSubjectVerified(s, "PromptChainModerator")).toBe(true);
    expect(registry.isSubjectVerified(s, "PromptChainCurator")).toBe(false);
  });

  it("handles expired attestations", () => {
    const s = "subject-expired";
    const a = registry.issueAttestation(s, "issuer", "PromptChainCurator", {}, -1);
    expect(registry.verifyAttestation(a.id)).toBe(false);
  });

  it("returns all attestations count", () => {
    const count = registry.getAttestationCount();
    expect(count).toBeGreaterThan(0);
  });

  it("exports and imports state", () => {
    const reg1 = new SoulboundRegistry();
    reg1.issueAttestation("sub-export", "issuer", "PromptChainCurator", { x: 1 });
    const state = reg1.exportState();

    const reg2 = new SoulboundRegistry();
    reg2.importState(state);
    expect(reg2.getAttestationCount()).toBe(1);
    expect(reg2.getAttestationsBySubject("sub-export").length).toBe(1);
  });
});

describe("DelegatedIdentityManager", () => {
  const manager = new DelegatedIdentityManager();

  it("delegates permissions from cold to hot wallet", () => {
    const config = manager.delegate("cold1", "hot1", ["publish", "rate"], 30);
    expect(config.coldWallet).toBe("cold1");
    expect(config.hotWallet).toBe("hot1");
    expect(config.permissions).toEqual(["publish", "rate"]);
    expect(config.expiresAt).toBeGreaterThan(Date.now());
  });

  it("verifies granted permission", () => {
    manager.delegate("cold2", "hot2", ["publish"], 30);
    expect(manager.verifyPermission("cold2", "hot2", "publish")).toBe(true);
    expect(manager.verifyPermission("cold2", "hot2", "rate")).toBe(false);
  });

  it("all permission grants all", () => {
    manager.delegate("cold-all", "hot-all", ["all"]);
    expect(manager.verifyPermission("cold-all", "hot-all", "publish")).toBe(true);
    expect(manager.verifyPermission("cold-all", "hot-all", "transfer")).toBe(true);
  });

  it("revokes delegation", () => {
    manager.delegate("cold-revoke", "hot-revoke", ["publish"]);
    expect(manager.revokeDelegation("cold-revoke", "hot-revoke")).toBe(true);
    expect(manager.verifyPermission("cold-revoke", "hot-revoke", "publish")).toBe(false);
  });

  it("fails to revoke non-existent delegation", () => {
    expect(manager.revokeDelegation("nonexistent", "hot")).toBe(false);
  });

  it("enforces max delegations", () => {
    const hotWallets = Array.from({ length: DEFAULT_IDENTITY_CONSTANTS.MAX_DELEGATIONS_PER_WALLET }, (_, i) => `hot-${i}`);
    for (const hw of hotWallets) {
      manager.delegate("cold-max", hw, ["publish"]);
    }
    expect(() => manager.delegate("cold-max", "hot-overflow", ["publish"])).toThrow();
  });

  it("enforces max expiry", () => {
    expect(() => manager.delegate("cold-expiry", "hot-expiry", ["publish"], 9999)).toThrow();
  });

  it("rejects expired delegation", () => {
    manager.delegate("cold-expired", "hot-expired", ["publish"], -1);
    expect(manager.verifyPermission("cold-expired", "hot-expired", "publish")).toBe(false);
  });

  it("gets active delegations", () => {
    manager.delegate("cold-active", "hot-active-1", ["publish"]);
    manager.delegate("cold-active", "hot-active-2", ["rate"]);
    const active = manager.getActiveDelegations("cold-active");
    expect(active.length).toBe(2);
  });

  it("logs delegated actions", () => {
    manager.delegate("cold-log", "hot-log", ["publish"]);
    const log = manager.logAction("cold-log", "hot-log", "publish", "prompt123");
    expect(log.action).toBe("publish");
    expect(log.hotWallet).toBe("hot-log");
    expect(log.signature).toBeTruthy();
  });

  it("verifies action log", () => {
    const log = manager.logAction("cold-verify", "hot-verify", "rate", "prompt456");
    expect(manager.verifyActionLog(log, "cold-verify")).toBe(true);
    expect(manager.verifyActionLog(log, "wrong-cold")).toBe(false);
  });

  it("gets action logs filtered by wallet", () => {
    const logs = manager.getActionLogs("hot-verify");
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.every((l) => l.hotWallet === "hot-verify")).toBe(true);
  });

  it("exports and imports state", () => {
    const m1 = new DelegatedIdentityManager();
    m1.delegate("cold-export", "hot-export", ["publish"]);
    m1.logAction("cold-export", "hot-export", "publish", "target1");
    const state = m1.exportState();

    const m2 = new DelegatedIdentityManager();
    m2.importState(state);
    expect(m2.getActiveDelegations("cold-export").length).toBe(1);
    expect(m2.getActionLogs().length).toBeGreaterThanOrEqual(1);
  });
});
