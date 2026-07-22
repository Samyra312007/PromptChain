import { PublicKey } from "@solana/web3.js";
import { writeFile } from "fs/promises";
import { PromptChainClient } from "@promptchain/client";
import { getProvider } from "../index";

export async function getCommand(
  address: string,
  options: { rpcUrl: string; output?: string },
): Promise<void> {
  try {
    const provider = await getProvider(undefined, options.rpcUrl);
    const client = new PromptChainClient(provider);
    const promptAddress = new PublicKey(address);

    const prompt = await client.fetchPrompt(promptAddress);

    console.log("Prompt details:");
    console.log("  Address:      ", promptAddress.toBase58());
    console.log("  Authority:    ", prompt.authority.toBase58());
    console.log("  Original Auth:", prompt.originalAuthority.toBase58());
    console.log("  CID:          ", prompt.ipfsCid);
    console.log("  Metadata URI: ", prompt.metadataUri);
    console.log("  License:      ", prompt.license.toBase58());
    console.log("  Total Versions:", prompt.totalVersions);
    console.log("  Total Uses:   ", prompt.totalUses.toString());

    if (options.output) {
      const output = JSON.stringify(
        {
          address: promptAddress.toBase58(),
          ...prompt,
        },
        null,
        2,
      );
      await writeFile(options.output, output, "utf8");
      console.log(`\nOutput written to ${options.output}`);
    }
  } catch (err) {
    console.error("Failed to get prompt:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
