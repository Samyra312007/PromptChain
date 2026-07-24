export interface QueueItem {
  id: string;
  type: 'publish' | 'create_version' | 'set_license' | 'transfer' | 'submit_rating' | 'custom';
  payload: string;
  createdAt: number;
  retries: number;
  maxRetries: number;
  lastError?: string;
}

export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

export interface OfflineConfig {
  enabled: boolean;
  maxRetries: number;
  storagePrefix: string;
}

export class OfflineAccess {
  private config: OfflineConfig;
  private queue: QueueItem[] = [];

  constructor(config: Partial<OfflineConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      maxRetries: config.maxRetries ?? 5,
      storagePrefix: config.storagePrefix ?? 'promptchain_offline',
    };
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  enqueue(item: Omit<QueueItem, 'id' | 'createdAt' | 'retries'>): string {
    if (!this.config.enabled) return '';
    const id = `${this.config.storagePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.queue.push({
      ...item,
      id,
      createdAt: Date.now(),
      retries: 0,
    });
    return id;
  }

  async sync(handler: (item: QueueItem) => Promise<boolean>): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, failed: 0, errors: [] };
    const remaining: QueueItem[] = [];

    for (const item of this.queue) {
      if (item.retries >= this.config.maxRetries) {
        result.failed++;
        result.errors.push(`Max retries reached for ${item.id}: ${item.lastError || 'unknown'}`);
        continue;
      }

      try {
        const success = await handler(item);
        if (success) {
          result.synced++;
        } else {
          item.retries++;
          item.lastError = 'Handler returned false';
          remaining.push(item);
        }
      } catch (err) {
        item.retries++;
        item.lastError = err instanceof Error ? err.message : String(err);
        remaining.push(item);
      }
    }

    this.queue = remaining;
    return result;
  }

  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  hasPending(): boolean {
    return this.queue.length > 0;
  }

  clear(): void {
    this.queue = [];
  }
}
