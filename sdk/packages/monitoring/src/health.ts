import { HealthCheckResult, SubsystemStatus, AlertEvent, DEFAULT_MONITORING_CONFIG } from './types';
import { alertManager } from './alerts';
import { kernelMetrics } from './kernel-metrics';
import { networkMetrics } from './network-metrics';
import { tracer, meter } from './otel';

export interface HealthCheckable {
  name: string;
  check(): Promise<SubsystemStatus> | SubsystemStatus;
}

export class HealthCheckRegistry {
  private subsystems: Map<string, HealthCheckable> = new Map();
  private cachedStatuses: Map<string, SubsystemStatus> = new Map();
  private startTime: number = Date.now();
  private lastCheckTime = 0;
  private checkIntervalMs = 30_000;

  register(subsystem: HealthCheckable): void {
    this.subsystems.set(subsystem.name, subsystem);
  }

  unregister(name: string): boolean {
    return this.subsystems.delete(name);
  }

  getSubsystemStatus(name: string): SubsystemStatus | undefined {
    return this.cachedStatuses.get(name);
  }

  getAllSubsystemStatuses(): SubsystemStatus[] {
    return [...this.cachedStatuses.values()];
  }

  async runAllChecks(): Promise<SubsystemStatus[]> {
    const results: SubsystemStatus[] = [];
    for (const [, subsystem] of this.subsystems) {
      try {
        const status = await subsystem.check();
        this.cachedStatuses.set(subsystem.name, status);
        results.push(status);
      } catch (err) {
        const errorStatus: SubsystemStatus = {
          name: subsystem.name,
          status: 'unhealthy',
          lastCheck: Date.now(),
          message: `Check failed: ${err}`,
        };
        this.cachedStatuses.set(subsystem.name, errorStatus);
        results.push(errorStatus);
      }
    }
    this.lastCheckTime = Date.now();
    return results;
  }

  async getHealth(): Promise<HealthCheckResult> {
    const subsystems = await this.runAllChecks();
    const alerts = alertManager.getActiveAlerts();
    const overall = this.computeOverallStatus(subsystems, alerts);

    return {
      status: overall,
      version: DEFAULT_MONITORING_CONFIG.serviceVersion,
      uptime: Date.now() - this.startTime,
      subsystems,
      alerts,
      timestamp: Date.now(),
    };
  }

  private computeOverallStatus(subsystems: SubsystemStatus[], alerts: AlertEvent[]): 'healthy' | 'degraded' | 'unhealthy' {
    const hasUnhealthy = subsystems.some((s) => s.status === 'unhealthy');
    const hasDegraded = subsystems.some((s) => s.status === 'degraded');
    const hasCriticalAlerts = alerts.some((a) => a.severity === 'critical');

    if (hasUnhealthy || hasCriticalAlerts) return 'unhealthy';
    if (hasDegraded) return 'degraded';
    return 'healthy';
  }
}

export const healthRegistry = new HealthCheckRegistry();

healthRegistry.register({
  name: 'kernel',
  check(): SubsystemStatus {
    const totalInstructions = kernelMetrics.getTotalInstructions();
    return {
      name: 'kernel',
      status: totalInstructions >= 0 ? 'healthy' : 'unknown',
      lastCheck: Date.now(),
      metrics: {
        total_instructions: totalInstructions,
        account_count: kernelMetrics.getAccountCount(),
      },
    };
  },
});

healthRegistry.register({
  name: 'metrics',
  check(): SubsystemStatus {
    const metricNames = [...new Set([
      ...Object.keys(meter['counters'] ?? {}),
      ...Object.keys(meter['gauges'] ?? {}),
    ])];
    return {
      name: 'metrics',
      status: metricNames.length > 0 ? 'healthy' : 'degraded',
      lastCheck: Date.now(),
      message: metricNames.length === 0 ? 'No metrics recorded yet' : undefined,
      metrics: { active_metrics: metricNames.length },
    };
  },
});

healthRegistry.register({
  name: 'alerts',
  check(): SubsystemStatus {
    const recentAlerts = alertManager.getAlerts(10);
    const criticalCount = recentAlerts.filter((a) => a.severity === 'critical').length;
    return {
      name: 'alerts',
      status: criticalCount > 5 ? 'unhealthy' : criticalCount > 0 ? 'degraded' : 'healthy',
      lastCheck: Date.now(),
      metrics: {
        active_alerts: alertManager.getActiveAlerts().length,
        total_alerts: recentAlerts.length,
        critical_alerts: criticalCount,
      },
    };
  },
});

healthRegistry.register({
  name: 'network',
  check(): SubsystemStatus {
    const snapshot = networkMetrics.snapshot();
    return {
      name: 'network',
      status: 'healthy',
      lastCheck: Date.now(),
      metrics: {
        connected_peers: snapshot.connectedPeers,
        known_peers: snapshot.knownPeers,
        dht_entries: snapshot.dhtEntries,
        bandwidth_in: snapshot.bandwidthInBytes,
        bandwidth_out: snapshot.bandwidthOutBytes,
        messages_per_second: snapshot.messagesPerSecond,
      },
    };
  },
});

export function healthEndpoint(): Promise<HealthCheckResult> {
  return healthRegistry.getHealth();
}
