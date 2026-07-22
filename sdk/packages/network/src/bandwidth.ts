import { BandwidthStats, BandwidthLimit } from './types';

export interface BandwidthConfig {
  enabled: boolean;
  limit?: BandwidthLimit;
  windowMs?: number;
}

export class BandwidthTracker {
  private config: BandwidthConfig;
  private peerStats: Map<string, { bytesIn: number; bytesOut: number; lastUpdate: number }> = new Map();
  private totalBytesIn = 0;
  private totalBytesOut = 0;
  private windowBytesIn: number[] = [];
  private windowBytesOut: number[] = [];
  private windowTimestamps: number[] = [];
  private windowMs: number;

  constructor(config: Partial<BandwidthConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      limit: config.limit,
      windowMs: config.windowMs || 1000,
    };
    this.windowMs = this.config.windowMs ?? 1000;
  }

  recordBytesIn(bytes: number, peerId?: string): void {
    if (!this.config.enabled) return;
    this.totalBytesIn += bytes;
    this.windowBytesIn.push(bytes);
    this.windowTimestamps.push(Date.now());

    if (peerId) {
      const stats = this.peerStats.get(peerId) || { bytesIn: 0, bytesOut: 0, lastUpdate: Date.now() };
      stats.bytesIn += bytes;
      stats.lastUpdate = Date.now();
      this.peerStats.set(peerId, stats);
    }

    this.pruneWindow();
  }

  recordBytesOut(bytes: number, peerId?: string): void {
    if (!this.config.enabled) return;
    this.totalBytesOut += bytes;
    this.windowBytesOut.push(bytes);
    this.windowTimestamps.push(Date.now());

    if (peerId) {
      const stats = this.peerStats.get(peerId) || { bytesIn: 0, bytesOut: 0, lastUpdate: Date.now() };
      stats.bytesOut += bytes;
      stats.lastUpdate = Date.now();
      this.peerStats.set(peerId, stats);
    }

    this.pruneWindow();
  }

  getRateInBps(): number {
    this.pruneWindow();
    const windowDuration = this.getWindowDuration();
    if (windowDuration === 0) return 0;
    const total = this.windowBytesIn.reduce((sum, b) => sum + b, 0);
    return Math.round((total / windowDuration) * 1000);
  }

  getRateOutBps(): number {
    this.pruneWindow();
    const windowDuration = this.getWindowDuration();
    if (windowDuration === 0) return 0;
    const total = this.windowBytesOut.reduce((sum, b) => sum + b, 0);
    return Math.round((total / windowDuration) * 1000);
  }

  getTotalIn(): number {
    return this.totalBytesIn;
  }

  getTotalOut(): number {
    return this.totalBytesOut;
  }

  getPeerStats(peerId: string): { bytesIn: number; bytesOut: number } | undefined {
    const stats = this.peerStats.get(peerId);
    if (!stats) return undefined;
    return { bytesIn: stats.bytesIn, bytesOut: stats.bytesOut };
  }

  getBandwidthStats(): BandwidthStats {
    return {
      totalBytesIn: this.totalBytesIn,
      totalBytesOut: this.totalBytesOut,
      rateInBps: this.getRateInBps(),
      rateOutBps: this.getRateOutBps(),
      lastUpdated: Date.now(),
    };
  }

  isRateLimited(peerId: string, direction: 'in' | 'out'): boolean {
    if (!this.config.limit) return false;
    const rate = direction === 'in' ? this.getRateInBps() : this.getRateOutBps();
    const limit = direction === 'in' ? this.config.limit.maxBytesInPerSec : this.config.limit.maxBytesOutPerSec;
    return rate > limit;
  }

  getPeerUploadRatio(peerId: string): number {
    const stats = this.peerStats.get(peerId);
    if (!stats || stats.bytesIn === 0) return stats?.bytesOut ? stats.bytesOut / stats.bytesIn : 1;
    return stats.bytesIn > 0 ? stats.bytesOut / stats.bytesIn : 0;
  }

  isLeeching(peerId: string, ratioThreshold = 0.1): boolean {
    const ratio = this.getPeerUploadRatio(peerId);
    return ratio < ratioThreshold;
  }

  private pruneWindow(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.windowTimestamps.length > 0 && this.windowTimestamps[0] < cutoff) {
      this.windowTimestamps.shift();
      this.windowBytesIn.shift();
      this.windowBytesOut.shift();
    }
  }

  private getWindowDuration(): number {
    // the max safe window duration is limited to the configured window
    if (this.windowTimestamps.length === 0) return 0;

    // if we have less than 2 points, estimate based on configured window
    if (this.windowTimestamps.length < 2) {
      // return the smaller of now - first point or window width
      return Math.min(Date.now() - this.windowTimestamps[0], this.windowMs);
    }

    return Math.min(
      this.windowTimestamps[this.windowTimestamps.length - 1] - this.windowTimestamps[0],
      this.windowMs,
    );
  }

  reset(): void {
    this.peerStats.clear();
    this.totalBytesIn = 0;
    this.totalBytesOut = 0;
    this.windowBytesIn = [];
    this.windowBytesOut = [];
    this.windowTimestamps = [];
  }
}
