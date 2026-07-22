import { PromptFs } from "@promptchain/storage";
import { PromptChainClient } from "@promptchain/client";
import { getProvider } from "../index";

export async function mountCommand(
  directory: string,
  options: {
    keypair?: string;
    rpcUrl: string;
    sample: boolean;
    sync: boolean;
  },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const client = new PromptChainClient(provider);
    const authority = provider.wallet.publicKey;

    const fs = new PromptFs(directory);

    fs.on("mounted", (path) => {
      console.log(`PromptFS mounted at ${path}`);
    });

    fs.on("sync-complete", (result) => {
      console.log(
        `Auto-sync: ${result.published} published, ${result.skipped} skipped`,
      );
    });

    fs.on("sync-error", (err) => {
      console.error("Sync error:", err);
    });

    await fs.mount(client, authority, {
      createSampleOnInit: options.sample,
      autoSync: options.sync,
      syncIntervalMs: 30000,
    });

    const tree = await fs.getTree();
    console.log(`\nPromptFS contents (${tree.length} entries):`);
    for (const entry of tree) {
      const type = entry.isDirectory ? "📁" : entry.isPrompt ? "📝" : "📄";
      console.log(`  ${type} ${entry.path}`);
    }

    console.log("\nPromptFS is running. Press Ctrl+C to unmount.");
    console.log(`Directory: ${directory}`);

    process.on("SIGINT", async () => {
      console.log("\nUnmounting PromptFS...");
      await fs.unmount();
      process.exit(0);
    });

    await new Promise(() => {});
  } catch (err) {
    console.error("Failed to mount:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
