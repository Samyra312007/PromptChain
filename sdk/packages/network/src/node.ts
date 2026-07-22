import { randomBytes, createHash } from 'crypto';
import { createServer, Socket, connect as tcpConnect } from 'net';
import {
  NodeConfig,
  PeerInfo,
  NodeStatus,
  DHTEntry,
  GossipMessage,
  NetworkEvent,
  NetworkEventHandler,
  OfflineQueueEntry,
  BandwidthStats,
} from './types';
import { PeerDiscovery } from './peer-discovery';
import { BandwidthTracker } from './bandwidth';
import { OfflineQueue } from './offline-queue';

const DHT_REPLICATION = 3;
const DHT_TTL = 300_000;
const GOSSIP_FANOUT = 6;
const MAX_MESSAGE_SIZE = 1024 * 1024;

interface PeerConnection {
  socket: Socket;
  peerId: string;
  connectedAt: number;
}

interface StoredMessage {
  id: string;
  data: string;
  timestamp: number;
}

export class P2PNode {
  private config: NodeConfig;
  private peerId: string;
  private server: ReturnType<typeof createServer> | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private knownPeers: Map<string, PeerInfo> = new Map();
  private dht: Map<string, DHTEntry> = new Map();
  private messages: Map<string, StoredMessage> = new Map();
  private messageSequence = 0;
  private handlers: Set<NetworkEventHandler> = new Set();
  private started = false;
  private startTime = 0;
  private multiaddrs: string[] = [];

  private discovery: PeerDiscovery;
  private bandwidth: BandwidthTracker;
  private offlineQueue: OfflineQueue;

