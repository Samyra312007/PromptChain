import { PublicKey } from "@solana/web3.js";
import { PromptChainClient } from "@promptchain/client";
import { getProvider } from "../index";

export async function publishCommand(
  file: string,
  options: { keypair?: string; rpcUrl: string; license?: string },
): Promise<void> {
  try {
    const { readPromptFile, computeCid } = await import("@promptchain/storage");

    const provider = await getProvider(options.keypair, options.rpcUrl);
    const client = new PromptChainClient(provider);
    const authority = provider.wallet.publicKey;

    const promptFile = await readPromptFile(file);
    const cid = computeCid(promptFile.promptText);

    const metadataUri = `file://${file}`;

    const license = options.license ? new PublicKey(options.license) : undefined;

    const sig = await client.publish({
      authority,
      cid,
      metadataUri,
      license,
    });

    const promptPda = (
      await import("@promptchain/client")
    ).findPromptPda(authority, cid);

    console.log("Published prompt!");
    console.log("  CID:", cid);
    console.log("  Prompt PDA:", promptPda[0].toBase58());
    console.log("  Signature:", sig);
    console.log("  Name:", promptFile.metadata.name);
    console.log("  Category:", promptFile.metadata.category);
  } catch (err) {
    console.error("Failed to publish:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
