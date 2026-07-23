import { AlertRule, AlertEvent, AlertCondition, DEFAULT_ALERT_RULES } from './types';
import { metricsRegistry } from './metrics';
import { meter } from './otel';

export class AlertManager {
  private rules: AlertRule[] = [...DEFAULT_ALERT_RULES];
  private alerts: AlertEvent[] = [];
  private maxAlerts = 1000;
  private onAlertFired?: (alert: AlertEvent) => void;

  setOnAlertFired(handler: (alert: AlertEvent) => void): void {
    this.onAlertFired = handler;
  }

  getRules(): AlertRule[] {
    return [...this.rules];
  }

  addRule(rule: AlertRule): void {
    const existing = this.rules.findIndex((r) => r.name === rule.name);
    if (existing >= 0) {
      this.rules[existing] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  removeRule(name: string): boolean {
    const idx = this.rules.findIndex((r) => r.name === name);
    if (idx >= 0) {
      this.rules.splice(idx, 1);
      return true;
    }
    return false;
  }

  enableRule(name: string): boolean {
    const rule = this.rules.find((r) => r.name === name);
    if (rule) {
      rule.enabled = true;
      return true;
    }
    return false;
  }

  disableRule(name: string): boolean {
    const rule = this.rules.find((r) => r.name === name);
    if (rule) {
      rule.enabled = false;
      return true;
    }
    return false;
  }

  getAlerts(limit = 50): AlertEvent[] {
    return this.alerts.slice(-limit);
  }

  getActiveAlerts(): AlertEvent[] {
    const now = Date.now();
    return this.alerts.filter((a) => {
      const rule = this.rules.find((r) => r.name === a.rule);
      if (!rule) return false;
      return now - a.timestamp < rule.cooldownMs;
    });
  }

  checkAlerts(): AlertEvent[] {
    const fired: AlertEvent[] = [];
    const now = Date.now();

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (rule.lastFiredAt && now - rule.lastFiredAt < rule.cooldownMs) continue;

      const currentValue = this.getMetricValue(rule.metricName);
      if (currentValue === undefined) continue;

      if (this.evaluateCondition(currentValue, rule.condition, rule.metricName)) {
        const event: AlertEvent = {
          rule: rule.name,
          description: rule.description,
          severity: rule.severity,
          metricName: rule.metricName,
          currentValue,
          threshold: this.getThreshold(rule.condition),
          condition: this.formatCondition(rule.condition),
          timestamp: now,
        };

        this.alerts.push(event);
        if (this.alerts.length > this.maxAlerts) this.alerts.shift();
        rule.lastFiredAt = now;
        fired.push(event);

        if (this.onAlertFired) this.onAlertFired(event);
      }
    }

    return fired;
  }

  clear(): void {
    this.alerts = [];
    for (const rule of this.rules) rule.lastFiredAt = undefined;
  }

  private getMetricValue(metricName: string): number | undefined {
    const gauge = meter.getGauge(metricName);
    if (gauge !== undefined) return gauge;

    const counter = meter.getCounter(metricName);
    if (counter > 0) return counter;

    const hist = meter.getHistogram(metricName);
    if (hist) return hist.avg;

    const latest = metricsRegistry.getLatestMetric(metricName);
    if (latest) return latest.value;

    return undefined;
  }

  private evaluateCondition(value: number, condition: AlertCondition, metricName: string): boolean {
    switch (condition.type) {
      case 'gt': return value > condition.threshold;
      case 'lt': return value < condition.threshold;
      case 'gte': return value >= condition.threshold;
      case 'lte': return value <= condition.threshold;
      case 'eq': return value === condition.threshold;
      case 'percentile_gt': {
        const hist = meter.getHistogram(metricName);
        if (!hist) return false;
        const pValue = condition.percentile === 99 ? hist.p99 : condition.percentile === 95 ? hist.p95 : hist.p50;
        return pValue > condition.threshold;
      }
      default: return false;
    }
  }

  private getThreshold(condition: AlertCondition): number {
    return 'threshold' in condition ? condition.threshold : 0;
  }

  private formatCondition(condition: AlertCondition): string {
    switch (condition.type) {
      case 'gt': return `> ${condition.threshold}`;
      case 'lt': return `< ${condition.threshold}`;
      case 'gte': return `>= ${condition.threshold}`;
      case 'lte': return `<= ${condition.threshold}`;
      case 'eq': return `== ${condition.threshold}`;
      case 'percentile_gt': return `p${condition.percentile} > ${condition.threshold}`;
      default: return 'unknown';
    }
  }
}

export const alertManager = new AlertManager();
