import type { StoredContent, StorageProviderName } from './types';

export interface StorageProvider {
  readonly name: StorageProviderName;

  initialize(): Promise<void>;

  store(data: Buffer | string, contentType?: string): Promise<StoredContent>;

  retrieve(cid: string): Promise<Buffer>;

  exists(cid: string): Promise<boolean>;

  delete?(cid: string): Promise<boolean>;

  health(): Promise<{ available: boolean; latencyMs: number; error?: string }>;
}
