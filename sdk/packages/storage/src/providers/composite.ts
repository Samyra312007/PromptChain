import type { StorageProvider } from '../provider-interface';
import type { StoredContent, StorageProviderName, CompositePolicy, StoreResult } from '../types';

export class CompositeStorageProvider implements StorageProvider {
  readonly name: StorageProviderName = 'ipfs';
  private providers: StorageProvider[];
  private policy: CompositePolicy;

  constructor(providers: StorageProvider[], policy?: Partial<CompositePolicy>) {
    this.providers = providers;
    this.policy = {
      providers: providers.map((p) => p.name),
      minSurvive: policy?.minSurvive ?? Math.ceil(providers.length / 2) + 1,
      strategy: policy?.strategy ?? 'majority',
    };
  }

  get innerProviders(): StorageProvider[] {
    return this.providers;
  }

  async initialize(): Promise<void> {
    await Promise.all(this.providers.map((p) => p.initialize()));
  }

  async store(data: Buffer | string, contentType?: string): Promise<StoredContent> {
    const result = await this.storeWithResults(data, contentType);
    const successes = result.results.filter((r) => r.success);
    if (successes.length < this.policy.minSurvive) {
      throw new Error(
        `Composite store failed: ${successes.length}/${this.providers.length} providers succeeded, need ${this.policy.minSurvive}. Errors: ${result.results.filter((r) => !r.success).map((r) => r.error).join('; ')}`,
      );
    }
    return {
      cid: result.cid,
      provider: 'ipfs',
      size: successes[0]?.result?.size || 0,
      storedAt: Date.now(),
      metadata: { composite: 'true', providers: this.providers.map((p) => p.name).join(',') },
    };
  }

  async storeWithResults(data: Buffer | string, contentType?: string): Promise<StoreResult> {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const startTime = Date.now();
    const contentCid = calculateCid(buffer);

    const results = await Promise.all(
      this.providers.map(async (provider) => {
        const pStart = Date.now();
        try {
          const stored = await provider.store(buffer, contentType);
          return {
            provider: stored.provider,
            cid: stored.cid,
            success: true,
            latencyMs: Date.now() - pStart,
            result: stored,
          };
        } catch (err) {
          return {
            provider: provider.name,
            cid: contentCid,
            success: false,
            latencyMs: Date.now() - pStart,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );

    const successCount = results.filter((r) => r.success).length;

    return {
      cid: contentCid,
      results,
      composite: true,
      successCount,
      totalAttempts: this.providers.length,
    };
  }

  async retrieve(cid: string): Promise<Buffer> {
    for (const provider of this.providers) {
      try {
        return await provider.retrieve(cid);
      } catch {
        continue;
      }
    }
    throw new Error(`Composite retrieve failed: all ${this.providers.length} providers failed for ${cid}`);
  }

  async exists(cid: string): Promise<boolean> {
    const checks = await Promise.all(this.providers.map((p) => p.exists(cid)));
    return checks.some((c) => c);
  }

  async health(): Promise<{ available: boolean; latencyMs: number; error?: string }> {
    const checks = await Promise.all(this.providers.map((p) => p.health()));
    const available = checks.filter((c) => c.available).length >= this.policy.minSurvive;
    const avgLatency = checks.reduce((s, c) => s + c.latencyMs, 0) / checks.length;
    const errors = checks.filter((c) => c.error).map((c) => c.error).join('; ');
    return {
      available,
      latencyMs: Math.round(avgLatency),
      error: errors || undefined,
    };
  }
}

function calculateCid(data: Buffer): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(data).digest('hex');
}

export function isComposite(provider: StorageProvider): provider is CompositeStorageProvider {
  return provider instanceof CompositeStorageProvider;
}
