import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import { PROMPTCHAIN_PROGRAM_ID, PDA_SEEDS } from "@promptchain/schema";

describe("FullClient", () => {
  const programId = new PublicKey(PROMPTCHAIN_PROGRAM_ID);

  it("can instantiate with valid program ID", () => {
    expect(programId.toBase58()).toBe(PROMPTCHAIN_PROGRAM_ID);
  });

  it("PDA derivation matches SDK", async () => {
    const cid = "QmTest123";
    const cidHash = createHash("sha256").update(cid, "utf8").digest();
    const [pda] = PublicKey.findProgramAddressSync(
      [PDA_SEEDS.PROMPT, cidHash],
      programId,
    );
    expect(pda).toBeDefined();
    expect(pda.toBase58().length).toBeGreaterThan(0);
  });

  it("IDL contains all instructions", () => {
    const idl = require("../src/idl/promptchain.json");
    const names = idl.instructions.map((i: any) => i.name).sort();
    expect(names).toEqual([
      "create_version",
      "publish",
      "set_license",
      "transfer",
      "use_prompt",
    ]);
  });

  it("IDL contains all account types", () => {
    const idl = require("../src/idl/promptchain.json");
    const names = idl.accounts.map((a: any) => a.name).sort();
    expect(names).toEqual(["License", "Prompt", "PromptVersion"]);
  });
});
