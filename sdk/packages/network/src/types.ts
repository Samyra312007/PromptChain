export interface PeerInfo {
  id: string;
  multiaddrs: string[];
  agentVersion?: string;
  protocolVersion?: string;
  connectedAt?: number;
  lastSeen: number;
  reputation?: number;
  bandwidthStats?: BandwidthStats;
  latencyMs?: number;
}

export interface BandwidthStats {
  totalBytesIn: number;
  totalBytesOut: number;
  rateInBps: number;
  rateOutBps: number;
  lastUpdated: number;
}

export interface BandwidthLimit {
  maxBytesInPerSec: number;
  maxBytesOutPerSec: number;
}

export interface PeerDiscoveryConfig {
  enabled: boolean;
  bootstrapPeers?: string[];
  maxPeers: number;
  discoveryIntervalMs: number;
  useOnChainRegistry: boolean;
}

export interface DHTEntry {
  key: string;
  value: string;
  publisher: string;
  timestamp: number;
  ttl: number;
}

export interface GossipMessage {
  topic: string;
  data: string;
  from: string;
  sequence: number;
  timestamp: number;
}

export interface OfflineQueueEntry {
  id: string;
  type: 'publish' | 'version' | 'rate' | 'transfer' | 'feedback' | 'custom';
  payload: string;
  createdAt: number;
  retries: number;
  maxRetries: number;
  lastError?: string;
}

export interface NodeConfig {
  port: number;
  host: string;
  peerId?: string;
  privateKey?: string;
  bootstrapPeers?: string[];
  maxPeers: number;
  discoveryIntervalMs: number;
  dhtEnabled: boolean;
  gossipEnabled: boolean;
  bandwidthAccounting: boolean;
  bandwidthLimit?: BandwidthLimit;
  offlineQueueEnabled: boolean;
  offlineQueueMaxRetries: number;
  onChainRegistryRpc?: string;
  natTraversal?: NATTraversalConfig;
}

export interface NATTraversalConfig {
  enabled: boolean;
  stunServers: string[];
  turnServers: Array<{ url: string; username: string; credential: string }>;
}

export interface NodeStatus {
  started: boolean;
  peerId: string;
  connectedPeers: number;
  knownPeers: number;
  dhtEntries: number;
  bandwidthIn: number;
  bandwidthOut: number;
  queueLength: number;
  uptime: number;
  multiaddrs: string[];
}

export type NetworkEvent = 
  | { type: 'peer:connected'; peerId: string }
  | { type: 'peer:disconnected'; peerId: string }
  | { type: 'message'; topic: string; data: string; from: string }
  | { type: 'discovery:found'; peerId: string; multiaddrs: string[] }
  | { type: 'bandwidth:limit_reached'; peerId: string; direction: 'in' | 'out' }
  | { type: 'queue:drained' }
  | { type: 'dht:value_stored'; key: string }
  | { type: 'error'; error: string };

export type NetworkEventHandler = (event: NetworkEvent) => void;
