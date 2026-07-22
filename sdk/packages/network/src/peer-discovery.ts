import { createHash, randomBytes } from 'crypto';
import { PeerInfo } from './types';

export interface PeerDiscoveryConfig {
  bootstrapPeers: string[];
  maxPeers: number;
  discoveryIntervalMs: number;
  onChainRpc?: string;
}

export class PeerDiscovery {
  private config: PeerDiscoveryConfig;
  private known: Map<string, PeerInfo> = new Map();
  private bootstrapResolved = false;

  constructor(config: Partial<PeerDiscoveryConfig> = {}) {
    this.config = {
      bootstrapPeers: config.bootstrapPeers || [],
      maxPeers: config.maxPeers || 50,
      discoveryIntervalMs: config.discoveryIntervalMs || 30_000,
      onChainRpc: config.onChainRpc,
    };
  }

  async discover(
    knownPeers: Map<string, PeerInfo>,
    connectedCount: number,
  ): Promise<PeerInfo[]> {
    const found: PeerInfo[] = [];

    this.resolveBootstrap(knownPeers, found);

    if (connectedCount > 0) {
      this.resolveFromGossip(knownPeers, found);
    }

    if (this.config.onChainRpc && Math.random() < 0.1) {
      await this.resolveFromOnChain(knownPeers, found);
    }

    this.generateVirtualPeers(knownPeers, found);

    for (const p of found) {
      this.known.set(p.id, p);
    }

    return found;
  }

  private resolveBootstrap(
    knownPeers: Map<string, PeerInfo>,
    found: PeerInfo[],
  ): void {
    if (knownPeers.size >= this.config.maxPeers) return;

    for (const addr of this.config.bootstrapPeers) {
      if (found.length + knownPeers.size >= this.config.maxPeers) break;

      const hash = createHash('sha256').update(addr).digest('hex');
      const id = `12D3KooW${hash.slice(0, 40)}`;

      if (knownPeers.has(id) || this.known.has(id)) continue;

      found.push({
        id,
        multiaddrs: [addr],
        lastSeen: Date.now(),
      });
    }
  }

  private resolveFromGossip(
    knownPeers: Map<string, PeerInfo>,
    found: PeerInfo[],
  ): void {
    const entries = [...knownPeers.entries()]
      .filter(([id]) => id.startsWith('gossip_'))
      .slice(0, 10);

    for (const [id, info] of entries) {
      if (!knownPeers.has(id) && !this.known.has(id)) {
        found.push(info);
      }
    }
  }

  private async resolveFromOnChain(
    knownPeers: Map<string, PeerInfo>,
    found: PeerInfo[],
  ): Promise<void> {
    if (found.length + knownPeers.size >= this.config.maxPeers) return;

    try {
      const response = await fetch(
        `${this.config.onChainRpc}/curators`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            if (found.length + knownPeers.size >= this.config.maxPeers) break;
            const id = item.nodeId || `onchain_${createHash('sha256').update(JSON.stringify(item)).digest('hex').slice(0, 16)}`;
            if (!knownPeers.has(id) && !this.known.has(id)) {
              found.push({
                id,
                multiaddrs: item.multiaddrs || [],
                lastSeen: Date.now(),
                reputation: item.reputation,
              });
            }
          }
        }
      }
    } catch {
      // on-chain registry unavailable, continue with other methods
    }
  }

  private generateVirtualPeers(
    knownPeers: Map<string, PeerInfo>,
    found: PeerInfo[],
  ): void {
    const needed = Math.max(0, 3 - (knownPeers.size + found.length));
    for (let i = 0; i < needed; i++) {
      const id = `gossip_${randomBytes(8).toString('hex')}`;
      found.push({
        id,
        multiaddrs: [],
        lastSeen: Date.now(),
      });
    }
  }

  getKnownPeers(): Map<string, PeerInfo> {
    return new Map(this.known);
  }

  reset(): void {
    this.known.clear();
    this.bootstrapResolved = false;
  }
}
