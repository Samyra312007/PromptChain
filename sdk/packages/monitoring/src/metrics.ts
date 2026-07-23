import { meter } from './otel';
import { MetricPoint, MetricDimension } from './types';

export class MetricsRegistry {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private maxHistory = 100;

  recordCounter(name: string, value: number, dimensions?: MetricDimension[]): void {
    meter.incrementCounter(name, value, this.dimensionsToRecord(dimensions));
    this.record({ name, value, type: 'counter', dimensions: dimensions ?? [], timestamp: Date.now() });
  }

  recordGauge(name: string, value: number, dimensions?: MetricDimension[]): void {
    meter.setGauge(name, value, this.dimensionsToRecord(dimensions));
    this.record({ name, value, type: 'gauge', dimensions: dimensions ?? [], timestamp: Date.now() });
  }

  recordHistogram(name: string, value: number, dimensions?: MetricDimension[]): void {
    meter.recordMeasurement(name, value, this.dimensionsToRecord(dimensions));
    this.record({ name, value, type: 'histogram', dimensions: dimensions ?? [], timestamp: Date.now() });
  }

  getMetric(name: string, dimensions?: MetricDimension[]): MetricPoint[] {
    const key = this.metricKey(name, dimensions);
    return this.metrics.get(key) ?? [];
  }

  getLatestMetric(name: string, dimensions?: MetricDimension[]): MetricPoint | undefined {
    const points = this.getMetric(name, dimensions);
    return points.length > 0 ? points[points.length - 1] : undefined;
  }

  getCounterValue(name: string, dimensions?: MetricDimension[]): number {
    return meter.getCounter(name, this.dimensionsToRecord(dimensions));
  }

  getGaugeValue(name: string, dimensions?: MetricDimension[]): number | undefined {
    return meter.getGauge(name, this.dimensionsToRecord(dimensions));
  }

  getHistogramStats(name: string, dimensions?: MetricDimension[]) {
    return meter.getHistogram(name, this.dimensionsToRecord(dimensions));
  }

  getAllMetrics(): MetricPoint[] {
    const all: MetricPoint[] = [];
    for (const points of this.metrics.values()) {
      all.push(...points);
    }
    return all;
  }

  getMetricNames(): string[] {
    return [...new Set([...this.metrics.keys()].map((k) => k.split(':')[0]))];
  }

  clear(): void {
    this.metrics.clear();
  }

  private record(point: MetricPoint): void {
    const key = this.metricKey(point.name, point.dimensions);
    if (!this.metrics.has(key)) this.metrics.set(key, []);
    const history = this.metrics.get(key)!;
    history.push(point);
    if (history.length > this.maxHistory) history.shift();
  }

  private metricKey(name: string, dimensions?: MetricDimension[]): string {
    if (!dimensions || dimensions.length === 0) return name;
    const dimStr = dimensions.map((d) => `${d.name}=${d.value}`).sort().join(',');
    return `${name}:{${dimStr}}`;
  }

  private dimensionsToRecord(dimensions?: MetricDimension[]): Record<string, string> | undefined {
    if (!dimensions || dimensions.length === 0) return undefined;
    const record: Record<string, string> = {};
    for (const d of dimensions) record[d.name] = d.value;
    return record;
  }
}

export const metricsRegistry = new MetricsRegistry();
