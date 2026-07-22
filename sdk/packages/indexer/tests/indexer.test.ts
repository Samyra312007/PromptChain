import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { PromptSearchIndex } from "../src/index";

describe("PromptSearchIndex", () => {
  it("starts with zero entries", () => {
    const index = new PromptSearchIndex({} as never, {} as never, {} as never);
    expect(index.getEntryCount()).toBe(0);
  });

  it("search on empty index returns zero results", () => {
    const index = new PromptSearchIndex({} as never, {} as never, {} as never);
    const results = index.search({ text: "test" });
    expect(results.total).toBe(0);
    expect(results.entries.length).toBe(0);
  });

  it("search with no query returns all entries", async () => {
    const index = new PromptSearchIndex({} as never, {} as never, {} as never);
    const pubkey = new PublicKey("D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F");

    await index.indexPrompt(pubkey, {
      authority: PublicKey.default,
      originalAuthority: PublicKey.default,
      ipfsCid: "QmTest123",
      metadataUri: "",
      license: PublicKey.default,
      totalVersions: 1,
      totalUses: new BN(0),
      bump: 255,
    });

    expect(index.getEntryCount()).toBe(1);

    const results = index.search({});
    expect(results.total).toBe(1);
  });

  it("computeMerkleRoot returns consistent root for same data", async () => {
    const index = new PromptSearchIndex({} as never, {} as never, {} as never);
    const pubkey = new PublicKey("D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F");

    await index.indexPrompt(pubkey, {
      authority: PublicKey.default,
      originalAuthority: PublicKey.default,
      ipfsCid: "QmTest123",
      metadataUri: "",
      license: PublicKey.default,
      totalVersions: 1,
      totalUses: new BN(0),
      bump: 255,
    });

    const root1 = await index.computeMerkleRoot();
    const root2 = await index.computeMerkleRoot();
    expect(root1).toEqual(root2);
  });

  it("removeFromIndex removes entry", async () => {
    const index = new PromptSearchIndex({} as never, {} as never, {} as never);
    const pubkey = new PublicKey("D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F");

    await index.indexPrompt(pubkey, {
      authority: PublicKey.default,
      originalAuthority: PublicKey.default,
      ipfsCid: "QmTest123",
      metadataUri: "",
      license: PublicKey.default,
      totalVersions: 1,
      totalUses: new BN(0),
      bump: 255,
    });

    expect(index.getEntryCount()).toBe(1);
    index.removeFromIndex(pubkey);
    expect(index.getEntryCount()).toBe(0);
  });
});
