import { describe, it, expect, beforeEach } from 'vitest';
import { tracer, meter, trace, recordLatency, measureLatency } from '../src/otel';
import { metricsRegistry } from '../src/metrics';
import { kernelMetrics } from '../src/kernel-metrics';
import { networkMetrics } from '../src/network-metrics';
import { alertManager } from '../src/alerts';
import { healthRegistry, healthEndpoint } from '../src/health';
import { PrometheusMetricsExporter } from '../src/exporters';

beforeEach(() => {
  tracer.clear();
  meter.reset();
  metricsRegistry.clear();
  kernelMetrics.reset();
  networkMetrics.reset();
  alertManager.clear();
});

describe('TracerProvider', () => {
  it('starts and ends a span', () => {
    const span = tracer.startSpan('test-operation');
    expect(span.name).toBe('test-operation');
    expect(span.status.code).toBe('ok');
    tracer.endSpan(span.spanId);
    const completed = tracer.getCompletedSpans();
    expect(completed.length).toBe(1);
    expect(completed[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('supports parent-child span hierarchy', () => {
    const parent = tracer.startSpan('parent', { attributes: { key: 'val' } });
    const child = tracer.startSpan('child', { parentSpanId: parent.spanId });
    expect(child.traceId).toBe(parent.traceId);
    expect(child.parentSpanId).toBe(parent.spanId);
    tracer.endSpan(child.spanId);
    tracer.endSpan(parent.spanId);
  });

  it('adds span events and attributes', () => {
    const span = tracer.startSpan('eventful');
    tracer.addSpanEvent(span.spanId, 'cache.miss', { key: 'test' });
    tracer.setSpanAttribute(span.spanId, 'result', 'ok');
    tracer.endSpan(span.spanId);
    expect(span.events.length).toBe(1);
    expect(span.events[0].name).toBe('cache.miss');
    expect(span.attributes['result']).toBe('ok');
  });

  it('logs at various levels', () => {
    tracer.log('info', 'startup complete');
    tracer.log('error', 'connection failed', { attributes: { peer: 'xyz' } });
    const logs = tracer.getLogs();
    expect(logs.length).toBe(2);
    expect(logs[1].level).toBe('error');
    expect(logs[1].attributes['peer']).toBe('xyz');
  });

  it('filters logs by level', () => {
    tracer.log('info', 'info msg');
    tracer.log('warn', 'warn msg');
    tracer.log('error', 'error msg');
    const errors = tracer.getLogs('error');
    expect(errors.length).toBe(1);
    expect(errors[0].message).toBe('error msg');
  });
});

describe('MeterProvider', () => {
  it('records measurements and computes histograms', () => {
    meter.recordMeasurement('latency', 10);
    meter.recordMeasurement('latency', 20);
    meter.recordMeasurement('latency', 30);
    const hist = meter.getHistogram('latency');
    expect(hist).not.toBeNull();
    expect(hist!.count).toBe(3);
    expect(hist!.sum).toBe(60);
    expect(hist!.avg).toBe(20);
    expect(hist!.min).toBe(10);
    expect(hist!.max).toBe(30);
  });

  it('handles gauges', () => {
    meter.setGauge('temperature', 36.5);
    expect(meter.getGauge('temperature')).toBe(36.5);
    meter.setGauge('temperature', 37.0);
    expect(meter.getGauge('temperature')).toBe(37.0);
  });

  it('handles counters', () => {
    meter.incrementCounter('requests');
    meter.incrementCounter('requests');
    meter.incrementCounter('errors', 1, { type: '500' });
    expect(meter.getCounter('requests')).toBe(2);
    expect(meter.getCounter('errors', { type: '500' })).toBe(1);
  });
});

describe('trace helper', () => {
  it('wraps a synchronous function', () => {
    const result = trace('sync-op', () => 42);
    expect(result).toBe(42);
    const spans = tracer.getCompletedSpans();
    expect(spans.some((s) => s.name === 'sync-op')).toBe(true);
  });

  it('wraps an async function', async () => {
    const result = await trace('async-op', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 'done';
    });
    expect(result).toBe('done');
  });

  it('records errors in span status', () => {
    expect(() =>
      trace('failing-op', () => {
        throw new Error('oops');
      }),
    ).toThrow('oops');
    const span = tracer.getCompletedSpans().find((s) => s.name === 'failing-op');
    expect(span?.status.code).toBe('error');
  });
});

describe('measureLatency helper', () => {
  it('records latency for sync functions', () => {
    measureLatency('test-latency', () => 'result');
    const hist = meter.getHistogram('test-latency');
    expect(hist).not.toBeNull();
    expect(hist!.count).toBe(1);
  });
});

describe('MetricsRegistry', () => {
  it('records and retrieves counters', () => {
    metricsRegistry.recordCounter('api.calls', 1, [{ name: 'endpoint', value: '/health' }]);
    const value = metricsRegistry.getCounterValue('api.calls', [{ name: 'endpoint', value: '/health' }]);
    expect(value).toBe(1);
  });

  it('records and retrieves gauges', () => {
    metricsRegistry.recordGauge('cpu.usage', 0.75);
    expect(metricsRegistry.getGaugeValue('cpu.usage')).toBe(0.75);
  });

  it('records histograms with stats', () => {
    metricsRegistry.recordHistogram('request.duration', 100);
    metricsRegistry.recordHistogram('request.duration', 200);
    const stats = metricsRegistry.getHistogramStats('request.duration');
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(2);
    expect(stats!.avg).toBe(150);
  });

  it('lists metric names', () => {
    metricsRegistry.recordCounter('a', 1);
    metricsRegistry.recordGauge('b', 2);
    const names = metricsRegistry.getMetricNames();
    expect(names).toContain('a');
    expect(names).toContain('b');
  });
});

describe('KernelMetricsCollector', () => {
  it('records instruction execution timings', () => {
    kernelMetrics.recordInstructionExecution('publish', 50);
    kernelMetrics.recordInstructionExecution('publish', 150);
    kernelMetrics.recordInstructionExecution('fork', 30);

    expect(kernelMetrics.getTotalInstructions()).toBe(3);
    expect(kernelMetrics.getInstructionsByType()['publish']).toBe(2);
    expect(kernelMetrics.getInstructionsByType()['fork']).toBe(1);
  });

  it('records account sizes', () => {
    kernelMetrics.recordAccountSize(256);
    kernelMetrics.recordAccountSize(512);
    expect(kernelMetrics.getAccountCount()).toBe(2);
  });

  it('produces a snapshot', () => {
    kernelMetrics.recordInstructionExecution('publish', 100);
    kernelMetrics.recordAccountSize(256);
    kernelMetrics.recordCuConsumption(5000);

    const snap = kernelMetrics.snapshot();
    expect(snap.totalInstructions).toBe(1);
    expect(snap.accountCount).toBe(1);
    expect(snap.cuConsumption.count).toBe(1);
  });
});

describe('NetworkMetricsCollector', () => {
  it('records peer discovery latency', () => {
    networkMetrics.recordPeerDiscoveryLatency(50);
    networkMetrics.recordPeerDiscoveryLatency(150);
    const snap = networkMetrics.snapshot();
    expect(snap.peerDiscoveryLatencyMs.count).toBe(2);
    expect(snap.peerDiscoveryLatencyMs.min).toBe(50);
    expect(snap.peerDiscoveryLatencyMs.max).toBe(150);
  });

  it('records gossip propagation delay', () => {
    networkMetrics.recordGossipPropagationDelay(200);
    networkMetrics.recordGossipPropagationDelay(300);
    const snap = networkMetrics.snapshot();
    expect(snap.gossipPropagationDelayMs.count).toBe(2);
  });

  it('computes cache hit ratios', () => {
    networkMetrics.recordCacheHit('l1');
    networkMetrics.recordCacheHit('l1');
    networkMetrics.recordCacheMiss('l1');
    networkMetrics.recordCacheHit('l2');
    networkMetrics.recordCacheMiss('l2');

    expect(networkMetrics.getCacheHitRatio('l1')).toBeCloseTo(2 / 3);
    expect(networkMetrics.getCacheHitRatio('l2')).toBe(0.5);
    expect(networkMetrics.getCacheHitRatio('nonexistent')).toBe(1);

    const ratios = networkMetrics.getAllCacheHitRatios();
    expect(ratios['l1']).toBeCloseTo(2 / 3);
    expect(ratios['l2']).toBe(0.5);
  });

  it('tracks peer and DHT metrics', () => {
    networkMetrics.setConnectedPeers(5);
    networkMetrics.setKnownPeers(20);
    networkMetrics.setDhtEntries(100);

    const snap = networkMetrics.snapshot();
    expect(snap.connectedPeers).toBe(5);
    expect(snap.knownPeers).toBe(20);
    expect(snap.dhtEntries).toBe(100);
  });

  it('tracks bandwidth', () => {
    networkMetrics.recordBandwidth(1000, 500);
    networkMetrics.recordBandwidth(2000, 1000);
    const snap = networkMetrics.snapshot();
    expect(snap.bandwidthInBytes).toBe(3000);
    expect(snap.bandwidthOutBytes).toBe(1500);
  });
});

describe('AlertManager', () => {
  it('checks default alert rules', () => {
    const fired = alertManager.checkAlerts();
    expect(Array.isArray(fired)).toBe(true);
  });

  it('fires alert when condition is met', () => {
    meter.setGauge('promptchain_dropped_peers', 15);
    const fired = alertManager.checkAlerts();
    const networkAlert = fired.find((a) => a.rule === 'network_partition_detected');
    expect(networkAlert).toBeDefined();
    expect(networkAlert!.severity).toBe('critical');
    expect(networkAlert!.currentValue).toBe(15);
    expect(networkAlert!.threshold).toBe(10);
  });

  it('does not fire alert when condition is not met', () => {
    meter.setGauge('promptchain_dropped_peers', 5);
    const fired = alertManager.checkAlerts();
    const networkAlert = fired.find((a) => a.rule === 'network_partition_detected');
    expect(networkAlert).toBeUndefined();
  });

  it('respects cooldown period', () => {
    meter.setGauge('promptchain_dropped_peers', 15);
    const firstFired = alertManager.checkAlerts();
    expect(firstFired.length).toBeGreaterThan(0);

    const secondFired = alertManager.checkAlerts();
    expect(secondFired.length).toBe(0);
  });

  it('supports adding and removing rules', () => {
    alertManager.addRule({
      name: 'custom_alert',
      description: 'Custom test alert',
      metricName: 'test_metric',
      condition: { type: 'gt', threshold: 100 },
      severity: 'warning',
      enabled: true,
      cooldownMs: 10_000,
    });
    expect(alertManager.getRules().some((r) => r.name === 'custom_alert')).toBe(true);

    alertManager.removeRule('custom_alert');
    expect(alertManager.getRules().some((r) => r.name === 'custom_alert')).toBe(false);
  });

  it('enables and disables rules', () => {
    alertManager.disableRule('network_partition_detected');
    const rules = alertManager.getRules();
    expect(rules.find((r) => r.name === 'network_partition_detected')?.enabled).toBe(false);

    alertManager.enableRule('network_partition_detected');
    expect(rules.find((r) => r.name === 'network_partition_detected')?.enabled).toBe(true);
  });

  it('fires alert callback when set', () => {
    let firedAlert: any = null;
    alertManager.setOnAlertFired((alert) => { firedAlert = alert; });
    meter.setGauge('promptchain_dropped_peers', 15);
    alertManager.checkAlerts();
    expect(firedAlert).not.toBeNull();
    expect(firedAlert!.rule).toBe('network_partition_detected');
  });

  it('returns active alerts', () => {
    meter.setGauge('promptchain_dropped_peers', 15);
    alertManager.checkAlerts();
    const active = alertManager.getActiveAlerts();
    expect(active.length).toBeGreaterThan(0);
  });
});

describe('HealthCheckRegistry', () => {
  it('returns health check result with subsystems', async () => {
    const health = await healthEndpoint();
    expect(health.status).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    expect(health.subsystems.length).toBeGreaterThan(0);
    expect(health.version).toBe('0.1.0');
    expect(health.uptime).toBeGreaterThan(0);
  });

  it('registers and unregisters subsystems', () => {
    const checkable = {
      name: 'test-subsystem',
      check: () => ({ name: 'test-subsystem', status: 'healthy' as const, lastCheck: Date.now() }),
    };
    healthRegistry.register(checkable);
    const status = healthRegistry.getSubsystemStatus('test-subsystem');
    expect(status).toBeUndefined();

    healthRegistry.unregister('test-subsystem');
    expect(healthRegistry.getSubsystemStatus('test-subsystem')).toBeUndefined();
  });
});

describe('PrometheusMetricsExporter', () => {
  it('formats metrics in Prometheus text format', () => {
    metricsRegistry.recordGauge('cpu_temp', 65.2);
    const exporter = new PrometheusMetricsExporter();
    const output = exporter.getFormattedMetrics();
    expect(output).toContain('cpu_temp');
    expect(output).toContain('65.2');
  });
});
