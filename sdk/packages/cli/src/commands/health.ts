import { healthEndpoint, alertManager, kernelMetrics, networkMetrics, MonitoringExporter, PrometheusMetricsExporter, tracer, meter } from '@promptchain/monitoring';
import { existsSync, readFileSync } from 'fs';

export async function healthCommand(): Promise<void> {
  const health = await healthEndpoint();

  console.log('PromptChain Health Check');
  console.log('=======================');
  console.log(`Status:  ${formatStatus(health.status)}`);
  console.log(`Version: ${health.version}`);
  console.log(`Uptime:  ${formatDuration(health.uptime)}`);
  console.log(`Time:    ${new Date(health.timestamp).toISOString()}`);
  console.log('');

  console.log('Subsystems:');
  for (const sub of health.subsystems) {
    const indicator = sub.status === 'healthy' ? '✓' : sub.status === 'degraded' ? '⚠' : '✗';
    console.log(`  ${indicator} ${sub.name}: ${sub.status}`);
    if (sub.message) console.log(`       ${sub.message}`);
    if (sub.metrics) {
      for (const [key, val] of Object.entries(sub.metrics)) {
        console.log(`       ${key}: ${val}`);
      }
    }
  }
  console.log('');

  if (health.alerts.length > 0) {
    console.log('Active Alerts:');
    for (const alert of health.alerts) {
      const sev = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵';
      console.log(`  ${sev} [${alert.severity.toUpperCase()}] ${alert.description}`);
      console.log(`       Rule: ${alert.rule}`);
      console.log(`       Value: ${alert.currentValue} ${alert.condition}`);
    }
    console.log('');
  } else {
    console.log('No active alerts.');
    console.log('');
  }

  console.log('Kernel Metrics Snapshot:');
  const kernelSnap = kernelMetrics.snapshot();
  console.log(`  Total Instructions:   ${kernelSnap.totalInstructions}`);
  console.log(`  Instruction Types:    ${Object.keys(kernelSnap.instructionsByType).join(', ') || '(none)'}`);
  console.log(`  Account Count:        ${kernelSnap.accountCount}`);
  console.log(`  Instruction Exec MS:  ${kernelSnap.instructionExecutionTimeMs.count > 0 ? `avg=${(kernelSnap.instructionExecutionTimeMs.sum / kernelSnap.instructionExecutionTimeMs.count).toFixed(1)} count=${kernelSnap.instructionExecutionTimeMs.count}` : '(no data)'}`);
  console.log('');

  console.log('Network Metrics Snapshot:');
  const netSnap = networkMetrics.snapshot();
  console.log(`  Connected Peers:      ${netSnap.connectedPeers}`);
  console.log(`  Known Peers:          ${netSnap.knownPeers}`);
  console.log(`  DHT Entries:          ${netSnap.dhtEntries}`);
  console.log(`  Bandwidth In:         ${formatBytes(netSnap.bandwidthInBytes)}`);
  console.log(`  Bandwidth Out:        ${formatBytes(netSnap.bandwidthOutBytes)}`);
  console.log(`  Messages/s:           ${netSnap.messagesPerSecond.toFixed(1)}`);
  console.log(`  Peer Discovery (ms):  ${netSnap.peerDiscoveryLatencyMs.count > 0 ? `avg=${(netSnap.peerDiscoveryLatencyMs.sum / netSnap.peerDiscoveryLatencyMs.count).toFixed(1)} count=${netSnap.peerDiscoveryLatencyMs.count}` : '(no data)'}`);
  console.log(`  Gossip Delay (ms):    ${netSnap.gossipPropagationDelayMs.count > 0 ? `avg=${(netSnap.gossipPropagationDelayMs.sum / netSnap.gossipPropagationDelayMs.count).toFixed(1)} count=${netSnap.gossipPropagationDelayMs.count}` : '(no data)'}`);
  if (Object.keys(netSnap.cacheHitRatios).length > 0) {
    console.log(`  Cache Ratios:         ${Object.entries(netSnap.cacheHitRatios).map(([k, v]) => `${k}=${(v * 100).toFixed(1)}%`).join(', ')}`);
  }
  console.log('');

  console.log('Alert Rules:');
  const rules = alertManager.getRules();
  for (const rule of rules) {
    const status = rule.enabled ? (rule.lastFiredAt ? `last fired ${formatDuration(Date.now() - rule.lastFiredAt)} ago` : 'enabled') : 'disabled';
    console.log(`  ${rule.name}: ${status} (${rule.metricName} ${rule.condition.type} ${'threshold' in rule.condition ? rule.condition.threshold : ''})`);
  }
  console.log('');

  const exporter = new PrometheusMetricsExporter();
  console.log('Prometheus Metrics:');
  console.log(exporter.getFormattedMetrics());
}

export async function healthPrometheusCommand(): Promise<void> {
  const health = await healthEndpoint();
  const exporter = new PrometheusMetricsExporter();
  const lines: string[] = [];

  lines.push('# HELP promptchain_health_status Overall health status of the node');
  lines.push('# TYPE promptchain_health_status gauge');
  lines.push(`promptchain_health_status ${health.status === 'healthy' ? 1 : health.status === 'degraded' ? 0.5 : 0}`);

  lines.push('# HELP promptchain_uptime_seconds Node uptime in seconds');
  lines.push('# TYPE promptchain_uptime_seconds gauge');
  lines.push(`promptchain_uptime_seconds ${Math.floor(health.uptime / 1000)}`);

  for (const sub of health.subsystems) {
    const val = sub.status === 'healthy' ? 1 : sub.status === 'degraded' ? 0.5 : 0;
    lines.push(`# HELP promptchain_subsystem_status Subsystem health status`);
    lines.push(`# TYPE promptchain_subsystem_status gauge`);
    lines.push(`promptchain_subsystem_status{name="${sub.name}"} ${val}`);
  }

  lines.push('');
  lines.push(exporter.getFormattedMetrics());

  console.log(lines.join('\n'));
}

export async function monitorStartCommand(intervalMs?: string): Promise<void> {
  const interval = intervalMs ? parseInt(intervalMs) : 10_000;
  const exporter = new MonitoringExporter();
  exporter.start(interval);
  console.log(`Monitoring exporter started (interval: ${interval}ms)`);
  console.log('Press Ctrl+C to stop.');

  process.on('SIGINT', async () => {
    await exporter.shutdown();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await exporter.shutdown();
    process.exit(0);
  });

  await new Promise(() => {});
}

function formatStatus(status: string): string {
  switch (status) {
    case 'healthy': return '✓ HEALTHY';
    case 'degraded': return '⚠ DEGRADED';
    case 'unhealthy': return '✗ UNHEALTHY';
    default: return '? UNKNOWN';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
