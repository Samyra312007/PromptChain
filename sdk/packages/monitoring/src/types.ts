export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricDimension {
  name: string;
  value: string;
}

export interface MetricPoint {
  name: string;
  value: number;
  type: MetricType;
  dimensions: MetricDimension[];
  timestamp: number;
  unit?: string;
  description?: string;
}

export interface MetricBucket {
  le: number;
  count: number;
}

export interface HistogramPoint extends MetricPoint {
  type: 'histogram';
  buckets: MetricBucket[];
  sum: number;
  count: number;
  min: number;
  max: number;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  attributes: Record<string, string | number | boolean>;
  status: SpanStatus;
  events: SpanEvent[];
}

export type SpanKind = 'internal' | 'client' | 'server' | 'producer' | 'consumer';

export interface SpanStatus {
  code: 'ok' | 'error';
  message?: string;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, string | number | boolean>;
}

export interface LogRecord {
  timestamp: number;
  level: LogLevel;
  message: string;
  traceId?: string;
  spanId?: string;
  attributes: Record<string, string | number | boolean>;
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface AlertRule {
  name: string;
  description: string;
  metricName: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownMs: number;
  lastFiredAt?: number;
}

export type AlertCondition =
  | { type: 'gt'; threshold: number }
  | { type: 'lt'; threshold: number }
  | { type: 'gte'; threshold: number }
  | { type: 'lte'; threshold: number }
  | { type: 'eq'; threshold: number }
  | { type: 'percentile_gt'; percentile: number; threshold: number };

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertEvent {
  rule: string;
  description: string;
  severity: AlertSeverity;
  metricName: string;
  currentValue: number;
  threshold: number;
  condition: string;
  timestamp: number;
}

export interface SubsystemStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: number;
  message?: string;
  metrics?: Record<string, number>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  subsystems: SubsystemStatus[];
  alerts: AlertEvent[];
  timestamp: number;
}

export interface MonitoringConfig {
  serviceName: string;
  serviceVersion: string;
  enableTracing: boolean;
  enableMetrics: boolean;
  enableLogging: boolean;
  enableAlerts: boolean;
  enableHealthCheck: boolean;
  exportIntervalMs: number;
  alertCheckIntervalMs: number;
  metricMaxAgeMs: number;
}

export interface KernelMetricsSnapshot {
  instructionExecutionTimeMs: HistogramPoint;
  accountSizeBytes: HistogramPoint;
  cuConsumption: HistogramPoint;
  totalInstructions: number;
  instructionsByType: Record<string, number>;
  accountCount: number;
}

export interface NetworkMetricsSnapshot {
  peerDiscoveryLatencyMs: HistogramPoint;
  gossipPropagationDelayMs: HistogramPoint;
  cacheHitRatios: Record<string, number>;
  connectedPeers: number;
  knownPeers: number;
  dhtEntries: number;
  bandwidthInBytes: number;
  bandwidthOutBytes: number;
  messagesPerSecond: number;
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  serviceName: 'promptchain',
  serviceVersion: '0.1.0',
  enableTracing: true,
  enableMetrics: true,
  enableLogging: true,
  enableAlerts: true,
  enableHealthCheck: true,
  exportIntervalMs: 10_000,
  alertCheckIntervalMs: 5_000,
  metricMaxAgeMs: 300_000,
};

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    name: 'network_partition_detected',
    description: 'Network partition detected — too many peers dropping',
    metricName: 'promptchain_dropped_peers',
    condition: { type: 'gt', threshold: 10 },
    severity: 'critical',
    enabled: true,
    cooldownMs: 60_000,
  },
  {
    name: 'cache_thrashing',
    description: 'Cache thrashing — hit ratio below threshold, consider resizing',
    metricName: 'promptchain_cache_hit_ratio',
    condition: { type: 'lt', threshold: 0.8 },
    severity: 'warning',
    enabled: true,
    cooldownMs: 120_000,
  },
  {
    name: 'fork_spam_detected',
    description: 'Someone is spamming forks — fork depth percentile is critically high',
    metricName: 'promptchain_fork_depth_percentile_99',
    condition: { type: 'gt', threshold: 100 },
    severity: 'warning',
    enabled: true,
    cooldownMs: 300_000,
  },
  {
    name: 'rpc_congestion',
    description: 'RPC congestion — publish latency exceeds threshold',
    metricName: 'promptchain_publish_latency',
    condition: { type: 'gt', threshold: 5000 },
    severity: 'critical',
    enabled: true,
    cooldownMs: 60_000,
  },
];
