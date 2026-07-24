import { PublicKey } from "@solana/web3.js";
import { PromptChainClient } from "@promptchain/client";
import { getProvider } from "../index";
import { getCliI18n } from "@promptchain/i18n/cli-i18n";

export async function listCommand(
  authority?: string,
  options: { keypair?: string; rpcUrl: string },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const client = new PromptChainClient(provider);
    const i18n = getCliI18n();

    const authPubkey = authority
      ? new PublicKey(authority)
      : provider.wallet.publicKey;

    const prompts = await client.fetchPromptsByAuthority(authPubkey);

    if (prompts.length === 0) {
      console.log(i18n.t("cli.list.empty"));
      return;
    }

    console.log(i18n.t("cli.list.header", { authority: authPubkey.toBase58() }));
    for (const p of prompts) {
      const meta = p.account as any;
      console.log(
        i18n.t("cli.list.entry", {
          category: meta.ipfsCid?.slice(0, 8) || "unknown",
          name: p.publicKey.toBase58().slice(0, 12),
          cid: meta.ipfsCid?.slice(0, 16) || "unknown",
          uses: String(meta.totalUses ?? 0),
        }),
      );
    }
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
