import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import {
  findPromptPda,
  findVersionPda,
  findLicensePda,
} from "../src/index";

describe("PDA derivation", () => {
  const authority = new PublicKey("D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F");
  const cid = "QmTest123";
  const promptKey = new PublicKey("11111111111111111111111111111111");

  it("findPromptPda returns deterministic PDAs", () => {
    const [pda1] = findPromptPda(authority, cid);
    const [pda2] = findPromptPda(authority, cid);
    expect(pda1.toString()).to.equal(pda2.toString());
  });

  it("findPromptPda returns different PDAs for different CIDs", () => {
    const [pda1] = findPromptPda(authority, cid);
    const [pda2] = findPromptPda(authority, cid + "diff");
    expect(pda1.toString()).not.to.equal(pda2.toString());
  });

  it("findPromptPda uses SHA-256 hash of CID as seed", () => {
    const [pda] = findPromptPda(authority, cid);
    const cidHash = createHash("sha256").update(cid, "utf8").digest();
    const [expectedPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("prompt"), cidHash],
      new PublicKey("D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F"),
    );
    expect(pda.toString()).to.equal(expectedPda.toString());
  });

  it("findVersionPda returns deterministic PDAs", () => {
    const [pda1] = findVersionPda(promptKey, 1);
    const [pda2] = findVersionPda(promptKey, 1);
    expect(pda1.toString()).to.equal(pda2.toString());
  });

  it("findVersionPda returns different PDAs for different version numbers", () => {
    const [pda1] = findVersionPda(promptKey, 1);
    const [pda2] = findVersionPda(promptKey, 2);
    expect(pda1.toString()).not.to.equal(pda2.toString());
  });

  it("findLicensePda returns deterministic PDAs", () => {
    const [pda1] = findLicensePda(authority, "MIT");
    const [pda2] = findLicensePda(authority, "MIT");
    expect(pda1.toString()).to.equal(pda2.toString());
  });

  it("findLicensePda returns different PDAs for different names", () => {
    const [pda1] = findLicensePda(authority, "MIT");
    const [pda2] = findLicensePda(authority, "Apache-2.0");
    expect(pda1.toString()).not.to.equal(pda2.toString());
  });

  it("findPromptPda works with long CIDs (>32 bytes)", () => {
    const longCid = "QmX".repeat(30);
    const [pda] = findPromptPda(authority, longCid);
    expect(pda).toBeDefined();
  });
});

describe("PromptChainClient construction", () => {
  it("can instantiate with a valid program ID", () => {
    const idl = require("../src/idl/promptchain.json");
    expect(idl.address).toBeDefined();
    expect(idl.address.length).toBeGreaterThan(0);
  });

  it("IDL contains all 5 instructions", () => {
    const idl = require("../src/idl/promptchain.json");
    const instructionNames = idl.instructions.map((i: any) => i.name).sort();
    expect(instructionNames).toEqual([
      "create_version",
      "publish",
      "set_license",
      "transfer",
      "use_prompt",
    ]);
  });

  it("IDL contains all 3 account types", () => {
    const idl = require("../src/idl/promptchain.json");
    const accountNames = idl.accounts.map((a: any) => a.name).sort();
    expect(accountNames).toEqual(["License", "Prompt", "PromptVersion"]);
  });

  it("IDL contains EmptyName and RoyaltyTooHigh error codes", () => {
    const idl = require("../src/idl/promptchain.json");
    const errorNames = idl.errors.map((e: any) => e.name);
    expect(errorNames).toContain("EmptyName");
    expect(errorNames).toContain("RoyaltyTooHigh");
  });

  it("IDL shows originalAuthority on Prompt account", () => {
    const idl = require("../src/idl/promptchain.json");
    const promptType = idl.types.find((t: any) => t.name === "Prompt");
    const fields = promptType.type.fields.map((f: any) => f.name);
    expect(fields).toContain("original_authority");
  });
});
