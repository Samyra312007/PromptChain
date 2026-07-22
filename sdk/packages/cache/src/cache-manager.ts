import { LRUCache } from './lru-cache';
import { FileCache } from './file-cache';
import { NegativeCache } from './negative-cache';
import { SpeculativePrefetcher } from './prefetcher';
import { SparseMerkleTree } from './sparse-merkle-tree';
import {
  CacheLevelConfig,
  CacheLevel,
  CacheResult,
  CacheStats,
  CacheMiddleware,
  DEFAULT_CACHE_CONFIG,
} from './types';

export type L3Fetcher = (key: string) => Promise<string | null>;
export type L4Fetcher = (key: string) => Promise<string | null>;

export class CacheManager {
  private config: CacheLevelConfig;
  private l1: LRUCache<string>;
  private l2: FileCache | null = null;
  private negativeCache: NegativeCache;
  private prefetcher: SpeculativePrefetcher;
  private smt: SparseMerkleTree;
  private middlewares: CacheMiddleware[] = [];
  private l3Fetcher: L3Fetcher | null = null;
  private l4Fetcher: L4Fetcher | null = null;

  private totalReads = 0;
  private l1Hits = 0;
  private l2Hits = 0;
  private l3Hits = 0;
  private l4Hits = 0;

  constructor(config?: Partial<CacheLevelConfig>) {
    this.config = this.mergeConfig(config || {});
    this.l1 = new LRUCache(this.config.l1);
    if (this.config.l2.enabled) {
      this.l2 = new FileCache({
        cacheDir: this.config.l2.cacheDir,
        maxEntries: this.config.l2.maxEntries,
        ttlMs: this.config.l2.ttlMs,
      });
    }
    this.negativeCache = new NegativeCache(this.config.negativeCache.ttlMs);
    this.prefetcher = new SpeculativePrefetcher(this.config.prefetch);
    this.smt = new SparseMerkleTree(8);
  }

  setL3Fetcher(fetcher: L3Fetcher): void {
    this.l3Fetcher = fetcher;
  }

  setL4Fetcher(fetcher: L4Fetcher): void {
    this.l4Fetcher = fetcher;
  }

  setPrefetchLoader(loader: (key: string) => Promise<unknown>): void {
    this.prefetcher.setLoader(loader);
  }

  addMiddleware(middleware: CacheMiddleware): void {
    this.middlewares.push(middleware);
  }

  async get(key: string, options?: {
    skipL1?: boolean;
    skipL2?: boolean;
    skipL3?: boolean;
    skipL4?: boolean;
    ttlMsL1?: number;
    ttlMsL2?: number;
  }): Promise<CacheResult<string> | null> {
    this.totalReads++;
    const start = Date.now();

    if (this.negativeCache.has(key)) {
      return null;
    }

    let value: string | null = null;
    let level: CacheLevel = 'l4';

    // L1: process memory
    if (!options?.skipL1) {
      value = this.l1.get(key) ?? null;
      if (value !== null) {
        this.l1Hits++;
        level = 'l1';
      }
    }

    // L2: file cache
    if (value === null && !options?.skipL2 && this.l2) {
      value = this.l2.get(key) ?? null;
      if (value !== null) {
        this.l2Hits++;
        level = 'l2';
        this.l1.set(key, value, options?.ttlMsL1);
      }
    }

    // L3: IPFS gateway
    if (value === null && !options?.skipL3 && this.config.l3.enabled && this.l3Fetcher) {
      try {
        value = await this.l3Fetcher(key);
        if (value !== null) {
          this.l3Hits++;
          level = 'l3';
          this.l1.set(key, value, options?.ttlMsL1 || this.config.l1.ttlMs);
          this.l2?.set(key, value, options?.ttlMsL2 || this.config.l2.ttlMs);
        }
      } catch {
        // L3 unavailable, fall through
      }
    }

    // L4: on-chain RPC
    if (value === null && !options?.skipL4 && this.config.l4.enabled && this.l4Fetcher) {
      try {
        value = await this.l4Fetcher(key);
        if (value !== null) {
          this.l4Hits++;
          level = 'l4';
          this.l1.set(key, value, options?.ttlMsL1 || this.config.l1.ttlMs);
          this.l2?.set(key, value, options?.ttlMsL2 || this.config.l2.ttlMs);
        }
      } catch {
        // L4 unavailable
      }
    }

    if (value === null) {
      this.negativeCache.set(key, 'not_found');
      return null;
    }

    const latencyMs = Date.now() - start;

    let result: CacheResult<string> | null = { value, level, latencyMs };

    for (const mw of this.middlewares) {
      if (mw.onRead) {
        result = await mw.onRead(key, result);
        if (result === null) break;
      }
    }

    if (result && this.config.prefetch.enabled) {
      this.prefetcher.onAccess(key);
    }

    return result;
  }

