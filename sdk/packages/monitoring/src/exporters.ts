import { MetricPoint, HistogramPoint, Span, LogRecord, AlertEvent, HealthCheckResult } from './types';
import { tracer } from './otel';
import { metricsRegistry } from './metrics';

export interface MetricsExporter {
  export(metrics: MetricPoint[]): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface TraceExporter {
  export(spans: Span[]): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface LogExporter {
  export(logs: LogRecord[]): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export class ConsoleMetricsExporter implements MetricsExporter {
  private lastExport = 0;
  private minIntervalMs: number;

  constructor(minIntervalMs = 10_000) {
    this.minIntervalMs = minIntervalMs;
  }

  export(metrics: MetricPoint[]): void {
    const now = Date.now();
    if (now - this.lastExport < this.minIntervalMs) return;
    this.lastExport = now;

    const counters = metrics.filter((m) => m.type === 'counter');
    const gauges = metrics.filter((m) => m.type === 'gauge');
    const histograms = metrics.filter((m) => m.type === 'histogram') as HistogramPoint[];

    const lines: string[] = ['--- Metrics Export ---'];
    for (const c of counters.slice(-10)) {
      lines.push(`  COUNT ${c.name} = ${c.value}`);
    }
    for (const g of gauges.slice(-10)) {
      lines.push(`  GAUGE ${g.name} = ${g.value}`);
    }
    for (const h of histograms.slice(-5)) {
      lines.push(`  HIST  ${h.name}: count=${h.count} avg=${h.count > 0 ? (h.sum / h.count).toFixed(2) : '0'} p50=${h.count > 0 ? h.buckets.find(b => b.count >= h.count * 0.5)?.le ?? 0 : 0} p99=${h.count > 0 ? h.buckets.find(b => b.count >= h.count * 0.99)?.le ?? 0 : 0}`);
    }
    console.log(lines.join('\n'));
  }

  async flush(): Promise<void> { }
  async shutdown(): Promise<void> { }
}

export class PrometheusMetricsExporter implements MetricsExporter {
  private lastExport = 0;
  private minIntervalMs: number;

  constructor(minIntervalMs = 10_000) {
    this.minIntervalMs = minIntervalMs;
  }

  export(metrics: MetricPoint[]): void {
    const now = Date.now();
    if (now - this.lastExport < this.minIntervalMs) return;
    this.lastExport = now;

    const lines: string[] = [];
    lines.push('# HELP promptchain_metrics PromptChain monitoring metrics');
    lines.push('# TYPE promtpchain_metrics untyped');

    const byName = new Map<string, MetricPoint[]>();
    for (const m of metrics) {
      if (!byName.has(m.name)) byName.set(m.name, []);
      byName.get(m.name)!.push(m);
    }

    for (const [name, points] of byName) {
      const last = points[points.length - 1];
      const dims = last.dimensions.length > 0
        ? `{${last.dimensions.map((d) => `${d.name}="${d.value}"`).join(',')}}`
        : '';
      lines.push(`${name}${dims} ${last.value} ${last.timestamp}`);
    }

    this.output(lines.join('\n'));
  }

  getFormattedMetrics(): string {
    const allMetrics = metricsRegistry.getAllMetrics();
    const byName = new Map<string, MetricPoint[]>();
    for (const m of allMetrics) {
      if (!byName.has(m.name)) byName.set(m.name, []);
      byName.get(m.name)!.push(m);
    }

    const lines: string[] = [];
    for (const [name, points] of byName) {
      const last = points[points.length - 1];
      const dims = last.dimensions.length > 0
        ? `{${last.dimensions.map((d) => `${d.name}="${d.value}"`).join(',')}}`
        : '';
      lines.push(`${name}${dims} ${last.value}`);
    }
    return lines.join('\n');
  }

  private output(text: string): void {
    process.stdout.write(text + '\n');
  }

  async flush(): Promise<void> { }
  async shutdown(): Promise<void> { }
}

export class ConsoleTraceExporter implements TraceExporter {
  export(spans: Span[]): void {
    for (const span of spans) {
      console.log(
        `[TRACE] ${span.name}: ${span.durationMs?.toFixed(2) ?? 'pending'}ms [${span.status.code}] trace=${span.traceId.slice(0, 8)} span=${span.spanId.slice(0, 8)}`,
      );
    }
  }

  async flush(): Promise<void> { }
  async shutdown(): Promise<void> { }
}

export class ConsoleLogExporter implements LogExporter {
  export(logs: LogRecord[]): void {
    for (const log of logs) {
      const prefix = log.spanId ? `[${log.spanId.slice(0, 8)}]` : '';
      console.log(`${new Date(log.timestamp).toISOString()} [${log.level.toUpperCase()}]${prefix} ${log.message}`);
    }
  }

  async flush(): Promise<void> { }
  async shutdown(): Promise<void> { }
}

export class MonitoringExporter {
  private metricsExporter: MetricsExporter;
  private traceExporter: TraceExporter;
  private logExporter: LogExporter;
  private exportTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    metricsExporter?: MetricsExporter,
    traceExporter?: TraceExporter,
    logExporter?: LogExporter,
  ) {
    this.metricsExporter = metricsExporter ?? new ConsoleMetricsExporter();
    this.traceExporter = traceExporter ?? new ConsoleTraceExporter();
    this.logExporter = logExporter ?? new ConsoleLogExporter();
  }

  start(intervalMs = 10_000): void {
    if (this.running) return;
    this.running = true;

    this.exportTimer = setInterval(() => {
      this.doExport();
    }, intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.exportTimer) clearInterval(this.exportTimer);
    this.exportTimer = null;
  }

  private doExport(): void {
    const metrics = metricsRegistry.getAllMetrics();
    if (metrics.length > 0) this.metricsExporter.export(metrics);

    const spans = tracer.getCompletedSpans();
    if (spans.length > 0) this.traceExporter.export(spans.slice(-50));

    const logs = tracer.getLogs();
    if (logs.length > 0) this.logExporter.export(logs.slice(-20));
  }

  async flush(): Promise<void> {
    await this.metricsExporter.flush();
    await this.traceExporter.flush();
    await this.logExporter.flush();
  }

  async shutdown(): Promise<void> {
    this.stop();
    await this.flush();
    await this.metricsExporter.shutdown();
    await this.traceExporter.shutdown();
    await this.logExporter.shutdown();
  }
}
