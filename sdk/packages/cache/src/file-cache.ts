import { mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export interface FileCacheEntry {
  key: string;
  value: string;
  createdAt: number;
  expiresAt: number;
}

export class FileCache {
  private cacheDir: string;
  private maxEntries: number;
  private defaultTtlMs: number;
  private index: Map<string, FileCacheEntry> = new Map();

  constructor(config: { cacheDir: string; maxEntries: number; ttlMs: number }) {
    this.cacheDir = config.cacheDir;
    this.maxEntries = config.maxEntries;
    this.defaultTtlMs = config.ttlMs;
    this.ensureDir();
    this.loadIndex();
  }

  get(key: string): string | undefined {
    const entry = this.index.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.index.delete(key);
      this.removeFile(key);
      return undefined;
    }

    entry.expiresAt = Date.now() + this.defaultTtlMs;
    this.index.set(key, entry);
    this.writeEntry(key, entry);
    return entry.value;
  }

  set(key: string, value: string, ttlMs?: number): void {
    if (this.index.size >= this.maxEntries) {
      this.evictOldest();
    }

    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    const entry: FileCacheEntry = { key, value, createdAt: Date.now(), expiresAt };
    this.index.set(key, entry);
    this.writeEntry(key, entry);
  }

  has(key: string): boolean {
    const entry = this.index.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.index.delete(key);
      this.removeFile(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    const existed = this.index.delete(key);
    this.removeFile(key);
    return existed;
  }

  clear(): void {
    this.index.clear();
    if (existsSync(this.cacheDir)) {
      for (const f of readdirSync(this.cacheDir)) {
        unlinkSync(join(this.cacheDir, f));
      }
    }
  }

  size(): number {
    return this.index.size;
  }

  keys(): string[] {
    return [...this.index.keys()];
  }

  private ensureDir(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private loadIndex(): void {
    if (!existsSync(this.cacheDir)) return;
    for (const f of readdirSync(this.cacheDir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const content = readFileSync(join(this.cacheDir, f), 'utf-8');
        const entry: FileCacheEntry = JSON.parse(content);
        if (Date.now() <= entry.expiresAt) {
          this.index.set(entry.key, entry);
        } else {
          unlinkSync(join(this.cacheDir, f));
        }
      } catch {
        // ignore corrupt entries
      }
    }
  }

  private filePath(key: string): string {
    return join(this.cacheDir, `${createHash('sha256').update(key).digest('hex').slice(0, 16)}.json`);
  }

  private writeEntry(key: string, entry: FileCacheEntry): void {
    try {
      writeFileSync(this.filePath(key), JSON.stringify(entry), 'utf-8');
    } catch {
      // write failures are non-fatal
    }
  }

  private removeFile(key: string): void {
    try {
      const fp = this.filePath(key);
      if (existsSync(fp)) unlinkSync(fp);
    } catch {
      // remove failures are non-fatal
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.index) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.delete(oldestKey);
    }
  }
}
