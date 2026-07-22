import { PublicKey, Connection } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { createHash } from "crypto";
import { PromptChainClient, PromptAccount } from "@promptchain/client";
import { CurationClient, findIndexCommitmentPda } from "@promptchain/curation";
import { CURATION_PROGRAM_ID } from "@promptchain/schema";

export interface IndexEntry {
  publicKey: string;
  authority: string;
  cid: string;
  metadataUri: string;
  category: string;
  tags: string[];
  name: string;
  description: string;
  promptText: string;
  totalVersions: number;
  totalUses: string;
  indexedAt: number;
}

export interface SearchQuery {
  text?: string;
  category?: string;
  tags?: string[];
  authority?: string;
  minRating?: number;
  sortBy?: "relevance" | "rating" | "uses" | "newest";
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  entries: IndexEntry[];
  total: number;
  offset: number;
  limit: number;
}

export interface IndexCommitment {
  epoch: BN;
  merkleRoot: Buffer;
  numDocuments: number;
  timestamp: number;
}

const SMT_INTERVAL_BLOCKS = 1000;

export class PromptSearchIndex {
  private entries: Map<string, IndexEntry> = new Map();
  private textIndex: Map<string, Set<string>> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private authorityIndex: Map<string, Set<string>> = new Map();
  private epoch: number = 0;
  private lastCommittedSlot: number = 0;
  private client: PromptChainClient;
  private curationClient: CurationClient;
  private connection: Connection;

  constructor(
    client: PromptChainClient,
    curationClient: CurationClient,
    connection: Connection,
  ) {
    this.client = client;
    this.curationClient = curationClient;
    this.connection = connection;
  }

  async indexAll(): Promise<number> {
    const provider = (this.client as unknown as { program: Program }).program.provider as AnchorProvider;
    const prompts = await this.client.fetchPromptsByAuthority(PublicKey.default);
    let count = 0;

    const allAccounts = await provider.connection.getProgramAccounts(
      new PublicKey((this.client as unknown as { program: Program }).program.programId),
      {
        filters: [
          { dataSize: 395 },
        ],
      },
    );

    for (const { pubkey, account } of allAccounts) {
      try {
        const prompt = await this.client.fetchPrompt(pubkey);
        await this.indexPrompt(pubkey, prompt);
        count++;
      } catch {
        continue;
      }
    }

    return count;
  }

  async indexPrompt(publicKey: PublicKey, account: PromptAccount): Promise<void> {
    let name = "";
    let description = "";
    let promptText = "";
    let category = "uncategorized";
    let tags: string[] = [];

    try {
      const metadata = await this.fetchMetadata(account.metadataUri);
      name = metadata.name || "";
      description = metadata.description || "";
      promptText = metadata.prompt_text || "";
      category = metadata.category || "uncategorized";
      tags = metadata.tags || [];
    } catch {
      // metadata fetch failed, use defaults
    }

    const entry: IndexEntry = {
      publicKey: publicKey.toBase58(),
      authority: account.authority.toBase58(),
      cid: account.ipfsCid,
      metadataUri: account.metadataUri,
      category,
      tags,
      name,
      description,
      promptText,
      totalVersions: account.totalVersions,
      totalUses: account.totalUses.toString(),
      indexedAt: Date.now(),
    };

    this.entries.set(publicKey.toBase58(), entry);

    this.addToInvertedIndex(this.textIndex, this.tokenize(`${name} ${description} ${promptText} ${category} ${tags.join(" ")}`), publicKey.toBase58());
    this.addToInvertedIndex(this.categoryIndex, [category], publicKey.toBase58());
    this.addToInvertedIndex(this.tagIndex, tags, publicKey.toBase58());
    this.addToInvertedIndex(this.authorityIndex, [account.authority.toBase58()], publicKey.toBase58());
  }

  removeFromIndex(publicKey: PublicKey): void {
    const key = publicKey.toBase58();
    const entry = this.entries.get(key);
    if (!entry) return;

    this.entries.delete(key);
    this.removeFromInvertedIndex(this.textIndex, this.tokenize(`${entry.name} ${entry.description} ${entry.promptText} ${entry.category} ${entry.tags.join(" ")}`), key);
    this.removeFromInvertedIndex(this.categoryIndex, [entry.category], key);
    this.removeFromInvertedIndex(this.tagIndex, entry.tags, key);
    this.removeFromInvertedIndex(this.authorityIndex, [entry.authority], key);
  }

