export type StorageProviderName = 'ipfs' | 'arweave' | 'filecoin' | 's3' | 'local' | 'storj' | 'sia';

export interface StoredContent {
  cid: string;
  provider: StorageProviderName;
  size: number;
  storedAt: number;
  metadata?: Record<string, string>;
}

export interface StorageProviderConfig {
  name: StorageProviderName;
  priority: number;
  enabled: boolean;
  options?: Record<string, unknown>;
}

export interface CompositePolicy {
  providers: StorageProviderName[];
  minSurvive: number;
  strategy: 'all' | 'majority' | 'any';
}

export interface ReplicationPolicy {
  minReplicas: number;
  preferredProviders: StorageProviderName[];
  enforce: boolean;
}

export interface StorageNegotiation {
  providers: StorageProviderConfig[];
  selected: StorageProviderName;
  reason: string;
}

export interface ProviderHealth {
  name: StorageProviderName;
  available: boolean;
  latencyMs: number;
  lastChecked: number;
  error?: string;
}

export interface StoreResult {
  cid: string;
  results: Array<{
    provider: StorageProviderName;
    cid: string;
    success: boolean;
    error?: string;
    latencyMs: number;
  }>;
  composite: boolean;
  successCount: number;
  totalAttempts: number;
}
