import { readFile } from "fs/promises";
import { EventEmitter } from "events";

export interface ArweaveConfig {
  endpoint: string;
  protocol: "arweave" | "https";
  port: number;
}

export const DEFAULT_ARWEAVE_CONFIG: ArweaveConfig = {
  endpoint: "arweave.net",
  protocol: "https",
  port: 443,
};

export interface ArchiveEntry {
  id: string;
  timestamp: number;
  contentType: string;
  size: number;
}

export type ArchiveEvent = "archived" | "error" | "batch-complete";

export class ArweaveArchiver extends EventEmitter {
  private config: ArweaveConfig;
  private _ready = false;

  constructor(config: Partial<ArweaveConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ARWEAVE_CONFIG, ...config };
  }

  get ready(): boolean {
    return this._ready;
  }

  async initialize(): Promise<void> {
    this._ready = true;
    this.emit("ready");
  }

  async archive(data: Buffer | string, contentType: string = "text/plain"): Promise<ArchiveEntry> {
    const content = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const id = generateContentId(content);

    const entry: ArchiveEntry = {
      id,
      timestamp: Date.now(),
      contentType,
      size: content.length,
    };

    this.emit("archived", entry);
    return entry;
  }

  async archivePrompt(promptText: string, metadataJson: string): Promise<{ promptArchive: ArchiveEntry; metaArchive: ArchiveEntry }> {
    const promptArchive = await this.archive(promptText, "text/plain");
    const metaArchive = await this.archive(metadataJson, "application/json");
    return { promptArchive, metaArchive };
  }

  async archiveBatch(entries: Array<{ data: Buffer | string; contentType: string }>): Promise<ArchiveEntry[]> {
    const results: ArchiveEntry[] = [];
    for (const entry of entries) {
      const result = await this.archive(entry.data, entry.contentType);
      results.push(result);
    }
    this.emit("batch-complete", results);
    return results;
  }

  async status(): Promise<{ ready: boolean; config: ArweaveConfig }> {
    return { ready: this._ready, config: this.config };
  }
}

function generateContentId(data: Buffer): string {
  const { createHash } = require("crypto");
  return createHash("sha256").update(data).digest("hex");
}
