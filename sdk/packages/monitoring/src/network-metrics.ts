import { meter } from './otel';
import { metricsRegistry } from './metrics';
import { NetworkMetricsSnapshot, MetricDimension } from './types';
import { HistogramPoint, MetricBucket } from './types';

export class NetworkMetricsCollector {
  private peerDiscoveryLatencies: number[] = [];
  private gossipPropagationDelays: number[] = [];
  private cacheHits: Map<string, number> = new Map();
  private cacheMisses: Map<string, number> = new Map();
  private connectedPeers = 0;
  private knownPeersCount = 0;
  private dhtEntriesCount = 0;
  private bandwidthIn = 0;
  private bandwidthOut = 0;
  private messageCount = 0;
  private lastMessageReset = Date.now();

  recordPeerDiscoveryLatency(latencyMs: number): void {
    this.peerDiscoveryLatencies.push(latencyMs);
    if (this.peerDiscoveryLatencies.length > 1000) this.peerDiscoveryLatencies.shift();
    meter.recordMeasurement('peer_discovery_latency', latencyMs);
    metricsRegistry.recordHistogram('peer_discovery_latency_ms', latencyMs);
  }

  recordGossipPropagationDelay(delayMs: number): void {
    this.gossipPropagationDelays.push(delayMs);
    if (this.gossipPropagationDelays.length > 1000) this.gossipPropagationDelays.shift();
    meter.recordMeasurement('gossip_propagation_delay', delayMs);
    metricsRegistry.recordHistogram('gossip_propagation_delay_ms', delayMs);
  }

  recordCacheHit(cacheName: string): void {
    this.cacheHits.set(cacheName, (this.cacheHits.get(cacheName) ?? 0) + 1);
    meter.incrementCounter(`cache_hit`, 1, { cache: cacheName });
    metricsRegistry.recordCounter('cache_hit', 1, [{ name: 'cache', value: cacheName }]);
  }

  recordCacheMiss(cacheName: string): void {
    this.cacheMisses.set(cacheName, (this.cacheMisses.get(cacheName) ?? 0) + 1);
    meter.incrementCounter(`cache_miss`, 1, { cache: cacheName });
    metricsRegistry.recordCounter('cache_miss', 1, [{ name: 'cache', value: cacheName }]);
  }

  getCacheHitRatio(cacheName: string): number {
    const hits = this.cacheHits.get(cacheName) ?? 0;
    const misses = this.cacheMisses.get(cacheName) ?? 0;
    const total = hits + misses;
    if (total === 0) return 1;
    return hits / total;
  }

  getAllCacheHitRatios(): Record<string, number> {
    const allNames = new Set([...this.cacheHits.keys(), ...this.cacheMisses.keys()]);
    const ratios: Record<string, number> = {};
    for (const name of allNames) {
      ratios[name] = this.getCacheHitRatio(name);
      meter.setGauge('cache_hit_ratio', ratios[name], { cache: name });
      metricsRegistry.recordGauge('cache_hit_ratio', ratios[name], [
        { name: 'cache', value: name },
      ]);
    }
    return ratios;
  }

  setConnectedPeers(count: number): void {
    this.connectedPeers = count;
    meter.setGauge('connected_peers', count);
    metricsRegistry.recordGauge('connected_peers', count);
  }

  setKnownPeers(count: number): void {
    this.knownPeersCount = count;
    meter.setGauge('known_peers', count);
    metricsRegistry.recordGauge('known_peers', count);
  }

  setDhtEntries(count: number): void {
    this.dhtEntriesCount = count;
    meter.setGauge('dht_entries', count);
    metricsRegistry.recordGauge('dht_entries', count);
  }

  recordBandwidth(bytesIn: number, bytesOut: number): void {
    this.bandwidthIn += bytesIn;
    this.bandwidthOut += bytesOut;
    meter.incrementCounter('bandwidth_in_bytes', bytesIn);
    meter.incrementCounter('bandwidth_out_bytes', bytesOut);
    metricsRegistry.recordCounter('bandwidth_in_bytes', bytesIn);
    metricsRegistry.recordCounter('bandwidth_out_bytes', bytesOut);
  }

  recordMessage(): void {
    this.messageCount++;
  }

  getMessagesPerSecond(): number {
    const elapsed = (Date.now() - this.lastMessageReset) / 1000;
    if (elapsed < 1) return 0;
    return this.messageCount / elapsed;
  }

  resetMessageRate(): void {
    this.messageCount = 0;
    this.lastMessageReset = Date.now();
  }

  snapshot(): NetworkMetricsSnapshot {
    return {
      peerDiscoveryLatencyMs: this.toHistogramPoint('peer_discovery_latency_ms', this.peerDiscoveryLatencies),
      gossipPropagationDelayMs: this.toHistogramPoint('gossip_propagation_delay_ms', this.gossipPropagationDelays),
      cacheHitRatios: this.getAllCacheHitRatios(),
      connectedPeers: this.connectedPeers,
      knownPeers: this.knownPeersCount,
      dhtEntries: this.dhtEntriesCount,
      bandwidthInBytes: this.bandwidthIn,
      bandwidthOutBytes: this.bandwidthOut,
      messagesPerSecond: this.getMessagesPerSecond(),
    };
  }

  reset(): void {
    this.peerDiscoveryLatencies = [];
    this.gossipPropagationDelays = [];
    this.cacheHits.clear();
    this.cacheMisses.clear();
    this.connectedPeers = 0;
    this.knownPeersCount = 0;
    this.dhtEntriesCount = 0;
    this.bandwidthIn = 0;
    this.bandwidthOut = 0;
    this.messageCount = 0;
    this.lastMessageReset = Date.now();
  }

  private toHistogramPoint(name: string, values: number[]): HistogramPoint {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const count = sorted.length;
    const boundaries = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000, 30000];
    const buckets: MetricBucket[] = boundaries.map((le) => ({
      le,
      count: sorted.filter((v) => v <= le).length,
    }));

    const point: HistogramPoint = {
      name,
      value: count > 0 ? sum / count : 0,
      type: 'histogram',
      dimensions: [],
      timestamp: Date.now(),
      buckets,
      sum,
      count,
      min: count > 0 ? sorted[0] : 0,
      max: count > 0 ? sorted[count - 1] : 0,
    };
    return point;
  }
}

export const networkMetrics = new NetworkMetricsCollector();
