import { PublicKey } from "@solana/web3.js";
import { PromptChainClient } from "@promptchain/client";
import { getProvider } from "../index";
import { getCliI18n } from "@promptchain/i18n/cli-i18n";

export async function publishCommand(
  file: string,
  options: { keypair?: string; rpcUrl: string; license?: string },
): Promise<void> {
  try {
    const { readPromptFile, computeCid } = await import("@promptchain/storage");
    const i18n = getCliI18n();

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

    console.log(i18n.t("cli.publish.success", { cid }));
    console.log("  Name:", promptFile.metadata.name);
    console.log("  Category:", promptFile.metadata.category);
    console.log("  Signature:", sig);
  } catch (err) {
    const i18n = getCliI18n();
    console.error(i18n.t("cli.publish.error", { error: err instanceof Error ? err.message : String(err) }));
    process.exit(1);
  }
}
