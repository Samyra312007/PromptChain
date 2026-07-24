import { createHash } from 'crypto';
import type { StorageProvider } from '../provider-interface';
import type { StoredContent, StorageProviderName } from '../types';

export interface ArweaveProviderConfig {
  endpoint: string;
  protocol: 'arweave' | 'https';
  port: number;
  apiKey?: string;
}

export class ArweaveStorageProvider implements StorageProvider {
  readonly name: StorageProviderName = 'arweave';
  private config: ArweaveProviderConfig;
  private initialized = false;

  constructor(config: Partial<ArweaveProviderConfig> = {}) {
    this.config = {
      endpoint: config.endpoint || 'arweave.net',
      protocol: config.protocol || 'https',
      port: config.port || 443,
      apiKey: config.apiKey,
    };
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async store(data: Buffer | string, contentType?: string): Promise<StoredContent> {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const cid = createHash('sha256').update(buffer).digest('hex');

    const url = `${this.config.protocol}://${this.config.endpoint}/tx`;
    const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' };
    if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;

    const response = await fetch(url, { method: 'POST', body: buffer, headers });
    if (!response.ok) {
      throw new Error(`Arweave store failed: ${response.statusText}`);
    }

    return {
      cid,
      provider: 'arweave',
      size: buffer.length,
      storedAt: Date.now(),
      metadata: { contentType: contentType || 'application/octet-stream', transactionId: cid },
    };
  }

  async retrieve(cid: string): Promise<Buffer> {
    const url = `${this.config.protocol}://${this.config.endpoint}/${cid}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Arweave retrieve failed: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async exists(cid: string): Promise<boolean> {
    try {
      const url = `${this.config.protocol}://${this.config.endpoint}/tx/${cid}/status`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }

  async health(): Promise<{ available: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const url = `${this.config.protocol}://${this.config.endpoint}/info`;
      const response = await fetch(url);
      return { available: response.ok, latencyMs: Date.now() - start };
    } catch (err) {
      return { available: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}
