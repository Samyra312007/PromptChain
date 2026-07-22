import { CacheManager, DEFAULT_CACHE_CONFIG } from '@promptchain/cache';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

let globalCache: CacheManager | null = null;

function getCache(): CacheManager {
  if (!globalCache) {
    globalCache = new CacheManager({
      l2: {
        enabled: true,
        cacheDir: join(process.cwd(), '.promptchain', 'cache'),
        maxEntries: DEFAULT_CACHE_CONFIG.l2.maxEntries,
        ttlMs: DEFAULT_CACHE_CONFIG.l2.ttlMs,
      },
    });
    globalCache.setL3Fetcher(async (key: string) => {
      try {
        const gateway = DEFAULT_CACHE_CONFIG.l3.gatewayUrl;
        const resp = await fetch(`${gateway}${key}`, { signal: AbortSignal.timeout(10_000) });
        if (!resp.ok) return null;
        return await resp.text();
      } catch {
        return null;
      }
    });
    globalCache.setL4Fetcher(async (key: string) => {
      // L4 is the Solana RPC — return placeholder in CLI
      return null;
    });
  }
  return globalCache;
}

export async function cacheStatsCommand(): Promise<void> {
  const cm = getCache();
  const stats = cm.getCacheStats();
  const h = stats.hierarchy;

  console.log('Cache Hierarchy Stats:');
  console.log('  Total Reads:     ', h.totalReads);
  console.log('  L1 (Memory):     ', h.l1Hits, 'hits (', (h.totalReads > 0 ? ((h.l1Hits / h.totalReads) * 100).toFixed(1) : '0.0'), '%)');
  console.log('  L2 (File):       ', h.l2Hits, 'hits');
  console.log('  L3 (IPFS):       ', h.l3Hits, 'hits');
  console.log('  L4 (RPC):        ', h.l4Hits, 'hits');
  console.log('');
  console.log('L1 Cache:');
  console.log('  Entries:         ', stats.l1.entries);
  console.log('  Size:            ', formatBytes(stats.l1.size));
  console.log('  Hit Rate:        ', (stats.l1.hitRate * 100).toFixed(1) + '%');
  console.log('  Evictions:       ', stats.l1.evictions);
  console.log('');
  console.log('L2 Cache:');
  console.log('  Entries:         ', stats.l2?.size ?? 0);
  console.log('');
  console.log('Negative Cache:');
  console.log('  Entries:         ', stats.negative.size);
  console.log('  Hits:            ', stats.negative.hits);
  console.log('  Misses:          ', stats.negative.misses);
  console.log('');
  console.log('Prefetcher:');
  console.log('  Total Prefetched:', stats.prefetch.totalPrefetched);
  console.log('  Queue Length:    ', stats.prefetch.queueLength);
}

export async function cacheClearCommand(): Promise<void> {
  const cm = getCache();
  cm.clear();
  console.log('Cache cleared (L1, L2, negative cache, prefetch queue).');
}

export async function cacheGetCommand(key: string): Promise<void> {
  const cm = getCache();
  const result = await cm.get(key);
  if (result) {
    console.log(`Cache HIT for "${key}"`);
    console.log('  Level:     ', result.level.toUpperCase());
    console.log('  Latency:   ', result.latencyMs, 'ms');
    console.log('  Value:     ', result.value.slice(0, 200) + (result.value.length > 200 ? '...' : ''));
  } else {
    console.log(`Cache MISS for "${key}"`);
  }
}

export async function cacheSetCommand(key: string, value: string): Promise<void> {
  const cm = getCache();
  await cm.set(key, value);
  console.log(`Cached key "${key}" in L1${cm['l2'] ? ' + L2' : ''}`);
}

export async function cacheInvalidateCommand(key: string): Promise<void> {
  const cm = getCache();
  cm.invalidate(key);
  console.log(`Invalidated cache entry "${key}"`);
}

export async function cacheWarmCommand(
  keys: string,
): Promise<void> {
  const cm = getCache();
  const keyList = keys.split(',').map((k) => k.trim()).filter(Boolean);
  let hits = 0;
  for (const key of keyList) {
    const result = await cm.get(key, { skipL4: false });
    if (result) hits++;
  }
  console.log(`Warmed ${hits}/${keyList.length} cache entries`);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
