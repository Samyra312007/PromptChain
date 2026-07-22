import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LRUCache } from '../lru-cache';
import { FileCache } from '../file-cache';
import { NegativeCache } from '../negative-cache';
import { SpeculativePrefetcher } from '../prefetcher';
import { SparseMerkleTree } from '../sparse-merkle-tree';
import { CacheManager } from '../cache-manager';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>({ maxSize: 1024 * 1024, maxEntries: 5, ttlMs: 60_000 });
  });

  it('should set and get values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should evict oldest entries when exceeding maxEntries', () => {
    for (let i = 0; i < 10; i++) {
      cache.set(`key${i}`, `value${i}`);
    }
    expect(cache.get('key0')).toBeUndefined();
    expect(cache.get('key9')).toBe('value9');
  });

  it('should move accessed entries to head', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.get('a');
    cache.set('d', '4');
    cache.set('e', '5');
    cache.set('f', '6');
    // 'b' should be evicted (least recently used after 'a' was moved)
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('1');
  });

  it('should expire entries after TTL', async () => {
    const shortCache = new LRUCache<string>({ maxSize: 1024 * 1024, maxEntries: 100, ttlMs: 10 });
    shortCache.set('key', 'value');
    expect(shortCache.get('key')).toBe('value');
    await new Promise((r) => setTimeout(r, 20));
    expect(shortCache.get('key')).toBeUndefined();
  });

  it('should delete entries', () => {
    cache.set('key', 'value');
    expect(cache.delete('key')).toBe(true);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should provide stats', () => {
    cache.set('a', '1');
    cache.get('a');
    cache.get('b');

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.entries).toBe(1);
    expect(stats.hitRate).toBe(0.5);
  });

  it('should clear all entries', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.getStats().entries).toBe(0);
  });

  it('should track hit counts', () => {
    cache.set('key', 'value');
    cache.get('key');
    cache.get('key');
    cache.get('key');
    const entries = cache.entries();
    const entry = entries.find((e) => e.key === 'key');
    expect(entry?.hitCount).toBe(3);
  });
});

describe('FileCache', () => {
  let cacheDir: string;
  let fileCache: FileCache;

  beforeEach(() => {
    cacheDir = join(tmpdir(), `promptchain-test-${Date.now()}`);
    fileCache = new FileCache({ cacheDir, maxEntries: 100, ttlMs: 60_000 });
  });

  afterEach(() => {
    if (existsSync(cacheDir)) rmSync(cacheDir, { recursive: true });
  });

  it('should persist values across instances', () => {
    fileCache.set('key', 'value');
    expect(fileCache.get('key')).toBe('value');

    const second = new FileCache({ cacheDir, maxEntries: 100, ttlMs: 60_000 });
    expect(second.get('key')).toBe('value');
  });

  it('should return undefined for missing keys', () => {
    expect(fileCache.get('nonexistent')).toBeUndefined();
  });

  it('should delete keys', () => {
    fileCache.set('key', 'value');
    expect(fileCache.delete('key')).toBe(true);
    expect(fileCache.get('key')).toBeUndefined();
  });

  it('should respect TTL', async () => {
    const short = new FileCache({ cacheDir, maxEntries: 100, ttlMs: 10 });
    short.set('key', 'value');
    expect(short.get('key')).toBe('value');
    await new Promise((r) => setTimeout(r, 20));
    expect(short.get('key')).toBeUndefined();
  });

  it('should clear all entries', () => {
    fileCache.set('a', '1');
    fileCache.set('b', '2');
    fileCache.clear();
    expect(fileCache.size()).toBe(0);
  });

  it('should evict oldest when over limit', () => {
    const small = new FileCache({ cacheDir, maxEntries: 2, ttlMs: 60000 });
    small.set('a', '1');
    small.set('b', '2');
    small.set('c', '3');
    expect(small.get('a')).toBeUndefined();
    expect(small.get('b')).toBe('2');
    expect(small.get('c')).toBe('3');
  });
});

describe('NegativeCache', () => {
  let nc: NegativeCache;

  beforeEach(() => {
    nc = new NegativeCache(60_000);
  });

  it('should cache negative entries', () => {
    nc.set('missing-account', 'account_not_found');
    expect(nc.has('missing-account')).toBe(true);
    const entry = nc.get('missing-account');
    expect(entry?.reason).toBe('account_not_found');
  });

  it('should expire entries', async () => {
    const short = new NegativeCache(10);
    short.set('key', 'not_found');
    await new Promise((r) => setTimeout(r, 20));
    expect(short.has('key')).toBe(false);
  });

  it('should respect deletions', () => {
    nc.set('key', 'reason');
    expect(nc.delete('key')).toBe(true);
    expect(nc.has('key')).toBe(false);
  });

  it('should prune expired entries', async () => {
    const short = new NegativeCache(10);
    short.set('a', 'x');
    short.set('b', 'y');
    await new Promise((r) => setTimeout(r, 20));
    const pruned = short.prune();
    expect(pruned).toBe(2);
    expect(short.size).toBe(0);
  });
});

