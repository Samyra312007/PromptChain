import { meter, tracer } from './otel';
import { metricsRegistry } from './metrics';
import { KernelMetricsSnapshot, MetricDimension } from './types';
import { HistogramPoint, MetricBucket } from './types';

export class KernelMetricsCollector {
  private instructionTimings: Map<string, number[]> = new Map();
  private accountSizes: number[] = [];
  private cuConsumptions: number[] = [];
  private instructionCounters: Map<string, number> = new Map();
  private startTime: number = Date.now();

  recordInstructionExecution(instructionName: string, durationMs: number): void {
    if (!this.instructionTimings.has(instructionName)) {
      this.instructionTimings.set(instructionName, []);
    }
    this.instructionTimings.get(instructionName)!.push(durationMs);
    if (this.instructionTimings.get(instructionName)!.length > 1000) {
      this.instructionTimings.get(instructionName)!.shift();
    }

    this.instructionCounters.set(
      instructionName,
      (this.instructionCounters.get(instructionName) ?? 0) + 1,
    );

    meter.recordMeasurement('instruction_execution_time', durationMs, {
      instruction: instructionName,
    });
    metricsRegistry.recordHistogram('instruction_execution_time_ms', durationMs, [
      { name: 'instruction', value: instructionName },
    ]);
    meter.incrementCounter('total_instructions', 1, { instruction: instructionName });
  }

  recordAccountSize(bytes: number): void {
    this.accountSizes.push(bytes);
    if (this.accountSizes.length > 1000) this.accountSizes.shift();
    meter.recordMeasurement('account_size_bytes', bytes);
    metricsRegistry.recordHistogram('account_size_bytes', bytes);
  }

  recordCuConsumption(cu: number): void {
    this.cuConsumptions.push(cu);
    if (this.cuConsumptions.length > 1000) this.cuConsumptions.shift();
    meter.recordMeasurement('cu_consumption', cu);
    metricsRegistry.recordHistogram('cu_consumption', cu);
  }

  getTotalInstructions(): number {
    let total = 0;
    for (const count of this.instructionCounters.values()) total += count;
    return total;
  }

  getInstructionsByType(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, count] of this.instructionCounters) result[name] = count;
    return result;
  }

  getAccountCount(): number {
    return this.accountSizes.length;
  }

  snapshot(): KernelMetricsSnapshot {
    const dimensions: MetricDimension[] = [];
    return {
      instructionExecutionTimeMs: this.toHistogramPoint('instruction_execution_time_ms', this.flattenTimings(), dimensions),
      accountSizeBytes: this.toHistogramPoint('account_size_bytes', this.accountSizes, dimensions),
      cuConsumption: this.toHistogramPoint('cu_consumption', this.cuConsumptions, dimensions),
      totalInstructions: this.getTotalInstructions(),
      instructionsByType: this.getInstructionsByType(),
      accountCount: this.getAccountCount(),
    };
  }

  reset(): void {
    this.instructionTimings.clear();
    this.accountSizes = [];
    this.cuConsumptions = [];
    this.instructionCounters.clear();
  }

  private flattenTimings(): number[] {
    const all: number[] = [];
    for (const timings of this.instructionTimings.values()) {
      all.push(...timings);
    }
    return all;
  }

  private toHistogramPoint(name: string, values: number[], dimensions: MetricDimension[]): HistogramPoint {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const count = sorted.length;
    const boundaries = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000];
    const buckets: MetricBucket[] = boundaries.map((le) => ({
      le,
      count: sorted.filter((v) => v <= le).length,
    }));

    const point: HistogramPoint = {
      name,
      value: count > 0 ? sum / count : 0,
      type: 'histogram',
      dimensions,
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

export const kernelMetrics = new KernelMetricsCollector();
