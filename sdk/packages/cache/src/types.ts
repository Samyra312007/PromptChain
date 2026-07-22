export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  size: number;
  hitCount: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  entries: number;
  evictions: number;
  hitRate: number;
}

export interface LRUCacheConfig {
  maxSize: number;
  maxEntries: number;
  ttlMs: number;
}

export interface CacheLevelConfig {
  l1: LRUCacheConfig;
  l2: {
    enabled: boolean;
    cacheDir: string;
    maxEntries: number;
    ttlMs: number;
  };
  l3: {
    enabled: boolean;
    gatewayUrl: string;
    timeoutMs: number;
  };
  l4: {
    enabled: boolean;
    rpcUrl: string;
    timeoutMs: number;
  };
  negativeCache: {
    enabled: boolean;
    ttlMs: number;
  };
  prefetch: {
    enabled: boolean;
    maxVersions: number;
    maxRelated: number;
  };
  smt: {
    enabled: boolean;
    commitmentUpdateIntervalMs: number;
  };
}

export type CacheLevel = 'l1' | 'l2' | 'l3' | 'l4';

export interface CacheResult<T> {
  value: T;
  level: CacheLevel;
  latencyMs: number;
}

export interface SparseMerkleNode {
  level: number;
  index: number;
  hash: string;
  left?: SparseMerkleNode;
  right?: SparseMerkleNode;
}

export interface CommitmentProof {
  root: string;
  leaf: string;
  path: Array<{ hash: string; isLeft: boolean }>;
}

export interface NegativeCacheEntry {
  key: string;
  reason: string;
  expiresAt: number;
}

export interface PrefetchHint {
  type: 'version' | 'related' | 'curator';
  targetKey: string;
  sourceKey: string;
  priority: number;
}

export interface CacheMiddleware {
  name: string;
  onRead?: <T>(key: string, result: CacheResult<T> | null) => Promise<CacheResult<T> | null>;
  onWrite?: <T>(key: string, value: T, level: CacheLevel) => Promise<void>;
  onEvict?: (key: string, level: CacheLevel) => Promise<void>;
}

export const DEFAULT_CACHE_CONFIG: CacheLevelConfig = {
  l1: {
    maxSize: 100 * 1024 * 1024,
    maxEntries: 10_000,
    ttlMs: 300_000,
  },
  l2: {
    enabled: true,
    cacheDir: './.promptchain/cache',
    maxEntries: 100_000,
    ttlMs: 3_600_000,
  },
  l3: {
    enabled: true,
    gatewayUrl: 'https://ipfs.io/ipfs/',
    timeoutMs: 10_000,
  },
  l4: {
    enabled: true,
    rpcUrl: 'https://api.devnet.solana.com',
    timeoutMs: 30_000,
  },
  negativeCache: {
    enabled: true,
    ttlMs: 60_000,
  },
  prefetch: {
    enabled: true,
    maxVersions: 5,
    maxRelated: 3,
  },
  smt: {
    enabled: true,
    commitmentUpdateIntervalMs: 15_000,
  },
};
