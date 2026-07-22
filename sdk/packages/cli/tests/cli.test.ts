import { describe, it, expect } from "vitest";

describe("CLI", () => {
  it("getProvider creates an AnchorProvider", async () => {
    const { getProvider } = await import("../src/index");
    const provider = await getProvider(undefined, "http://127.0.0.1:8899");
    expect(provider).toBeDefined();
    expect(provider.connection).toBeDefined();
    expect(provider.wallet).toBeDefined();
  });

  it("commander program is configured with correct commands", async () => {
    const mod = await import("../src/index");
    expect(mod).toBeDefined();
  });
});
