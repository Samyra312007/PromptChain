import { createHash } from 'crypto';
import type { StorageProvider } from '../provider-interface';
import type { StoredContent, StorageProviderName } from '../types';

export interface FilecoinConfig {
  apiEndpoint: string;
  apiToken?: string;
  walletAddress?: string;
  dealDurationDays: number;
  replicationFactor: number;
}

export class FilecoinStorageProvider implements StorageProvider {
  readonly name: StorageProviderName = 'filecoin';
  private config: FilecoinConfig;
  private initialized = false;

  constructor(config: Partial<FilecoinConfig> = {}) {
    this.config = {
      apiEndpoint: config.apiEndpoint || 'https://api.filecoin.io',
      apiToken: config.apiToken,
      walletAddress: config.walletAddress,
      dealDurationDays: config.dealDurationDays || 180,
      replicationFactor: config.replicationFactor || 1,
    };
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async store(data: Buffer | string, contentType?: string): Promise<StoredContent> {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const cid = createHash('sha256').update(buffer).digest('hex');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiToken) headers['Authorization'] = `Bearer ${this.config.apiToken}`;

    const body = JSON.stringify({
      cid,
      data: buffer.toString('base64'),
      duration: this.config.dealDurationDays * 86400,
      replication: this.config.replicationFactor,
      wallet: this.config.walletAddress,
    });

    const response = await fetch(`${this.config.apiEndpoint}/api/v1/deals`, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Filecoin store failed: ${response.statusText}`);
    }

    return {
      cid,
      provider: 'filecoin',
      size: buffer.length,
      storedAt: Date.now(),
      metadata: { contentType: contentType || 'application/octet-stream', dealDuration: `${this.config.dealDurationDays}d` },
    };
  }

  async retrieve(cid: string): Promise<Buffer> {
    const headers: Record<string, string> = {};
    if (this.config.apiToken) headers['Authorization'] = `Bearer ${this.config.apiToken}`;

    const response = await fetch(`${this.config.apiEndpoint}/api/v1/deals/${cid}/data`, { headers });
    if (!response.ok) {
      throw new Error(`Filecoin retrieve failed: ${response.statusText}`);
    }
    const json = await response.json() as { data: string };
    return Buffer.from(json.data, 'base64');
  }

  async exists(cid: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.config.apiToken) headers['Authorization'] = `Bearer ${this.config.apiToken}`;

      const response = await fetch(`${this.config.apiEndpoint}/api/v1/deals/${cid}`, { headers });
      return response.ok;
    } catch {
      return false;
    }
  }

  async health(): Promise<{ available: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/v1/status`);
      return { available: response.ok, latencyMs: Date.now() - start };
    } catch (err) {
      return { available: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}
