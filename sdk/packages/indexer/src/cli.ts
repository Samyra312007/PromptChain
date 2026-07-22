#!/usr/bin/env node
import { Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { PromptChainClient } from "@promptchain/client";
import { CurationClient } from "@promptchain/curation";
import { PromptSearchIndex } from "./index";

function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getProvider(keypairPath?: string, rpcUrl: string = "http://127.0.0.1:8899"): Promise<AnchorProvider> {
  const resolvedPath = keypairPath || join(homedir(), ".config", "solana", "id.json");
  let keypair: Keypair;

  if (existsSync(resolvedPath)) {
    const secret = JSON.parse(readFileSync(resolvedPath, "utf8"));
    keypair = Keypair.fromSecretKey(Buffer.from(secret));
  } else {
    keypair = Keypair.generate();
    console.warn("No keypair found, using generated keypair:", keypair.publicKey.toBase58());
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new Wallet(keypair);
  return new AnchorProvider(connection, wallet, { commitment: "confirmed" });
}

async function main() {
  const args = process.argv.slice(2);
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8899";

  const provider = await getProvider(undefined, rpcUrl);
  const client = new PromptChainClient(provider);
  const curationClient = new CurationClient(provider);
  const index = new PromptSearchIndex(client, curationClient, provider.connection);

  const command = args[0] || "index";

  switch (command) {
    case "index": {
      console.log("Indexing all prompts...");
      const count = await index.indexAll();
      console.log(`Indexed ${count} prompts.`);

      const root = await index.computeMerkleRoot();
      console.log(`Merkle root: ${uint8ArrayToHex(root)}`);
      break;
    }
    case "search": {
      const query = args.slice(1).join(" ");
      if (!query) {
        console.error("Usage: promptchain-indexer search <query>");
        process.exit(1);
      }
      console.log(`Searching for: "${query}"`);

      await index.indexAll();

      const results = index.search({ text: query, limit: 10 });
      console.log(`Found ${results.total} results:`);
      for (const entry of results.entries) {
        console.log(`  [${entry.category}] ${entry.name || "Unnamed"}`);
        console.log(`    Prompt: ${entry.publicKey}`);
        console.log(`    Uses: ${entry.totalUses}`);
        console.log();
      }
      break;
    }
    case "status": {
      await index.indexAll();
      const count = index.getEntryCount();
      const root = await index.computeMerkleRoot();
      console.log(`Indexed prompts: ${count}`);
      console.log(`Merkle root: ${uint8ArrayToHex(root)}`);
      break;
    }
    case "watch": {
      console.log("Starting indexer in watch mode...");
      await index.indexAll();
      console.log(`Initial index: ${index.getEntryCount()} prompts`);

      const interval = setInterval(async () => {
        const result = await index.maybeCommitIndex(provider.wallet.publicKey);
        if (result) {
          console.log(`[${new Date().toISOString()}] Committed epoch ${result.epoch}: ${index.getEntryCount()} prompts, root=${result.root.substring(0, 16)}...`);
        }
      }, 10_000);

      process.on("SIGINT", () => {
        clearInterval(interval);
        console.log("Indexer stopped.");
        process.exit(0);
      });
      break;
    }
    default:
      console.log("Usage: promptchain-indexer <index|search|status|watch>");
      process.exit(1);
  }
}

main().catch(console.error);
