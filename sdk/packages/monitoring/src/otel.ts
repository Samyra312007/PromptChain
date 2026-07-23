import { randomBytes } from 'crypto';
import { Span, SpanKind, SpanStatus, SpanEvent, LogRecord, LogLevel } from './types';

class TracerProvider {
  private spans: Map<string, Span> = new Map();
  private logs: LogRecord[] = [];
  private maxLogs = 1000;

  startSpan(
    name: string,
    options?: {
      kind?: SpanKind;
      parentSpanId?: string;
      attributes?: Record<string, string | number | boolean>;
    },
  ): Span {
    const traceId = options?.parentSpanId
      ? (this.spans.get(options.parentSpanId)?.traceId ?? this.generateId(32))
      : this.generateId(32);
    const spanId = this.generateId(16);
    const span: Span = {
      traceId,
      spanId,
      parentSpanId: options?.parentSpanId,
      name,
      kind: options?.kind ?? 'internal',
      startTime: Date.now(),
      attributes: { ...options?.attributes },
      status: { code: 'ok' },
      events: [],
    };
    this.spans.set(spanId, span);
    return span;
  }

  endSpan(spanId: string, status?: SpanStatus): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    if (status) span.status = status;
  }

  addSpanEvent(spanId: string, name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.events.push({ name, timestamp: Date.now(), attributes: attributes ?? {} });
  }

  setSpanAttribute(spanId: string, key: string, value: string | number | boolean): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.attributes[key] = value;
  }

  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId);
  }

  getCompletedSpans(): Span[] {
    return [...this.spans.values()].filter((s) => s.endTime !== undefined);
  }

  getPendingSpans(): Span[] {
    return [...this.spans.values()].filter((s) => s.endTime === undefined);
  }

  log(
    level: LogLevel,
    message: string,
    options?: { traceId?: string; spanId?: string; attributes?: Record<string, string | number | boolean> },
  ): void {
    const record: LogRecord = {
      timestamp: Date.now(),
      level,
      message,
      traceId: options?.traceId,
      spanId: options?.spanId,
      attributes: { ...options?.attributes },
    };
    this.logs.push(record);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  getLogs(level?: LogLevel, limit = 100): LogRecord[] {
    let filtered = this.logs;
    if (level) filtered = filtered.filter((l) => l.level === level);
    return filtered.slice(-limit);
  }

  clear(): void {
    this.spans.clear();
    this.logs = [];
  }

  private generateId(bytes: number): string {
    return randomBytes(bytes).toString('hex');
  }
}

class MeterProvider {
  private measurements: Map<string, number[]> = new Map();
  private gauges: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();

  recordMeasurement(name: string, value: number, dimensions?: Record<string, string>): void {
    const key = dimensions ? `${name}:${JSON.stringify(dimensions)}` : name;
    if (!this.measurements.has(key)) this.measurements.set(key, []);
    this.measurements.get(key)!.push(value);
    if (this.measurements.get(key)!.length > 1000) {
      this.measurements.get(key)!.shift();
    }
  }

  setGauge(name: string, value: number, dimensions?: Record<string, string>): void {
    const key = dimensions ? `${name}:${JSON.stringify(dimensions)}` : name;
    this.gauges.set(key, value);
  }

  incrementCounter(name: string, value = 1, dimensions?: Record<string, string>): void {
    const key = dimensions ? `${name}:${JSON.stringify(dimensions)}` : name;
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  getCounter(name: string, dimensions?: Record<string, string>): number {
    const key = dimensions ? `${name}:${JSON.stringify(dimensions)}` : name;
    return this.counters.get(key) ?? 0;
  }

  getGauge(name: string, dimensions?: Record<string, string>): number | undefined {
    const key = dimensions ? `${name}:${JSON.stringify(dimensions)}` : name;
    return this.gauges.get(key);
  }

  getHistogram(name: string, dimensions?: Record<string, string>): {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const key = dimensions ? `${name}:${JSON.stringify(dimensions)}` : name;
    const values = this.measurements.get(key);
    if (!values || values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      count: sorted.length,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  reset(): void {
    this.measurements.clear();
    this.gauges.clear();
    this.counters.clear();
  }
}

export const tracer = new TracerProvider();
export const meter = new MeterProvider();

export function trace<T>(
  name: string,
  fn: (span: Span) => T,
  options?: { kind?: SpanKind; attributes?: Record<string, string | number | boolean> },
): T {
  const span = tracer.startSpan(name, options);
  try {
    const result = fn(span);
    if (result instanceof Promise) {
      return (result as unknown as Promise<unknown>).then(
        (r) => {
          tracer.endSpan(span.spanId);
          return r;
        },
        (err) => {
          tracer.endSpan(span.spanId, { code: 'error', message: String(err) });
          throw err;
        },
      ) as unknown as T;
    }
    tracer.endSpan(span.spanId);
    return result;
  } catch (err) {
    tracer.endSpan(span.spanId, { code: 'error', message: String(err) });
    throw err;
  }
}

export function recordLatency(name: string, durationMs: number, dimensions?: Record<string, string>): void {
  meter.recordMeasurement(name, durationMs, dimensions);
}

export function measureLatency<T>(name: string, fn: () => T, dimensions?: Record<string, string>): T {
  const start = Date.now();
  try {
    const result = fn();
    if (result instanceof Promise) {
      return (result as unknown as Promise<unknown>).then(
        (r) => {
          recordLatency(name, Date.now() - start, dimensions);
          return r;
        },
        (err) => {
          recordLatency(name, Date.now() - start, dimensions);
          throw err;
        },
      ) as unknown as T;
    }
    recordLatency(name, Date.now() - start, dimensions);
    return result;
  } catch (err) {
    recordLatency(name, Date.now() - start, dimensions);
    throw err;
  }
}