  private discoverTimer: ReturnType<typeof setInterval> | null = null;
  private dhtCleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<NodeConfig> = {}) {
    this.config = {
      port: config.port || 0,
      host: config.host || '0.0.0.0',
      maxPeers: config.maxPeers || 50,
      discoveryIntervalMs: config.discoveryIntervalMs || 30_000,
      dhtEnabled: config.dhtEnabled ?? true,
      gossipEnabled: config.gossipEnabled ?? true,
      bandwidthAccounting: config.bandwidthAccounting ?? true,
      offlineQueueEnabled: config.offlineQueueEnabled ?? true,
      offlineQueueMaxRetries: config.offlineQueueMaxRetries || 5,
      ...config,
    };

    const seed = randomBytes(32).toString('hex');
    this.peerId = `12D3KooW${createHash('sha256').update(seed).digest('hex').slice(0, 40)}`;

    this.discovery = new PeerDiscovery({
      bootstrapPeers: config.bootstrapPeers || [],
      maxPeers: this.config.maxPeers,
      discoveryIntervalMs: this.config.discoveryIntervalMs,
    });

    this.bandwidth = new BandwidthTracker({
      enabled: this.config.bandwidthAccounting,
      limit: config.bandwidthLimit,
    });

    this.offlineQueue = new OfflineQueue({
      enabled: this.config.offlineQueueEnabled,
      maxRetries: this.config.offlineQueueMaxRetries,
    });
  }

  getPeerId(): string {
    return this.peerId;
  }

  getMultiaddrs(): string[] {
    return [...this.multiaddrs];
  }

  getConnectedPeers(): Map<string, PeerInfo> {
    const result = new Map<string, PeerInfo>();
    for (const [id, conn] of this.peers) {
      const info = this.knownPeers.get(id);
      if (info) result.set(id, info);
    }
    return result;
  }

  getKnownPeers(): Map<string, PeerInfo> {
    return new Map(this.knownPeers);
  }

  getBandwidthTracker(): BandwidthTracker {
    return this.bandwidth;
  }

  getOfflineQueue(): OfflineQueue {
    return this.offlineQueue;
  }

  getPeerDiscovery(): PeerDiscovery {
    return this.discovery;
  }

  on(handler: NetworkEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(event: NetworkEvent): void {
    for (const handler of this.handlers) {
      try { handler(event); } catch { /* ignore handler errors */ }
    }
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.startTime = Date.now();

    return new Promise((resolve) => {
      this.server = createServer((socket) => this.handleConnection(socket));
      this.server.listen(this.config.port, this.config.host, () => {
        const addr = this.server?.address();
        if (addr && typeof addr === 'object') {
          this.multiaddrs.push(`/ip4/${this.config.host}/tcp/${addr.port}`);
        }
        this.started = true;
        this.startTimers();
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.stopTimers();

    for (const [id, conn] of this.peers) {
      conn.socket.end();
    }
    this.peers.clear();

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.started = false;
          this.server = null;
          resolve();
        });
      } else {
        this.started = false;
        resolve();
      }
    });
  }

  async dial(addr: string): Promise<boolean> {
    const match = addr.match(/\/ip4\/([^\/]+)\/tcp\/(\d+)/);
    if (!match) return false;
    const host = match[1];
    const port = parseInt(match[2]);

    return new Promise((resolve) => {
      const socket = tcpConnect({ host, port }, () => {
        this.handleConnection(socket, true);
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 5000);
    });
  }

  async publish(topic: string, data: string): Promise<void> {
    if (!this.config.gossipEnabled) return;
    const msg: GossipMessage = {
      topic,
      data,
      from: this.peerId,
      sequence: ++this.messageSequence,
      timestamp: Date.now(),
    };

    const key = `${topic}:${msg.sequence}`;
    this.messages.set(key, { id: key, data: JSON.stringify(msg), timestamp: Date.now() });

    if (this.peers.size === 0) {
      if (this.config.offlineQueueEnabled) {
        this.offlineQueue.enqueue({
          id: key,
          type: 'custom',
          payload: JSON.stringify(msg),
          createdAt: Date.now(),
          retries: 0,
          maxRetries: this.config.offlineQueueMaxRetries,
        });
      }
      return;
    }

    const dataStr = JSON.stringify(msg);
    const encoded = Buffer.from(JSON.stringify({ type: 'gossip', topic, data: dataStr }));

    const peerIds = [...this.peers.keys()];
    const fanout = peerIds.slice(0, GOSSIP_FANOUT);
    for (const pid of fanout) {
      const conn = this.peers.get(pid);
      if (conn) {
        this.sendMessage(conn.socket, encoded);
        this.bandwidth.recordBytesOut(encoded.length, pid);
      }
    }
  }

  async storeDHT(key: string, value: string): Promise<void> {
    if (!this.config.dhtEnabled) return;
    const entry: DHTEntry = {
      key,
      value,
      publisher: this.peerId,
      timestamp: Date.now(),
      ttl: DHT_TTL,
    };
    this.dht.set(key, entry);
    this.emit({ type: 'dht:value_stored', key });

    const encoded = Buffer.from(JSON.stringify({ type: 'dht_store', key, value }));
    const peerIds = [...this.peers.keys()];
    const targets = peerIds.slice(0, DHT_REPLICATION);
    for (const pid of targets) {
      const conn = this.peers.get(pid);
      if (conn) {
        this.sendMessage(conn.socket, encoded);
        this.bandwidth.recordBytesOut(encoded.length, pid);
      }
    }
  }

  async findDHT(key: string): Promise<DHTEntry | undefined> {
    if (!this.config.dhtEnabled) return undefined;

    const local = this.dht.get(key);
    if (local) return local;

    const encoded = Buffer.from(JSON.stringify({ type: 'dht_find', key }));
    for (const [pid, conn] of this.peers) {
      this.sendMessage(conn.socket, encoded);
      this.bandwidth.recordBytesOut(encoded.length, pid);
    }
    return undefined;
  }

  getStatus(): NodeStatus {
    return {
      started: this.started,
      peerId: this.peerId,
      connectedPeers: this.peers.size,
      knownPeers: this.knownPeers.size,
      dhtEntries: this.dht.size,
      bandwidthIn: this.bandwidth.getTotalIn(),
      bandwidthOut: this.bandwidth.getTotalOut(),
      queueLength: this.offlineQueue.length(),
      uptime: this.started ? Date.now() - this.startTime : 0,
      multiaddrs: this.multiaddrs,
    };
  }

  private handleConnection(socket: Socket, outbound = false): void {
    const remoteAddr = `${socket.remoteAddress || 'unknown'}:${socket.remotePort || 0}`;
    const peerId = createHash('sha256').update(remoteAddr).digest('hex').slice(0, 16);
    let buffer = Buffer.alloc(0);

    if (this.peers.has(peerId)) {
      socket.end();
      return;
    }

    const conn: PeerConnection = { socket, peerId, connectedAt: Date.now() };
    this.peers.set(peerId, conn);
    this.knownPeers.set(peerId, {
      id: peerId,
      multiaddrs: [`/ip4/${socket.remoteAddress || '0.0.0.0'}/tcp/${socket.remotePort || 0}`],
      lastSeen: Date.now(),
      connectedAt: Date.now(),
    });

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      this.bandwidth.recordBytesIn(chunk.length, peerId);

      while (buffer.length >= 4) {
        const len = buffer.readUInt32BE(0);
        if (buffer.length < 4 + len) break;
        const payload = buffer.subarray(4, 4 + len);
        buffer = buffer.subarray(4 + len);
        this.handleMessage(payload, peerId);
      }
    });

    socket.on('close', () => {
      this.peers.delete(peerId);
      const info = this.knownPeers.get(peerId);
      if (info) info.lastSeen = Date.now();
      this.emit({ type: 'peer:disconnected', peerId });
    });

    socket.on('error', () => {
      this.peers.delete(peerId);
    });

    const handshake = Buffer.from(JSON.stringify({
      type: 'handshake',
      peerId: this.peerId,
      agentVersion: 'promptchain/0.1.0',
    }));
    this.sendMessage(socket, handshake);

    if (outbound) {
      this.bandwidth.recordBytesOut(handshake.length, peerId);
    }

    this.emit({ type: 'peer:connected', peerId });
  }

  private handleMessage(payload: Buffer, fromPeer: string): void {
    try {
      const msg = JSON.parse(payload.toString());
      switch (msg.type) {
        case 'handshake': {
          const info = this.knownPeers.get(fromPeer);
          if (info) {
            info.agentVersion = msg.agentVersion || info.agentVersion;
            info.lastSeen = Date.now();
          }
          break;
        }
        case 'gossip': {
          const gossipData: GossipMessage = JSON.parse(msg.data);
          this.emit({ type: 'message', topic: msg.topic, data: gossipData.data, from: fromPeer });
          break;
        }
        case 'dht_store': {
          const entry: DHTEntry = {
            key: msg.key,
            value: msg.value,
            publisher: fromPeer,
            timestamp: Date.now(),
            ttl: DHT_TTL,
          };
          this.dht.set(msg.key, entry);
          break;
        }
        case 'dht_find': {
          const found = this.dht.get(msg.key);
          if (found) {
            const encoded = Buffer.from(JSON.stringify({ type: 'dht_found', key: msg.key, entry: found }));
            const conn = this.peers.get(fromPeer);
            if (conn) {
              this.sendMessage(conn.socket, encoded);
              this.bandwidth.recordBytesOut(encoded.length, fromPeer);
            }
          }
          break;
        }
        case 'dht_found': {
          if (msg.entry) {
            this.dht.set(msg.key, msg.entry);
          }
          break;
        }
        case 'discover': {
          const encoded = Buffer.from(JSON.stringify({
            type: 'discover_response',
            peers: [...this.knownPeers.entries()]
              .filter(([k]) => k !== fromPeer)
              .slice(0, 20)
              .map(([, v]) => v),
          }));
          const conn = this.peers.get(fromPeer);
          if (conn) {
            this.sendMessage(conn.socket, encoded);
            this.bandwidth.recordBytesOut(encoded.length, fromPeer);
          }
          break;
        }
        case 'discover_response': {
          if (Array.isArray(msg.peers)) {
            for (const p of msg.peers as PeerInfo[]) {
              if (!this.knownPeers.has(p.id) && p.id !== this.peerId) {
                this.knownPeers.set(p.id, p);
                this.emit({ type: 'discovery:found', peerId: p.id, multiaddrs: p.multiaddrs });
              }
            }
          }
          break;
        }
      }
    } catch {
      // ignore malformed messages
    }
  }

  private sendMessage(socket: Socket, data: Buffer): void {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    try {
      socket.write(Buffer.concat([len, data]));
    } catch {
      // socket may be closed
    }
  }

  private startTimers(): void {
    this.discoverTimer = setInterval(() => this.doDiscovery(), this.config.discoveryIntervalMs);
    this.dhtCleanupTimer = setInterval(() => this.cleanDHT(), 60_000);
    this.doDiscovery();
  }

  private stopTimers(): void {
    if (this.discoverTimer) clearInterval(this.discoverTimer);
    if (this.dhtCleanupTimer) clearInterval(this.dhtCleanupTimer);
  }

  private async doDiscovery(): Promise<void> {
    const found = await this.discovery.discover(this.knownPeers, this.peers.size);
    for (const p of found) {
      if (!this.knownPeers.has(p.id) && p.id !== this.peerId) {
        this.knownPeers.set(p.id, p);
      }
    }

    const encoded = Buffer.from(JSON.stringify({ type: 'discover' }));
    for (const [pid, conn] of this.peers) {
      this.sendMessage(conn.socket, encoded);
      this.bandwidth.recordBytesOut(encoded.length, pid);
    }

    if (this.config.offlineQueueEnabled && this.peers.size > 0) {
      const drained = this.offlineQueue.drain((entry) => {
        const msg = JSON.parse(entry.payload);
        this.publish(msg.topic, msg.data);
      });
      if (drained > 0) {
        this.emit({ type: 'queue:drained' });
      }
    }
  }

  private cleanDHT(): void {
    const now = Date.now();
    for (const [key, entry] of this.dht) {
      if (now - entry.timestamp > entry.ttl) {
        this.dht.delete(key);
      }
    }
  }
}
