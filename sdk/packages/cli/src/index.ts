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
import {
  initCuratorCommand,
  rateCommand,
  curatorStakeCommand,
  curatorInfoCommand,
  initReputationCommand,
  promptCurationCommand,
} from "./commands/curator";
import {
  tokenInitCommand,
  tokenStakeCommand,
  tokenVestingCommand,
  tokenRewardCommand,
  tokenInfoCommand,
} from "./commands/token";
import {
  daoInitCommand,
  daoJoinCommand,
  daoProposeCommand,
  daoVoteCommand,
  daoExecuteCommand,
  daoInfoCommand,
} from "./commands/governance";

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

const curatorCommand = program
  .command("curator")
  .description("Manage curator staking, ratings, and reputation");

curatorCommand
  .command("init")
  .description("Initialize as a curator with stake")
  .argument("<stake-sol>", "Amount of SOL to stake (minimum 1 SOL)")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(initCuratorCommand);

curatorCommand
  .command("rate")
  .description("Rate a prompt (1-5 stars)")
  .argument("<prompt-address>", "Prompt account public key")
  .argument("<rating>", "Rating value (1-5)")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .option("-r, --review <uri>", "Review URI (IPFS or URL)")
  .action(rateCommand);

curatorCommand
  .command("stake")
  .description("Add or withdraw stake")
  .argument("<action>", "Action: add or withdraw")
  .argument("<amount-sol>", "Amount of SOL")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(curatorStakeCommand);

curatorCommand
  .command("info")
  .description("Show curator and reputation info")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(curatorInfoCommand);

curatorCommand
  .command("init-rep")
  .description("Initialize reputation account")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(initReputationCommand);

program
  .command("curation")
  .description("View prompt curation stats")
  .argument("<prompt-address>", "Prompt account public key")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(promptCurationCommand);

const tokenCommand = program
  .command("token")
  .description("Manage $PROMPT token operations");

tokenCommand
  .command("init")
  .description("Initialize $PROMPT token config and mint")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(tokenInitCommand);

tokenCommand
  .command("stake")
  .description("Add or withdraw staked $PROMPT tokens")
  .argument("<action>", "Action: add or withdraw")
  .argument("<amount>", "Amount of $PROMPT tokens")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(tokenStakeCommand);

tokenCommand
  .command("vesting")
  .description("Manage vesting schedules (init or claim)")
  .argument("<action>", "Action: init or claim")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .option("-b, --beneficiary <pubkey>", "Beneficiary public key")
  .option("-a, --amount <amount>", "Total vesting amount in tokens")
  .option("--cliff <secs>", "Cliff duration in seconds", "31536000")
  .option("--duration <secs>", "Total vesting duration in seconds", "126144000")
  .action(tokenVestingCommand);

tokenCommand
  .command("reward")
  .description("Claim creator or curator rewards")
  .argument("<role>", "Role: creator or curator")
  .argument("<amount>", "Amount of $PROMPT tokens to claim")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(tokenRewardCommand);

tokenCommand
  .command("info")
  .description("Show $PROMPT token configuration")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(tokenInfoCommand);

const daoCommand = program
  .command("dao")
  .description("Manage DAO governance");

daoCommand
  .command("init")
  .description("Initialize DAO configuration")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .option("--voting-period <secs>", "Voting period in seconds")
  .option("--min-power <tokens>", "Minimum voting power in tokens")
  .option("--quorum <bp>", "Quorum basis points")
  .option("--threshold <bp>", "Pass threshold basis points")
  .action(daoInitCommand);

daoCommand
  .command("join")
  .description("Register as a DAO member")
  .argument("<token-balance>", "Token balance for voting weight")
  .argument("<reputation-bp>", "Reputation score in basis points")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(daoJoinCommand);

daoCommand
  .command("propose")
  .description("Create a governance proposal")
  .argument("<description>", "Proposal description")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .option("--uri <uri>", "Optional URI with proposal details")
  .action(daoProposeCommand);

daoCommand
  .command("vote")
  .description("Vote on a proposal")
  .argument("<proposal>", "Proposal account public key")
  .argument("<vote-type>", "Vote: for, against, or abstain")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(daoVoteCommand);

daoCommand
  .command("execute")
  .description("Execute a passed proposal")
  .argument("<proposal>", "Proposal account public key")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(daoExecuteCommand);

daoCommand
  .command("info")
  .description("Show DAO configuration and your membership")
  .option("-k, --keypair <path>", "Solana keypair path")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .action(daoInfoCommand);

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

program
  .command("search")
  .description("Search prompts in the local index")
  .argument("<query>", "Search query")
  .option("-u, --rpc-url <url>", "Solana RPC URL", "http://127.0.0.1:8899")
  .option("--category <cat>", "Filter by category")
  .option("--limit <n>", "Max results", "20")
  .action(async (query: string, options: { rpcUrl: string; category?: string; limit: string }) => {
    const { PromptSearchIndex } = await import("@promptchain/indexer");
    const provider = await getProvider(undefined, options.rpcUrl);
    const client = new PromptChainClient(provider);
    const { CurationClient } = await import("@promptchain/curation");
    const curationClient = new CurationClient(provider);
    const index = new PromptSearchIndex(client, curationClient, provider.connection);
    await index.indexAll();
    const results = index.search({
      text: query,
      category: options.category,
      limit: parseInt(options.limit),
    });
    console.log(`Found ${results.total} results for "${query}":\n`);
    for (const entry of results.entries) {
      console.log(`  [${entry.category}] ${entry.name || "Unnamed"}`);
      console.log(`    Address: ${entry.publicKey}`);
      console.log(`    Uses: ${entry.totalUses} | Versions: ${entry.totalVersions}`);
      console.log(`    Tags: ${entry.tags.join(", ") || "none"}`);
      console.log();
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
