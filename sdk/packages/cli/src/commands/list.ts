import { PublicKey } from "@solana/web3.js";
import { PromptChainClient } from "@promptchain/client";
import { getProvider } from "../index";

export async function listCommand(
  authorityStr: string | undefined,
  options: { keypair?: string; rpcUrl: string },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const client = new PromptChainClient(provider);
    const authority = authorityStr
      ? new PublicKey(authorityStr)
      : provider.wallet.publicKey;

    const prompts = await client.fetchPromptsByAuthority(authority);

    if (prompts.length === 0) {
      console.log("No prompts found for authority:", authority.toBase58());
      return;
    }

    console.log(`Found ${prompts.length} prompt(s) for ${authority.toBase58()}:\n`);
    for (const p of prompts) {
      console.log(`  Address: ${p.publicKey.toBase58()}`);
      console.log(`  CID:     ${p.account.ipfsCid}`);
      console.log(`  Versions: ${p.account.totalVersions}`);
      console.log(`  Uses:     ${p.account.totalUses.toString()}`);
      console.log(`  License:  ${p.account.license.toBase58()}`);
      console.log();
    }
  } catch (err) {
    console.error("Failed to list prompts:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
