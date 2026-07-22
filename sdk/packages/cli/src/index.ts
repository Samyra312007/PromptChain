#!/usr/bin/env node
import { Command } from "commander";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PromptChainClient } from "@promptchain/client";
import { readFile, writeFile, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { publishCommand } from "./commands/publish";
import { listCommand } from "./commands/list";
import { getCommand } from "./commands/get";
import { mountCommand } from "./commands/mount";
import { licenseCommand } from "./commands/license";

const program = new Command();

program
  .name("promptchain")
  .description("PromptChain CLI - manage AI prompts on Solana")
  .version("0.1.0");

program
  .command("publish")
  .description("Publish a prompt file to the blockchain")
  .argument("<file>", "Path to .prompt file")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .option("-l, --license <pubkey>", "License public key to attach")
  .action(publishCommand);

program
  .command("list")
  .description("List prompts owned by a wallet")
  .argument("[authority]", "Wallet public key (defaults to keypair)")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(listCommand);

program
  .command("get")
  .description("Get prompt details by address")
  .argument("<address>", "Prompt account public key")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .option("-o, --output <file>", "Output file for prompt text")
  .action(getCommand);

program
  .command("mount")
  .description("Mount PromptFS virtual filesystem")
  .argument("<directory>", "Mount point directory")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .option("--sample", "Create sample prompt structure", false)
  .option("--sync", "Enable auto-sync to blockchain", false)
  .action(mountCommand);

program
  .command("license")
  .description("Create or list licenses")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(licenseCommand);

program
  .command("init")
  .description("Initialize a new PromptFS directory")
  .argument("[directory]", "Directory to initialize", ".")
  .action(async (directory: string) => {
    const { PromptFs } = await import("@promptchain/storage");
    const fs = new PromptFs(directory);
    await fs.mount(undefined, undefined, { createSampleOnInit: true });
    console.log(`Initialized PromptFS at ${directory}`);
    console.log("Sample prompts created in subdirectories.");
    process.exit(0);
  });

program
  .command("sync")
  .description("Sync local prompt files to blockchain")
  .argument("[directory]", "Directory to sync", ".")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(async (directory: string, options: { keypair?: string; rpcUrl: string }) => {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const client = new PromptChainClient(provider);
    const authority = provider.wallet.publicKey;
    const { PromptFs } = await import("@promptchain/storage");
    const fs = new PromptFs(directory);
    await fs.mount(client, authority);
    const result = await fs.syncAll();
    console.log(`Sync complete: ${result.published} published, ${result.skipped} skipped`);
    if (result.errors.length > 0) {
      console.error("Errors:", result.errors);
    }
    process.exit(0);
  });

program
  .command("gc")
  .description("Garbage collect prompt files")
  .argument("[directory]", "Directory to clean", ".")
  .option("--dry-run", "Show what would be removed", false)
  .option("--remove-orphans", "Remove orphaned .meta.json files", true)
  .option("--remove-empty-dirs", "Remove empty directories", true)
  .action(async (directory: string, options: { dryRun: boolean; removeOrphans: boolean; removeEmptyDirs: boolean }) => {
    const { garbageCollect } = await import("@promptchain/storage");
    const result = await garbageCollect(directory, {
      dryRun: options.dryRun,
      removeOrphans: options.removeOrphans,
      removeEmptyDirs: options.removeEmptyDirs,
    });
    console.log(`GC complete (dry-run: ${result.dryRun}):`);
    console.log(`  Orphaned metas removed: ${result.orphanedMetaRemoved}`);
    console.log(`  Empty dirs removed: ${result.emptyDirsRemoved}`);
    if (result.errors.length > 0) {
      console.error("  Errors:", result.errors);
    }
    process.exit(0);
  });

if (require.main === module) {
  program.parse(process.argv);
}

export async function getProvider(
  keypairPath?: string,
  rpcUrl: string = "http://127.0.0.1:8899",
): Promise<AnchorProvider> {
  const resolvedPath = keypairPath || join(homedir(), ".config", "solana", "id.json");
  let keypair: Keypair;

  if (existsSync(resolvedPath)) {
    const secret = JSON.parse(
      (await import("fs")).readFileSync(resolvedPath, "utf8"),
    );
    keypair = Keypair.fromSecretKey(Buffer.from(secret));
  } else {
    keypair = Keypair.generate();
    console.warn("No keypair found, using generated keypair:", keypair.publicKey.toBase58());
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new Wallet(keypair);
  return new AnchorProvider(connection, wallet, { commitment: "confirmed" });
}
