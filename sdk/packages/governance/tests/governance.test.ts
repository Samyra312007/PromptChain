import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  findDaoConfigPda,
  findMemberPda,
  findProposalPda,
  findVotePda,
} from "../src/index";

describe("GovernanceClient PDA derivation", () => {
  const authority = new PublicKey("D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F");
  const daoConfig = new PublicKey("HvNzxKHRDNHMqeYRv5GPo2oV5fQABRPVLZMFMBE73tvu");
  const proposal = new PublicKey("8mNqGqRJSkix3yCskAQBfTBhTyWMzYGMFmnfsEiyZnJU");

  it("findDaoConfigPda returns deterministic PDAs", () => {
    const [pda1] = findDaoConfigPda();
    const [pda2] = findDaoConfigPda();
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findMemberPda returns deterministic PDAs", () => {
    const [pda1] = findMemberPda(authority);
    const [pda2] = findMemberPda(authority);
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findMemberPda returns different PDAs for different authorities", () => {
    const other = PublicKey.unique();
    const [pda1] = findMemberPda(authority);
    const [pda2] = findMemberPda(other);
    expect(pda1.toString()).not.toBe(pda2.toString());
  });

  it("findProposalPda returns deterministic PDAs", () => {
    const [pda1] = findProposalPda(daoConfig, new BN(0));
    const [pda2] = findProposalPda(daoConfig, new BN(0));
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findProposalPda returns different PDAs for different proposal IDs", () => {
    const [pda1] = findProposalPda(daoConfig, new BN(0));
    const [pda2] = findProposalPda(daoConfig, new BN(1));
    expect(pda1.toString()).not.toBe(pda2.toString());
  });

  it("findProposalPda returns different PDAs for different DAO configs", () => {
    const otherDao = PublicKey.unique();
    const [pda1] = findProposalPda(daoConfig, new BN(0));
    const [pda2] = findProposalPda(otherDao, new BN(0));
    expect(pda1.toString()).not.toBe(pda2.toString());
  });

  it("findVotePda returns deterministic PDAs", () => {
    const [pda1] = findVotePda(authority, proposal);
    const [pda2] = findVotePda(authority, proposal);
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("findVotePda returns different PDAs for different voters", () => {
    const otherVoter = PublicKey.unique();
    const [pda1] = findVotePda(authority, proposal);
    const [pda2] = findVotePda(otherVoter, proposal);
    expect(pda1.toString()).not.toBe(pda2.toString());
  });
});
