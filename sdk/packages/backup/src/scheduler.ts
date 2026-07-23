import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { BackupSchedule, BackupConfig, ArchiveSnapshot, DEFAULT_BACKUP_SCHEDULE } from './types';
import { PromptBackupExporter } from './exporter';
import { ColdStorageArchiver } from './archiver';

export interface SchedulerState {
  lastDaily: number;
  lastWeekly: number;
  lastMonthly: number;
  lastArweave: number;
  config: BackupConfig;
}

const CONFIG_PATH = './.promptchain/backup-config.json';
const STATE_PATH = './.promptchain/backup-state.json';

export class BackupScheduler {
  private config: BackupConfig;
  private state: SchedulerState;
  private exporter: PromptBackupExporter;
  private archiver: ColdStorageArchiver;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(config?: Partial<BackupConfig>) {
    this.config = {
      version: '0.1.0',
      schedule: { ...DEFAULT_BACKUP_SCHEDULE, ...config?.schedule },
      recovery: config?.recovery,
      exportDefaults: config?.exportDefaults || {},
    };
    this.state = this.defaultState();
    this.exporter = new PromptBackupExporter(this.config.exportDefaults);
    this.archiver = new ColdStorageArchiver({
      archiveDir: './.promptchain/archives',
      arweaveEndpoint: this.config.schedule.arweave.endpoint,
      enabled: this.config.schedule.arweave.enabled,
    });
  }

  private defaultState(): SchedulerState {
    return {
      lastDaily: 0,
      lastWeekly: 0,
      lastMonthly: 0,
      lastArweave: 0,
      config: this.config,
    };
  }

  getConfig(): BackupConfig {
    return this.config;
  }

  updateConfig(config: Partial<BackupConfig>): void {
    if (config.schedule) {
      this.config.schedule = { ...this.config.schedule, ...config.schedule };
    }
    if (config.recovery) {
      this.config.recovery = config.recovery;
    }
    if (config.exportDefaults) {
      this.config.exportDefaults = { ...this.config.exportDefaults, ...config.exportDefaults };
    }
  }

  getState(): SchedulerState {
    return { ...this.state };
  }

  async loadState(): Promise<void> {
    try {
      const content = await readFile(STATE_PATH, 'utf8');
      const parsed = JSON.parse(content);
      this.state = {
        ...this.defaultState(),
        ...parsed,
        config: { ...this.config, ...parsed.config },
      };
    } catch {
      this.state = this.defaultState();
    }
  }

  async saveState(): Promise<void> {
    const stateDir = dirname(STATE_PATH);
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
    await writeFile(STATE_PATH, JSON.stringify(this.state, null, 2), 'utf8');
  }

  async loadConfig(): Promise<void> {
    try {
      const content = await readFile(CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(content);
      this.config = { ...this.config, ...parsed };
    } catch {
      // use defaults
    }
  }

  async saveConfig(): Promise<void> {
    const configDir = dirname(CONFIG_PATH);
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
    await writeFile(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf8');
  }

  async checkAndRun(sourceDir: string): Promise<ArchiveSnapshot[]> {
    const now = Date.now();
    const snapshots: ArchiveSnapshot[] = [];
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    try {
      if (this.isDue(this.state.lastDaily, oneDay, this.config.schedule.daily.enabled)) {
        const snap = await this.archiver.createSnapshot(sourceDir, 'daily');
        snapshots.push(snap);
        this.state.lastDaily = now;
        this.cleanupOldBackups('daily');
      }

      if (this.isDue(this.state.lastWeekly, oneWeek, this.config.schedule.weekly.enabled)) {
        const snap = await this.archiver.createSnapshot(sourceDir, 'weekly');
        snapshots.push(snap);
        this.state.lastWeekly = now;
        this.cleanupOldBackups('weekly');
      }

      if (this.isDue(this.state.lastMonthly, oneMonth, this.config.schedule.monthly.enabled)) {
        const snap = await this.archiver.createSnapshot(sourceDir, 'monthly');
        snapshots.push(snap);
        this.state.lastMonthly = now;
        this.cleanupOldBackups('monthly');
      }

      if (snapshots.length > 0) {
        await this.saveState();
      }
    } catch {
      // scheduler check failed — will retry on next interval
    }

    return snapshots;
  }

  start(sourceDir: string, intervalMs: number = 3600_000): void {
    if (this.running) return;
    this.running = true;

    this.checkAndRun(sourceDir).catch(() => {});

    this.checkTimer = setInterval(async () => {
      if (this.running) {
        try { await this.checkAndRun(sourceDir); } catch {}
      }
    }, intervalMs);

    console.log(`Backup scheduler started (check interval: ${intervalMs / 60000}min)`);
  }

  stop(): void {
    this.running = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  async runNow(sourceDir: string): Promise<ArchiveSnapshot> {
    const snapshot = await this.archiver.createSnapshot(sourceDir, 'daily');
    this.state.lastDaily = Date.now();
    await this.saveState();
    return snapshot;
  }

  private isDue(lastRun: number, interval: number, enabled: boolean): boolean {
    if (!enabled) return false;
    return Date.now() - lastRun >= interval;
  }

  private async cleanupOldBackups(type: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    const keepCount = this.config.schedule[type].keepLast;
    const destination = this.config.schedule[type].destination;

    if (!existsSync(destination)) return;

    try {
      const files = (await readdir(destination))
        .filter((f) => f.startsWith(type) && f.endsWith('.promptpack.gz'))
        .sort()
        .reverse();

      if (files.length > keepCount) {
        const toRemove = files.slice(keepCount);
        for (const file of toRemove) {
          const filePath = join(destination, file);
          try {
            await (await import('fs/promises')).unlink(filePath);
          } catch {}
          const metaPath = filePath.replace('.promptpack.gz', '.snapshot.json');
          try {
            await (await import('fs/promises')).unlink(metaPath);
          } catch {}
        }
      }
    } catch {}
  }
}
