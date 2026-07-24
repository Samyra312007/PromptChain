export const LOW_BANDWIDTH_BUDGET_BYTES = 100_000;

export interface BandwidthBudget {
  maxPayloadBytes: number;
  maxResponseBytes: number;
  maxConcurrentRequests: number;
  enableImages: boolean;
  enablePreload: boolean;
  enablePrefetch: boolean;
  enableCompression: boolean;
}

export interface LowBandwidthConfig {
  enabled: boolean;
  budget?: Partial<BandwidthBudget>;
}

const DEFAULT_BUDGET: BandwidthBudget = {
  maxPayloadBytes: 10_240,
  maxResponseBytes: LOW_BANDWIDTH_BUDGET_BYTES,
  maxConcurrentRequests: 2,
  enableImages: false,
  enablePreload: false,
  enablePrefetch: false,
  enableCompression: true,
};

export class LowBandwidthMode {
  private config: LowBandwidthConfig;
  private budget: BandwidthBudget;

  constructor(config: Partial<LowBandwidthConfig> = {}) {
    this.config = { enabled: config.enabled ?? false };
    this.budget = { ...DEFAULT_BUDGET, ...config.budget };
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  getBudget(): BandwidthBudget {
    return this.budget;
  }

  setBudget(overrides: Partial<BandwidthBudget>): void {
    this.budget = { ...this.budget, ...overrides };
  }

  checkPayloadSize(bytes: number): boolean {
    if (!this.config.enabled) return true;
    return bytes <= this.budget.maxPayloadBytes;
  }

  checkResponseSize(bytes: number): boolean {
    if (!this.config.enabled) return true;
    return bytes <= this.budget.maxResponseBytes;
  }

  shouldBlockImage(): boolean {
    return this.config.enabled && !this.budget.enableImages;
  }

  shouldBlockPreload(): boolean {
    return this.config.enabled && !this.budget.enablePreload;
  }

  shouldBlockPrefetch(): boolean {
    return this.config.enabled && !this.budget.enablePrefetch;
  }

  shouldCompress(): boolean {
    return this.config.enabled && this.budget.enableCompression;
  }

  getConcurrencyLimit(): number {
    return this.config.enabled ? this.budget.maxConcurrentRequests : Infinity;
  }

  wrap<T>(payload: T): T | null {
    if (!this.config.enabled) return payload;
    const size = this.estimateSize(payload);
    if (size > this.budget.maxPayloadBytes) return null;
    return payload;
  }

  private estimateSize(value: unknown): number {
    if (typeof value === 'string') return Buffer.byteLength(value);
    if (value instanceof Buffer) return value.length;
    try {
      return Buffer.byteLength(JSON.stringify(value));
    } catch {
      return 1024;
    }
  }
}
