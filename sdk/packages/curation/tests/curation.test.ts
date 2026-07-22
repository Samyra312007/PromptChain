import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  findCuratorPda,
  findRatingPda,
  findPromptCurationPda,
  findReputationPda,
  findIndexCommitmentPda,
  computeDecayedWeight,
} from "../src/index";

describe("CurationClient PDA derivation", () => {
  const authority = new PublicKey("D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F");
  const prompt = new PublicKey("2eWqZR6HriWjKJs5MozSZKERxP98JM7FEwn8FA7Hh1cK");

  it("findCuratorPda returns deterministic PDAs", () => {
    const [pda1] = findCuratorPda(authority);
    const [pda2] = findCuratorPda(authority);
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findCuratorPda returns different PDAs for different authorities", () => {
    const otherAuth = PublicKey.unique();
    const [pda1] = findCuratorPda(authority);
    const [pda2] = findCuratorPda(otherAuth);
    expect(pda1.toString()).not.toBe(pda2.toString());
  });

  it("findRatingPda returns deterministic PDAs", () => {
    const [curatorPda] = findCuratorPda(authority);
    const [pda1] = findRatingPda(curatorPda, prompt);
    const [pda2] = findRatingPda(curatorPda, prompt);
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findPromptCurationPda returns deterministic PDAs", () => {
    const [pda1] = findPromptCurationPda(prompt);
    const [pda2] = findPromptCurationPda(prompt);
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findReputationPda returns deterministic PDAs", () => {
    const [pda1] = findReputationPda(authority);
    const [pda2] = findReputationPda(authority);
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findIndexCommitmentPda returns deterministic PDAs", () => {
    const epoch = new BN(42);
    const [pda1] = findIndexCommitmentPda(epoch);
    const [pda2] = findIndexCommitmentPda(epoch);
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findIndexCommitmentPda returns different PDAs for different epochs", () => {
    const [pda1] = findIndexCommitmentPda(new BN(1));
    const [pda2] = findIndexCommitmentPda(new BN(2));
    expect(pda1.toString()).not.toBe(pda2.toString());
  });
});

describe("computeDecayedWeight", () => {
  it("returns full weight when no time has elapsed", () => {
    const weight = computeDecayedWeight(
      new BN(1_000_000_000),
      new BN(1000),
      new BN(1000),
    );
    expect(weight.toNumber()).toBe(1_000_000_000);
  });

  it("returns less weight after half-life", () => {
    const weight = computeDecayedWeight(
      new BN(1_000_000_000),
      new BN(1000),
      new BN(1000 + 19_440_000),
    );
    expect(weight.toNumber()).toBeLessThan(1_000_000_000);
    expect(weight.toNumber()).toBeGreaterThan(0);
  });

  it("returns zero after 64 halvings", () => {
    const weight = computeDecayedWeight(
      new BN(1_000_000_000),
      new BN(1000),
      new BN(1000 + 19_440_000 * 64),
    );
    expect(weight.toNumber()).toBe(0);
  });
});
