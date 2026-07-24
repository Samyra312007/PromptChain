import type { StorageProvider } from '../provider-interface';
import type { StoredContent, StorageProviderName } from '../types';
import { IpfsDaemonManager } from '../ipfs';

export interface IpfsProviderConfig {
  apiUrl: string;
  gatewayUrl: string;
}

export class IpfsStorageProvider implements StorageProvider {
  readonly name: StorageProviderName = 'ipfs';
  private daemon: IpfsDaemonManager;
  private config: IpfsProviderConfig;

  constructor(config: Partial<IpfsProviderConfig> = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'http://127.0.0.1:5001',
      gatewayUrl: config.gatewayUrl || 'http://127.0.0.1:8080',
    };
    this.daemon = new IpfsDaemonManager({
      apiUrl: this.config.apiUrl,
      gatewayUrl: this.config.gatewayUrl,
    });
  }

  async initialize(): Promise<void> {
    if (!this.daemon.running) {
      await this.daemon.start();
    }
  }

  async store(data: Buffer | string, contentType?: string): Promise<StoredContent> {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const cid = await this.daemon.add(buffer);
    await this.daemon.pin(cid);
    return {
      cid,
      provider: 'ipfs',
      size: buffer.length,
      storedAt: Date.now(),
      metadata: { contentType: contentType || 'application/octet-stream' },
    };
  }

  async retrieve(cid: string): Promise<Buffer> {
    return this.daemon.cat(cid);
  }

  async exists(cid: string): Promise<boolean> {
    try {
      await this.daemon.resolve(cid);
      return true;
    } catch {
      return false;
    }
  }

  async delete(cid: string): Promise<boolean> {
    try {
      await this.daemon.unpin(cid);
      return true;
    } catch {
      return false;
    }
  }

  async health(): Promise<{ available: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const running = this.daemon.running;
      return { available: running, latencyMs: Date.now() - start };
    } catch (err) {
      return { available: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}
