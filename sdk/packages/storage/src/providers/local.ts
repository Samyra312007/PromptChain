import { readFile, writeFile, mkdir, stat, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import type { StorageProvider } from '../provider-interface';
import type { StoredContent, StorageProviderName } from '../types';

export interface LocalStorageConfig {
  basePath: string;
}

export class LocalStorageProvider implements StorageProvider {
  readonly name: StorageProviderName = 'local';
  private config: LocalStorageConfig;

  constructor(config: Partial<LocalStorageConfig> = {}) {
    this.config = {
      basePath: config.basePath || './.promptchain/storage/local',
    };
  }

  async initialize(): Promise<void> {
    await mkdir(this.config.basePath, { recursive: true });
  }

  async store(data: Buffer | string, contentType?: string): Promise<StoredContent> {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const cid = createHash('sha256').update(buffer).digest('hex');
    const filePath = this.contentPath(cid);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);

    return {
      cid,
      provider: 'local',
      size: buffer.length,
      storedAt: Date.now(),
      metadata: { contentType: contentType || 'application/octet-stream', path: filePath },
    };
  }

  async retrieve(cid: string): Promise<Buffer> {
    const filePath = this.contentPath(cid);
    return readFile(filePath);
  }

  async exists(cid: string): Promise<boolean> {
    try {
      await stat(this.contentPath(cid));
      return true;
    } catch {
      return false;
    }
  }

  async delete(cid: string): Promise<boolean> {
    try {
      await unlink(this.contentPath(cid));
      return true;
    } catch {
      return false;
    }
  }

  async health(): Promise<{ available: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await stat(this.config.basePath);
      return { available: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { available: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }

  private contentPath(cid: string): string {
    return join(this.config.basePath, cid.slice(0, 2), cid);
  }
}