describe('SpeculativePrefetcher', () => {
  let prefetcher: SpeculativePrefetcher;
  let prefetched: string[] = [];

  beforeEach(() => {
    prefetched = [];
    prefetcher = new SpeculativePrefetcher({ enabled: true, maxVersions: 3, maxRelated: 2 });
    prefetcher.setLoader(async (key: string) => {
      prefetched.push(key);
      return `prefetched:${key}`;
    });
  });

  it('should generate version prefetch hints on access', async () => {
    await prefetcher.onAccessAndWait('some-prompt-key');
    expect(prefetched.length).toBeGreaterThanOrEqual(1);
    expect(prefetched.some((k) => k.includes('/v1'))).toBe(true);
  });

  it('should not prefetch the same key twice', async () => {
    await prefetcher.onAccessAndWait('key');
    const count = prefetched.length;
    await prefetcher.onAccessAndWait('key');
    expect(prefetched.length).toBe(count);
  });

  it('should generate category hints', async () => {
    await prefetcher.onAccessAndWait('key', 'code-generation');
    expect(prefetched.some((k) => k === 'category:code-generation')).toBe(true);
  });

  it('should generate tag hints', async () => {
    await prefetcher.onAccessAndWait('key', undefined, ['python', 'testing', 'unused']);
    expect(prefetched.some((k) => k === 'tag:python')).toBe(true);
    expect(prefetched.some((k) => k === 'tag:testing')).toBe(true);
  });
});

describe('SparseMerkleTree', () => {
  let smt: SparseMerkleTree;

  beforeEach(() => {
    smt = new SparseMerkleTree(8);
  });

  it('should start with empty root', () => {
    expect(smt.getRoot()).toBeTruthy();
    expect(typeof smt.getRoot()).toBe('string');
    expect(smt.leafCount()).toBe(0);
  });

  it('should update and retrieve leaves', () => {
    smt.update('key1', 'hash1');
    expect(smt.leafCount()).toBe(1);
    const leaf = smt.getLeaf('key1');
    expect(leaf?.hash).toBe('hash1');
  });

  it('should change root on updates', () => {
    const root1 = smt.getRoot();
    smt.update('key1', 'hash1');
    const root2 = smt.getRoot();
    expect(root1).not.toBe(root2);
  });

  it('should change root on deletion', () => {
    smt.update('key1', 'hash1');
    const root1 = smt.getRoot();
    smt.delete('key1');
    const root2 = smt.getRoot();
    expect(root1).not.toBe(root2);
  });

  it('should generate valid proofs', () => {
    smt.update('key1', 'hash1');
    const proof = smt.generateProof('key1');
    expect(proof).toBeDefined();
    expect(proof!.root).toBe(smt.getRoot());
    expect(proof!.leaf).toBe('hash1');
    const valid = smt.verifyProof(proof!);
    expect(valid).toBe(true);
  });

  it('should detect changed keys', () => {
    smt.update('a', 'h1');
    const root1 = smt.getRoot();
    smt.update('a', 'h2');
    const root2 = smt.getRoot();
    const changed = smt.getChangedKeys(root1, root2);
    expect(changed).toContain('a');
  });
});

describe('CacheManager', () => {
  let cm: CacheManager;
  let fetches: string[];

  beforeEach(() => {
    fetches = [];
    cm = new CacheManager({
      l1: { maxSize: 1024 * 1024, maxEntries: 100, ttlMs: 60_000 },
      l2: { enabled: false, cacheDir: '/tmp', maxEntries: 0, ttlMs: 0 },
      l3: { enabled: false, gatewayUrl: '', timeoutMs: 0 },
      l4: { enabled: true, rpcUrl: '', timeoutMs: 0 },
      negativeCache: { enabled: true, ttlMs: 60_000 },
      prefetch: { enabled: false, maxVersions: 0, maxRelated: 0 },
      smt: { enabled: false, commitmentUpdateIntervalMs: 0 },
    });
    cm.setL4Fetcher(async (key: string) => {
      fetches.push(key);
      return `rpc:${key}`;
    });
  });

  it('should fetch from L4 on cache miss', async () => {
    const result = await cm.get('test-key');
    expect(result).not.toBeNull();
    expect(result!.value).toBe('rpc:test-key');
    expect(result!.level).toBe('l4');
  });

  it('should cache in L1 after first fetch', async () => {
    await cm.get('key');
    const firstFetchCount = fetches.length;

    const result = await cm.get('key');
    expect(result!.level).toBe('l1');
    expect(fetches.length).toBe(firstFetchCount);
  });

  it('should return null for negative cache hits without fetching', async () => {
    cm['negativeCache'].set('missing', 'not_found');
    const result = await cm.get('missing');
    expect(result).toBeNull();
    expect(fetches.length).toBe(0);
  });

  it('should invalidate specific keys', async () => {
    await cm.get('key');
    expect(cm['l1'].has('key')).toBe(true);

    cm.invalidate('key');
    expect(cm['l1'].has('key')).toBe(false);
  });

  it('should invalidate by prefix', async () => {
    await cm.get('user:a:prompt1');
    await cm.get('user:a:prompt2');
    await cm.get('user:b:prompt3');

    const count = cm.invalidateByPrefix('user:a:');
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('should track cache stats', async () => {
    await cm.get('a');
    await cm.get('a');
    await cm.get('b');

    const stats = cm.getCacheStats();
    expect(stats.hierarchy.totalReads).toBe(3);
    expect(stats.hierarchy.l1Hits).toBe(1);
    expect(stats.hierarchy.l4Hits).toBe(2);
  });

  it('should support SMT updates', () => {
    cm.updateSMT('key', 'hash');
    expect(cm.getSMT().leafCount()).toBe(1);
  });
});
