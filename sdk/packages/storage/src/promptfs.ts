import { readdir, stat, mkdir, readFile, writeFile, unlink, rmdir } from "fs/promises";
import { join, basename, dirname, relative, sep } from "path";
import { EventEmitter } from "events";
import type { PublicKey } from "@solana/web3.js";
import type { PromptChainClient } from "@promptchain/client";
import type { PromptMetadata } from "@promptchain/schema";
import {
  readPromptFile,
  writePromptFile,
  listPromptFiles,
  scanDirectoryTree,
  deletePromptFile,
  computeCid,
  createDefaultMetadata,
  PROMPT_FILE_EXT,
  META_FILE_SUFFIX,
  isValidPromptFile,
} from "./prompt-file";
import type { PromptFile } from "./prompt-file";

export interface PromptFsEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isPrompt: boolean;
  size: number;
  modifiedAt: Date;
}

export interface PromptFsMountOptions {
  createSampleOnInit?: boolean;
  autoSync?: boolean;
  syncIntervalMs?: number;
}

export interface SyncResult {
  published: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
}

export class PromptFs extends EventEmitter {
  private mountPoint: string;
  private client: PromptChainClient | null = null;
  private authority: PublicKey | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private _mounted = false;

  constructor(mountPoint: string) {
    super();
    this.mountPoint = mountPoint;
  }

  get mounted(): boolean {
    return this._mounted;
  }

  get path(): string {
    return this.mountPoint;
  }

  get connected(): boolean {
    return this.client !== null && this.authority !== null;
  }

  async mount(client?: PromptChainClient, authority?: PublicKey, options?: PromptFsMountOptions): Promise<void> {
    await mkdir(this.mountPoint, { recursive: true });
    this._mounted = true;

    if (client && authority) {
      this.client = client;
      this.authority = authority;
    }

    if (options?.createSampleOnInit) {
      await this.createSampleStructure();
    }

    if (options?.autoSync && this.client && this.authority) {
      const interval = options.syncIntervalMs ?? 30000;
      this.syncTimer = setInterval(() => {
        this.syncAll().catch((err) => this.emit("sync-error", err));
      }, interval);
    }

    this.emit("mounted", this.mountPoint);
  }

  async unmount(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this._mounted = false;
    this.emit("unmounted", this.mountPoint);
  }

  async listDirectory(subpath: string = ""): Promise<PromptFsEntry[]> {
    const dirPath = join(this.mountPoint, subpath);
    const entries = await readdir(dirPath, { withFileTypes: true });
    const results: PromptFsEntry[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(dirPath, entry.name);
      const stats = await stat(fullPath);
      results.push({
        name: entry.name,
        path: relative(this.mountPoint, fullPath),
        isDirectory: entry.isDirectory(),
        isPrompt: isValidPromptFile(entry.name),
        size: stats.size,
        modifiedAt: stats.mtime,
      });
    }

    return results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async readPrompt(subpath: string): Promise<PromptFile> {
    const fullPath = join(this.mountPoint, subpath);
    return readPromptFile(fullPath);
  }

  async writePrompt(
    subpath: string,
    promptText: string,
    metadata?: Partial<PromptMetadata>,
  ): Promise<PromptFile> {
    const dir = dirname(join(this.mountPoint, subpath));
    const name = basename(subpath);
    const defaultMeta = createDefaultMetadata(name.replace(PROMPT_FILE_EXT, ""));
    const mergedMeta = { ...defaultMeta, ...metadata };
    return writePromptFile(dir, name, promptText, mergedMeta as PromptMetadata);
  }

  async deleteEntry(subpath: string): Promise<void> {
    const fullPath = join(this.mountPoint, subpath);
    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      await rmdir(fullPath, { recursive: true });
    } else if (isValidPromptFile(basename(fullPath))) {
      await deletePromptFile(fullPath);
    } else {
      await unlink(fullPath);
    }
  }

  async createDirectory(subpath: string): Promise<void> {
    const fullPath = join(this.mountPoint, subpath);
    await mkdir(fullPath, { recursive: true });
  }

  async syncAll(): Promise<SyncResult> {
    if (!this.client || !this.authority) {
      throw new Error("PromptFS not connected to blockchain client");
    }

    const result: SyncResult = { published: 0, skipped: 0, errors: [] };
    const promptFiles = await scanDirectoryTree(this.mountPoint);

    for (const pf of promptFiles) {
      try {
        const existing = await this.client.fetchPromptsByAuthority(this.authority);
        const alreadyPublished = existing.some(
          (e) => e.account.ipfsCid === pf.cid,
        );

        if (alreadyPublished) {
          result.skipped++;
          continue;
        }

        const metadataUri = `file://${join(pf.directory, pf.filename)}`;

        await this.client.publish({
          authority: this.authority,
          cid: pf.cid,
          metadataUri,
        });

        result.published++;
      } catch (err) {
        result.errors.push({
          file: pf.filename,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.emit("sync-complete", result);
    return result;
  }

  async getTree(): Promise<PromptFsEntry[]> {
    const entries: PromptFsEntry[] = [];
    await this.walkTree("", entries);
    return entries;
  }

  private async walkTree(subpath: string, entries: PromptFsEntry[]): Promise<void> {
    const list = await this.listDirectory(subpath);
    for (const entry of list) {
      entries.push(entry);
      if (entry.isDirectory) {
        await this.walkTree(entry.path, entries);
      }
    }
  }

  private async createSampleStructure(): Promise<void> {
    const samples: Array<{ path: string; text: string; meta: Partial<PromptMetadata> }> = [
      {
        path: "code-gen/rust-sorting.prompt",
        text: "Write a generic sorting function in Rust that works on any Ord type.",
        meta: { name: "Rust Sorting", category: "code", tags: ["rust", "sorting", "generic"], task_description: "Generate a generic sorting function" },
      },
      {
        path: "code-gen/python-api.prompt",
        text: "Create a FastAPI endpoint that accepts a POST request with a JSON body and returns a validated response.",
        meta: { name: "Python API", category: "code", tags: ["python", "fastapi", "api"], task_description: "Generate a FastAPI endpoint" },
      },
      {
        path: "writing/blog-post.prompt",
        text: "Write a blog post about the benefits of decentralized AI prompt management.",
        meta: { name: "Blog Post", category: "writing", tags: ["blog", "decentralization", "ai"], task_description: "Write a blog post" },
      },
      {
        path: "reasoning/math-proof.prompt",
        text: "Prove that the square root of 2 is irrational using proof by contradiction.",
        meta: { name: "Math Proof", category: "reasoning", tags: ["math", "proof", "irrational"], task_description: "Prove sqrt(2) is irrational" },
      },
      {
        path: "creative/story.prompt",
        text: "Write a short story about a programmer who discovers their prompts are alive.",
        meta: { name: "Creative Story", category: "creative", tags: ["story", "scifi", "meta"], task_description: "Write a creative short story" },
      },
    ];

    for (const sample of samples) {
      const fullPath = join(this.mountPoint, sample.path);
      const dir = dirname(fullPath);
      const name = basename(fullPath);
      const defaultMeta = createDefaultMetadata(name.replace(PROMPT_FILE_EXT, ""));
      const mergedMeta = { ...defaultMeta, ...sample.meta } as PromptMetadata;
      await writePromptFile(dir, name, sample.text, mergedMeta);
    }
  }
}