  async set(
    key: string,
    value: string,
    options?: { ttlMsL1?: number; ttlMsL2?: number; skipL2?: boolean },
  ): Promise<void> {
    this.negativeCache.delete(key);
    this.l1.set(key, value, options?.ttlMsL1);

    if (!options?.skipL2 && this.l2) {
      this.l2.set(key, value, options?.ttlMsL2);
    }

    for (const mw of this.middlewares) {
      if (mw.onWrite) {
        await mw.onWrite(key, value, 'l1');
      }
    }
  }

  invalidate(key: string): void {
    this.l1.delete(key);
    this.l2?.delete(key);
    this.negativeCache.delete(key);
  }

  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const k of this.l1.keys()) {
      if (k.startsWith(prefix)) {
        this.l1.delete(k);
        count++;
      }
    }
    if (this.l2) {
      for (const k of this.l2.keys()) {
        if (k.startsWith(prefix)) {
          this.l2.delete(k);
          count++;
        }
      }
    }
    return count;
  }

  clear(): void {
    this.l1.clear();
    this.l2?.clear();
    this.negativeCache.clear();
    this.prefetcher.clear();
  }

  updateSMT(key: string, valueHash: string): void {
    this.smt.update(key, valueHash);
  }

  getSMT(): SparseMerkleTree {
    return this.smt;
  }

  getNegativeCache(): NegativeCache {
    return this.negativeCache;
  }

  getPrefetcher(): SpeculativePrefetcher {
    return this.prefetcher;
  }

  getCacheStats(): {
    l1: CacheStats;
    l2: { size: number } | null;
    negative: { hits: number; misses: number; size: number };
    prefetch: { totalPrefetched: number; queueLength: number };
    hierarchy: { totalReads: number; l1Hits: number; l2Hits: number; l3Hits: number; l4Hits: number };
  } {
    return {
      l1: this.l1.getStats(),
      l2: this.l2 ? { size: this.l2.size() } : null,
      negative: {
        hits: this.negativeCache.getStats().hits,
        misses: this.negativeCache.getStats().misses,
        size: this.negativeCache.getStats().size,
      },
      prefetch: {
        totalPrefetched: this.prefetcher.getStats().totalPrefetched,
        queueLength: this.prefetcher.getStats().queueLength,
      },
      hierarchy: {
        totalReads: this.totalReads,
        l1Hits: this.l1Hits,
        l2Hits: this.l2Hits,
        l3Hits: this.l3Hits,
        l4Hits: this.l4Hits,
      },
    };
  }

  private mergeConfig(overrides: Partial<CacheLevelConfig>): CacheLevelConfig {
    return {
      l1: { ...DEFAULT_CACHE_CONFIG.l1, ...overrides.l1 },
      l2: { ...DEFAULT_CACHE_CONFIG.l2, ...overrides.l2 },
      l3: { ...DEFAULT_CACHE_CONFIG.l3, ...overrides.l3 },
      l4: { ...DEFAULT_CACHE_CONFIG.l4, ...overrides.l4 },
      negativeCache: { ...DEFAULT_CACHE_CONFIG.negativeCache, ...overrides.negativeCache },
      prefetch: { ...DEFAULT_CACHE_CONFIG.prefetch, ...overrides.prefetch },
      smt: { ...DEFAULT_CACHE_CONFIG.smt, ...overrides.smt },
    };
  }
}
