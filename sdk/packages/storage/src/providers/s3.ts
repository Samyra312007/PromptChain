import { createHash } from 'crypto';
import type { StorageProvider } from '../provider-interface';
import type { StoredContent, StorageProviderName } from '../types';

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  usePathStyle?: boolean;
}

export class S3StorageProvider implements StorageProvider {
  readonly name: StorageProviderName = 's3';
  private config: S3StorageConfig;

  constructor(config: S3StorageConfig) {
    this.config = {
      usePathStyle: false,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    const url = this.makeUrl('');
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`S3 bucket ${this.config.bucket} not accessible: ${response.statusText}`);
    }
  }

  async store(data: Buffer | string, contentType?: string): Promise<StoredContent> {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const cid = createHash('sha256').update(buffer).digest('hex');
    const url = this.makeUrl(cid);

    const dateStr = new Date().toUTCString();
    const response = await fetch(url, {
      method: 'PUT',
      body: buffer,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': String(buffer.length),
        'Date': dateStr,
        'Host': new URL(url).hostname,
      },
    });

    if (!response.ok) {
      throw new Error(`S3 store failed: ${response.statusText}`);
    }

    return {
      cid,
      provider: 's3',
      size: buffer.length,
      storedAt: Date.now(),
      metadata: { contentType: contentType || 'application/octet-stream', bucket: this.config.bucket },
    };
  }

  async retrieve(cid: string): Promise<Buffer> {
    const url = this.makeUrl(cid);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`S3 retrieve failed: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async exists(cid: string): Promise<boolean> {
    try {
      const url = this.makeUrl(cid);
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async delete(cid: string): Promise<boolean> {
    try {
      const url = this.makeUrl(cid);
      const response = await fetch(url, { method: 'DELETE' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async health(): Promise<{ available: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const url = this.makeUrl('');
      const response = await fetch(url, { method: 'HEAD' });
      return { available: response.ok || response.status === 404, latencyMs: Date.now() - start };
    } catch (err) {
      return { available: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }

  private makeUrl(key: string): string {
    const base = this.config.usePathStyle
      ? `${this.config.endpoint}/${this.config.bucket}`
      : `https://${this.config.bucket}.${this.config.endpoint}`;
    return key ? `${base}/${key}` : base;
  }
}
