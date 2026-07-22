import { randomBytes } from 'crypto';
import { OfflineQueueEntry } from './types';

export interface OfflineQueueConfig {
  enabled: boolean;
  maxRetries: number;
  storagePath?: string;
}

export class OfflineQueue {
  private config: OfflineQueueConfig;
  private queue: OfflineQueueEntry[] = [];

  constructor(config: Partial<OfflineQueueConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      maxRetries: config.maxRetries || 5,
      storagePath: config.storagePath,
    };
  }

  enqueue(entry: Partial<OfflineQueueEntry> & { type: OfflineQueueEntry['type']; payload: string }): string {
    if (!this.config.enabled) return '';

    const id = entry.id || `${Date.now()}_${randomBytes(4).toString('hex')}`;
    const fullEntry: OfflineQueueEntry = {
      id,
      type: entry.type,
      payload: entry.payload,
      createdAt: entry.createdAt || Date.now(),
      retries: entry.retries || 0,
      maxRetries: entry.maxRetries || this.config.maxRetries,
      lastError: entry.lastError,
    };

    this.queue.push(fullEntry);
    return id;
  }

  drain(handler: (entry: OfflineQueueEntry) => void): number {
    const before = this.queue.length;
    this.queue = this.queue.filter((entry) => {
      if (entry.retries >= entry.maxRetries) return false;
      try {
        entry.retries++;
        handler(entry);
        return false;
      } catch (err) {
        entry.lastError = err instanceof Error ? err.message : String(err);
        return true;
      }
    });
    return before - this.queue.length;
  }

  peek(): OfflineQueueEntry[] {
    return [...this.queue];
  }

  remove(id: string): boolean {
    const before = this.queue.length;
    this.queue = this.queue.filter((e) => e.id !== id);
    return this.queue.length < before;
  }

  length(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  getEntriesByType(type: OfflineQueueEntry['type']): OfflineQueueEntry[] {
    return this.queue.filter((e) => e.type === type);
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  hasPending(): boolean {
    return this.queue.length > 0;
  }
}
