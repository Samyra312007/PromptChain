import { NegativeCacheEntry } from './types';

export class NegativeCache {
  private entries: Map<string, NegativeCacheEntry> = new Map();
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(private ttlMs: number = 60_000) {}

  set(key: string, reason: string): void {
    this.entries.set(key, {
      key,
      reason,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  get(key: string): NegativeCacheEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      this.evictions++;
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry;
  }

  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      this.evictions++;
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  getStats(): { hits: number; misses: number; evictions: number; size: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.entries.size,
    };
  }

  prune(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
        removed++;
      }
    }
    this.evictions += removed;
    return removed;
  }

  get size(): number {
    return this.entries.size;
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }
}
