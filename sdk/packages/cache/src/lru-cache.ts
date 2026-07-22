import { CacheEntry, CacheStats, LRUCacheConfig } from './types';

interface ListNode<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  size: number;
  hitCount: number;
  prev: ListNode<T> | null;
  next: ListNode<T> | null;
}

export class LRUCache<T = unknown> {
  private config: LRUCacheConfig;
  private map: Map<string, ListNode<T>> = new Map();
  private head: ListNode<T> | null = null;
  private tail: ListNode<T> | null = null;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private currentSize = 0;

  constructor(config: Partial<LRUCacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize ?? 100 * 1024 * 1024,
      maxEntries: config.maxEntries ?? 10_000,
      ttlMs: config.ttlMs ?? 300_000,
    };
  }

  get(key: string): T | undefined {
    const node = this.map.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > node.expiresAt) {
      this.removeNode(node);
      this.map.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    node.hitCount++;
    this.moveToHead(node);
    return node.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.map.has(key)) {
      const node = this.map.get(key)!;
      this.removeNode(node);
      this.map.delete(key);
    }

    while (this.map.size >= this.config.maxEntries && this.tail) {
      this.evictTail();
    }

    const size = this.estimateSize(value);
    while (this.currentSize + size > this.config.maxSize && this.tail) {
      this.evictTail();
    }

    const now = Date.now();
    const node: ListNode<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: now + (ttlMs ?? this.config.ttlMs),
      size,
      hitCount: 0,
      prev: null,
      next: null,
    };

    this.addToHead(node);
    this.map.set(key, node);
    this.currentSize += size;
  }

  has(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    if (Date.now() > node.expiresAt) {
      this.removeNode(node);
      this.map.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.removeNode(node);
    this.map.delete(key);
    this.currentSize -= node.size;
    return true;
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
    this.currentSize = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.currentSize,
      entries: this.map.size,
      evictions: this.evictions,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  keys(): string[] {
    return [...this.map.keys()];
  }

  entries(): Array<{ key: string; value: T; hitCount: number }> {
    const result: Array<{ key: string; value: T; hitCount: number }> = [];
    let current = this.head;
    while (current) {
      result.push({ key: current.key, value: current.value, hitCount: current.hitCount });
      current = current.next;
    }
    return result;
  }

  private moveToHead(node: ListNode<T>): void {
    if (node === this.head) return;
    this.removeNode(node);
    this.addToHead(node);
  }

  private addToHead(node: ListNode<T>): void {
    node.next = this.head;
    node.prev = null;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private removeNode(node: ListNode<T>): void {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }

  private evictTail(): void {
    if (!this.tail) return;
    const node = this.tail;
    this.removeNode(node);
    this.map.delete(node.key);
    this.currentSize -= node.size;
    this.evictions++;
  }

  private estimateSize(value: T): number {
    if (typeof value === 'string') return Buffer.byteLength(value);
    if (value instanceof Buffer) return value.length;
    try {
      return Buffer.byteLength(JSON.stringify(value));
    } catch {
      return 1024;
    }
  }
}