  search(query: SearchQuery): SearchResult {
    let resultKeys: Set<string> | null = null;

    if (query.text) {
      const tokens = this.tokenize(query.text);
      const textResults = new Set<string>();
      for (const token of tokens) {
        const matches = this.textIndex.get(token);
        if (matches) {
          for (const key of matches) {
            textResults.add(key);
          }
        }
      }
      resultKeys = textResults;
    }

    if (query.category) {
      const catResults = this.categoryIndex.get(query.category.toLowerCase()) || new Set();
      resultKeys = resultKeys ? this.intersect(resultKeys, catResults) : catResults;
    }

    if (query.tags && query.tags.length > 0) {
      const tagResults = new Set<string>();
      for (const tag of query.tags) {
        const matches = this.tagIndex.get(tag.toLowerCase());
        if (matches) {
          for (const key of matches) tagResults.add(key);
        }
      }
      resultKeys = resultKeys ? this.intersect(resultKeys, tagResults) : tagResults;
    }

    if (query.authority) {
      const authResults = this.authorityIndex.get(query.authority) || new Set();
      resultKeys = resultKeys ? this.intersect(resultKeys, authResults) : authResults;
    }

    if (!resultKeys) {
      resultKeys = new Set(this.entries.keys());
    }

    let entries = Array.from(resultKeys)
      .map((k) => this.entries.get(k)!)
      .filter(Boolean);

    entries = this.sortEntries(entries, query.sortBy || "relevance", query.text);

    const total = entries.length;
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    entries = entries.slice(offset, offset + limit);

    return { entries, total, offset, limit };
  }

  getEntry(publicKey: string): IndexEntry | undefined {
    return this.entries.get(publicKey);
  }

  getEntryCount(): number {
    return this.entries.size;
  }

  async computeMerkleRoot(): Promise<Uint8Array> {
    const sortedKeys = Array.from(this.entries.keys()).sort();
    if (sortedKeys.length === 0) {
      return new Uint8Array(32);
    }

    let layer: Uint8Array[] = sortedKeys.map((k) => {
      const entry = this.entries.get(k)!;
      const hash = createHash("sha256")
        .update(`${entry.publicKey}:${entry.cid}:${entry.totalUses}`)
        .digest();
      return hash;
    });

    while (layer.length > 1) {
      const nextLayer: Uint8Array[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        if (i + 1 < layer.length) {
          const combinedBuf = new Uint8Array(layer[i].length + layer[i + 1].length);
          combinedBuf.set(layer[i], 0);
          combinedBuf.set(layer[i + 1], layer[i].length);
          const combined = createHash("sha256").update(combinedBuf).digest();
          nextLayer.push(combined);
        } else {
          nextLayer.push(layer[i]);
        }
      }
      layer = nextLayer;
    }

    return layer[0] || new Uint8Array(32);
  }

  async maybeCommitIndex(authority: PublicKey): Promise<{ committed: boolean; epoch: number; root: string } | null> {
    const slot = await this.connection.getSlot();
    if (slot - this.lastCommittedSlot < SMT_INTERVAL_BLOCKS) {
      return null;
    }

    const merkleRootArr = await this.computeMerkleRoot();
    const merkleRootHex = Array.from(merkleRootArr).map((b) => b.toString(16).padStart(2, "0")).join("");
    const epoch = this.epoch++;
    const numDocuments = this.entries.size;

    try {
      const sig = await this.curationClient.commitIndex({
        authority,
        epoch: new BN(epoch),
        merkleRoot: Array.from(merkleRootArr),
        numDocuments: new BN(numDocuments),
      });

      this.lastCommittedSlot = slot;

      return {
        committed: true,
        epoch,
        root: merkleRootHex,
      };
    } catch {
      return { committed: false, epoch, root: merkleRootHex };
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  private addToInvertedIndex(index: Map<string, Set<string>>, tokens: string[], key: string): void {
    for (const token of tokens) {
      if (!index.has(token)) index.set(token, new Set());
      index.get(token)!.add(key);
    }
  }

  private removeFromInvertedIndex(index: Map<string, Set<string>>, tokens: string[], key: string): void {
    for (const token of tokens) {
      const set = index.get(token);
      if (set) {
        set.delete(key);
        if (set.size === 0) index.delete(token);
      }
    }
  }

  private intersect(a: Set<string>, b: Set<string>): Set<string> {
    return new Set([...a].filter((x) => b.has(x)));
  }

  private sortEntries(entries: IndexEntry[], sortBy: string, queryText?: string): IndexEntry[] {
    return entries.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return 0;
        case "uses":
          return parseInt(b.totalUses) - parseInt(a.totalUses);
        case "newest":
          return b.indexedAt - a.indexedAt;
        case "relevance":
        default: {
          if (queryText) {
            const tokens = this.tokenize(queryText);
            const aScore = tokens.filter((t) =>
              `${a.name} ${a.description} ${a.promptText}`.toLowerCase().includes(t)
            ).length;
            const bScore = tokens.filter((t) =>
              `${b.name} ${b.description} ${b.promptText}`.toLowerCase().includes(t)
            ).length;
            return bScore - aScore;
          }
          return parseInt(b.totalUses) - parseInt(a.totalUses);
        }
      }
    });
  }

  private async fetchMetadata(uri: string): Promise<{ name?: string; description?: string; prompt_text?: string; category?: string; tags?: string[] }> {
    if (uri.startsWith("file://") || uri.startsWith("http://") || uri.startsWith("https://")) {
      try {
        const response = await fetch(uri);
        return await response.json() as { name?: string; description?: string; prompt_text?: string; category?: string; tags?: string[] };
      } catch {
        return {};
      }
    }
    return {};
  }
}
