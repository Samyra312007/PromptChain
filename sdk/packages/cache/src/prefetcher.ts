import { PrefetchHint } from './types';

export type PrefetchLoader = (key: string) => Promise<unknown>;

export class SpeculativePrefetcher {
  private config: {
    enabled: boolean;
    maxVersions: number;
    maxRelated: number;
  };
  private queue: PrefetchHint[] = [];
  private pending: Set<string> = new Set();
  private prefetchedKeys: Set<string> = new Set();
  private loader: PrefetchLoader | null = null;
  private totalPrefetched = 0;
  private totalHits = 0;

  constructor(config?: Partial<{ enabled: boolean; maxVersions: number; maxRelated: number }>) {
    this.config = {
      enabled: config?.enabled ?? true,
      maxVersions: config?.maxVersions ?? 5,
      maxRelated: config?.maxRelated ?? 3,
    };
  }

  setLoader(loader: PrefetchLoader): void {
    this.loader = loader;
  }

  onAccess(key: string, category?: string, tags?: string[]): void {
    if (!this.config.enabled) return;

    const hints = this.generateHints(key, category, tags);
    for (const hint of hints) {
      if (!this.pending.has(hint.targetKey) && !this.prefetchedKeys.has(hint.targetKey)) {
        this.queue.push(hint);
      }
    }

    void this.processQueue();
  }

  async onAccessAndWait(key: string, category?: string, tags?: string[]): Promise<void> {
    if (!this.config.enabled) return;

    const hints = this.generateHints(key, category, tags);
    for (const hint of hints) {
      if (!this.pending.has(hint.targetKey) && !this.prefetchedKeys.has(hint.targetKey)) {
        this.queue.push(hint);
      }
    }

    await this.processQueue();
  }

  onBatchAccess(keys: Array<{ key: string; category?: string; tags?: string[] }>): void {
    for (const k of keys) {
      this.onAccess(k.key, k.category, k.tags);
    }
  }

  getStats(): { totalPrefetched: number; totalHits: number; queueLength: number } {
    return {
      totalPrefetched: this.totalPrefetched,
      totalHits: this.totalHits,
      queueLength: this.queue.length,
    };
  }

  private generateHints(key: string, category?: string, tags?: string[]): PrefetchHint[] {
    const hints: PrefetchHint[] = [];

    for (let v = 1; v <= this.config.maxVersions; v++) {
      hints.push({
        type: 'version',
        targetKey: `${key}/v${v}`,
        sourceKey: key,
        priority: 10 - v,
      });
    }

    if (category) {
      hints.push({
        type: 'related',
        targetKey: `category:${category}`,
        sourceKey: key,
        priority: 5,
      });
    }

    if (tags) {
      for (let i = 0; i < Math.min(tags.length, this.config.maxRelated); i++) {
        hints.push({
          type: 'related',
          targetKey: `tag:${tags[i]}`,
          sourceKey: key,
          priority: 3 - i,
        });
      }
    }

    hints.push({
      type: 'curator',
      targetKey: `${key}/curation`,
      sourceKey: key,
      priority: 1,
    });

    return hints;
  }

  private async processQueue(): Promise<void> {
    if (!this.loader) return;

    const batch = this.queue.splice(0, 10);
    for (const hint of batch) {
      if (this.pending.has(hint.targetKey) || this.prefetchedKeys.has(hint.targetKey)) continue;
      this.pending.add(hint.targetKey);
      try {
        await this.loader(hint.targetKey);
        this.prefetchedKeys.add(hint.targetKey);
        this.totalPrefetched++;
      } catch {
        // prefetch failures are non-fatal
      } finally {
        this.pending.delete(hint.targetKey);
      }
    }
  }

  clear(): void {
    this.queue = [];
    this.pending.clear();
  }
}
