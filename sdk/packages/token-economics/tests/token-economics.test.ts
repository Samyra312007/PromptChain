import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  findTokenConfigPda,
  findTokenMintPda,
  findEcosystemFundPda,
  findCreatorRewardPoolPda,
  findCuratorRewardPoolPda,
  findStakePositionPda,
  findStakeVaultPda,
  findVestingPda,
  findCreatorRewardClaimPda,
  findCuratorRewardClaimPda,
} from "../src/index";

describe("TokenEconomicsClient PDA derivation", () => {
  const authority = new PublicKey("D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F");
  const other = new PublicKey("2eWqZR6HriWjKJs5MozSZKERxP98JM7FEwn8FA7Hh1cK");
  const beneficiary = new PublicKey("8mNqGqRJSkix3yCskAQBfTBhTyWMzYGMFmnfsEiyZnJU");

  it("findTokenConfigPda returns deterministic PDAs", () => {
    const [pda1] = findTokenConfigPda();
    const [pda2] = findTokenConfigPda();
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findTokenMintPda returns deterministic PDAs", () => {
    const [pda1] = findTokenMintPda();
    const [pda2] = findTokenMintPda();
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findEcosystemFundPda returns deterministic PDAs", () => {
    const [pda1] = findEcosystemFundPda();
    const [pda2] = findEcosystemFundPda();
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findCreatorRewardPoolPda returns deterministic PDAs", () => {
    const [pda1] = findCreatorRewardPoolPda();
    const [pda2] = findCreatorRewardPoolPda();
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findCuratorRewardPoolPda returns deterministic PDAs", () => {
    const [pda1] = findCuratorRewardPoolPda();
    const [pda2] = findCuratorRewardPoolPda();
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findStakePositionPda returns deterministic PDAs", () => {
    const [pda1] = findStakePositionPda(authority);
    const [pda2] = findStakePositionPda(authority);
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findStakePositionPda returns different PDAs for different authorities", () => {
    const [pda1] = findStakePositionPda(authority);
    const [pda2] = findStakePositionPda(other);
    expect(pda1.toString()).not.toBe(pda2.toString());
  });

  it("findVestingPda returns deterministic PDAs", () => {
    const [pda1] = findVestingPda(beneficiary);
    const [pda2] = findVestingPda(beneficiary);
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findVestingPda returns different PDAs for different beneficiaries", () => {
    const [pda1] = findVestingPda(beneficiary);
    const [pda2] = findVestingPda(other);
    expect(pda1.toString()).not.toBe(pda2.toString());
  });

  it("findCreatorRewardClaimPda returns deterministic PDAs", () => {
    const [pda1] = findCreatorRewardClaimPda(authority);
    const [pda2] = findCreatorRewardClaimPda(authority);
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findCuratorRewardClaimPda returns deterministic PDAs", () => {
    const [pda1] = findCuratorRewardClaimPda(authority);
    const [pda2] = findCuratorRewardClaimPda(authority);
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findCreatorRewardClaimPda differs from findCuratorRewardClaimPda", () => {
    const [creatorPda] = findCreatorRewardClaimPda(authority);
    const [curatorPda] = findCuratorRewardClaimPda(authority);
    expect(creatorPda.toString()).not.toBe(curatorPda.toString());
  });

  it("findStakeVaultPda returns deterministic PDAs", () => {
    const [pda1] = findStakeVaultPda();
    const [pda2] = findStakeVaultPda();
    expect(pda1.toString()).toBe(pda2.toString());
  });
});
