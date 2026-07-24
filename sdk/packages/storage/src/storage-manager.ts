import type { StorageProvider } from './provider-interface';
import type {
  StorageProviderName,
  StorageProviderConfig,
  ReplicationPolicy,
  StorageNegotiation,
  ProviderHealth,
  StoreResult,
} from './types';
import { LocalStorageProvider } from './providers/local';
import { IpfsStorageProvider } from './providers/ipfs-provider';
import { ArweaveStorageProvider } from './providers/arweave-provider';
import { S3StorageProvider, type S3StorageConfig } from './providers/s3';
import { FilecoinStorageProvider, type FilecoinConfig } from './providers/filecoin';
import {
  CompositeStorageProvider,
  type CompositeProviderResult,
} from './providers/composite';

export type ProviderFactory = () => StorageProvider;

export class StorageManager {
  private providers: Map<StorageProviderName, StorageProvider> = new Map();
  private configs: Map<StorageProviderName, StorageProviderConfig> = new Map();
  private replication: ReplicationPolicy;
  private healthCache: Map<StorageProviderName, ProviderHealth> = new Map();

  constructor(replication?: Partial<ReplicationPolicy>) {
    this.replication = {
      minReplicas: replication?.minReplicas ?? 1,
      preferredProviders: replication?.preferredProviders ?? ['ipfs'],
      enforce: replication?.enforce ?? false,
    };
  }

  register(provider: StorageProvider, config?: Partial<StorageProviderConfig>): void {
    this.providers.set(provider.name, provider);
    this.configs.set(provider.name, {
      name: provider.name,
      priority: config?.priority ?? 10,
      enabled: config?.enabled ?? true,
      options: config?.options,
    });
  }

  registerDefaults(): void {
    this.register(new LocalStorageProvider(), { priority: 0, enabled: true });
    this.register(new IpfsStorageProvider(), { priority: 1, enabled: true });
    this.register(new ArweaveStorageProvider(), { priority: 2, enabled: false });
  }

  registerS3(config: S3StorageConfig, priority?: number): void {
    this.register(new S3StorageProvider(config), { priority: priority ?? 3, enabled: false });
  }

  registerFilecoin(config: FilecoinConfig, priority?: number): void {
    this.register(new FilecoinStorageProvider(config), { priority: priority ?? 4, enabled: false });
  }

  getProvider(name: StorageProviderName): StorageProvider | undefined {
    return this.providers.get(name);
  }

  getAvailableProviders(): StorageProvider[] {
    return [...this.providers.values()].filter((p) => {
      const config = this.configs.get(p.name);
      return config?.enabled !== false;
    });
  }

  getAllProviders(): StorageProvider[] {
    return [...this.providers.values()];
  }

  async initializeAll(): Promise<void> {
    await Promise.all(this.getAvailableProviders().map((p) => p.initialize()));
  }

  async negotiate(contentType?: string): Promise<StorageNegotiation> {
    const available = this.getAvailableProviders()
      .sort((a, b) => {
        const ca = this.configs.get(a.name);
        const cb = this.configs.get(b.name);
        return (ca?.priority ?? 10) - (cb?.priority ?? 10);
      });

    if (available.length === 0) {
      return { providers: [], selected: 'local', reason: 'No providers available, falling back to local' };
    }

    for (const provider of available) {
      try {
        const health = await provider.health();
        if (health.available) {
          return {
            providers: available.map((p) => ({
              name: p.name,
              priority: this.configs.get(p.name)?.priority ?? 10,
              enabled: true,
            })),
            selected: provider.name,
            reason: `Fastest healthy provider (${health.latencyMs}ms latency)`,
          };
        }
      } catch {
        continue;
      }
    }

    return {
      providers: available.map((p) => ({
        name: p.name,
        priority: this.configs.get(p.name)?.priority ?? 10,
        enabled: true,
      })),
      selected: available[0].name,
      reason: 'No healthy providers, using first available',
    };
  }

  async store(data: Buffer | string, contentType?: string, preferredProviders?: StorageProviderName[]): Promise<StoreResult> {
    const targets = this.selectTargets(preferredProviders);
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

    const startTime = Date.now();
    const results: StoreResult['results'] = [];

    for (const provider of targets) {
      const pStart = Date.now();
      try {
        const stored = await provider.store(buffer, contentType);
        results.push({
          provider: stored.provider,
          cid: stored.cid,
          success: true,
          latencyMs: Date.now() - pStart,
        });
      } catch (err) {
        results.push({
          provider: provider.name,
          cid: '',
          success: false,
          latencyMs: Date.now() - pStart,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const cid = results.find((r) => r.success)?.cid || '';
    const successCountForCid = results.filter((r) => r.success).length;

    if (this.replication.enforce && successCount < this.replication.minReplicas) {
      throw new Error(
        `Replication policy failed: stored on ${successCount}/${targets.length} providers, minimum ${this.replication.minReplicas} required`,
      );
    }

    return {
      cid,
      results,
      composite: targets.length > 1,
      successCount,
      totalAttempts: targets.length,
    };
  }

  async retrieve(cid: string, preferredProviders?: StorageProviderName[]): Promise<Buffer> {
    const targets = this.selectTargets(preferredProviders);
    const errors: string[] = [];

    for (const provider of targets) {
      try {
        return await provider.retrieve(cid);
      } catch (err) {
        errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
    }

    throw new Error(`All providers failed for ${cid}: ${errors.join('; ')}`);
  }

  async exists(cid: string): Promise<boolean> {
    const providers = this.getAvailableProviders();
    for (const provider of providers) {
      try {
        if (await provider.exists(cid)) return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  async checkHealth(): Promise<ProviderHealth[]> {
    const results: ProviderHealth[] = [];
    for (const provider of this.getAvailableProviders()) {
      try {
        const health = await provider.health();
        const entry: ProviderHealth = {
          name: provider.name,
          available: health.available,
          latencyMs: health.latencyMs,
          lastChecked: Date.now(),
          error: health.error,
        };
        results.push(entry);
        this.healthCache.set(provider.name, entry);
      } catch (err) {
        const entry: ProviderHealth = {
          name: provider.name,
          available: false,
          latencyMs: 0,
          lastChecked: Date.now(),
          error: String(err),
        };
        results.push(entry);
        this.healthCache.set(provider.name, entry);
      }
    }
    return results;
  }

  createComposite(providers?: StorageProvider[], minSurvive?: number): CompositeStorageProvider {
    const inner = providers || this.getAvailableProviders();
    return new CompositeStorageProvider(inner, {
      minSurvive: minSurvive ?? Math.ceil(inner.length / 2) + 1,
    });
  }

  private selectTargets(preferred?: StorageProviderName[]): StorageProvider[] {
    const order = preferred || this.replication.preferredProviders;
    const ordered: StorageProvider[] = [];
    const used = new Set<StorageProviderName>();

    for (const name of order) {
      const provider = this.providers.get(name);
      const config = this.configs.get(name);
      if (provider && config?.enabled !== false && !used.has(name)) {
        ordered.push(provider);
        used.add(name);
      }
    }

    for (const [name, provider] of this.providers) {
      const config = this.configs.get(name);
      if (!used.has(name) && config?.enabled !== false) {
        ordered.push(provider);
        used.add(name);
      }
    }

    return ordered;
  }
}
