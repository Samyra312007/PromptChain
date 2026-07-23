import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, unlink, rmdir, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { PromptBackupExporter } from '../src/exporter';
import { PromptBackupImporter } from '../src/importer';
import { RecoveryWalletManager } from '../src/recovery-wallet';
import { ColdStorageArchiver } from '../src/archiver';
import { BackupScheduler } from '../src/scheduler';
import {
  BackupManifest,
  ExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  DEFAULT_BACKUP_SCHEDULE,
} from '../src/types';

const TEST_DIR = join('/tmp', 'promptchain-backup-test');
const PROMPTS_DIR = join(TEST_DIR, 'prompts');
const OUTPUT_DIR = join(TEST_DIR, 'output');
const ARCHIVE_DIR = join(TEST_DIR, 'archives');

async function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function cleanup(dir: string) {
  try {
    const entries = await readdir(dir).catch(() => []);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = await (await import('fs')).promises.stat(fullPath);
        if (stat.isDirectory()) {
          await cleanup(fullPath);
          await rmdir(fullPath).catch(() => {});
        } else {
          await unlink(fullPath).catch(() => {});
        }
      } catch {}
    }
    await rmdir(dir).catch(() => {});
  } catch {}
}

beforeEach(async () => {
  await cleanup(TEST_DIR);
  await ensureDir(PROMPTS_DIR);
  await ensureDir(OUTPUT_DIR);
  await ensureDir(ARCHIVE_DIR);
});

afterEach(async () => {
  await cleanup(TEST_DIR);
});

async function createSamplePrompt(name: string, text: string, tags?: string[]): Promise<string> {
  const path = join(PROMPTS_DIR, `${name}.prompt`);
  const metaPath = join(PROMPTS_DIR, `${name}.meta.json`);
  await writeFile(path, text, 'utf8');
  await writeFile(metaPath, JSON.stringify({
    name,
    description: `Test prompt ${name}`,
    prompt_text: text,
    category: 'code',
    tags: tags || ['test'],
    task_description: 'test task',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    language: 'en',
  }, null, 2), 'utf8');
  return path;
}

async function createVersion(promptName: string, versionNum: number, text: string): Promise<void> {
  const versionsDir = join(PROMPTS_DIR, '.versions', promptName);
  if (!existsSync(versionsDir)) mkdirSync(versionsDir, { recursive: true });
  await writeFile(join(versionsDir, `v${versionNum}.prompt`), text, 'utf8');
  await writeFile(join(versionsDir, `v${versionNum}.meta.json`), JSON.stringify({
    author: 'test-author',
    changelogUri: `https://example.com/changelog/v${versionNum}`,
  }, null, 2), 'utf8');
}

describe('PromptBackupExporter', () => {
  it('exports a single prompt', async () => {
    await createSamplePrompt('hello', 'Write a greeting function');
    const exporter = new PromptBackupExporter();
    const outputPath = join(OUTPUT_DIR, 'single.promptpack');
    const entry = await exporter.exportPrompt(PROMPTS_DIR, 'hello', outputPath);
    expect(entry.filename).toBe('hello.prompt');
    expect(entry.cid).toBeTruthy();
    expect(entry.checksum).toBeTruthy();
    expect(entry.promptText).toBe('Write a greeting function');
  });

  it('exports all prompts in a directory', async () => {
    await createSamplePrompt('hello', 'Hello world');
    await createSamplePrompt('goodbye', 'Goodbye world');
    await createSamplePrompt('greet', 'Greetings');
    const exporter = new PromptBackupExporter();
    const outputPath = join(OUTPUT_DIR, 'all.promptpack');
    const manifest = await exporter.exportAll(PROMPTS_DIR, outputPath);
    expect(manifest.totalPrompts).toBe(3);
    expect(manifest.entries.length).toBe(3);
    expect(manifest.version).toBe('0.1.0');
  });

  it('includes versions when available', async () => {
    await createSamplePrompt('codegen', 'Write a sorting function');
    await createVersion('codegen', 1, 'Write a bubble sort');
    await createVersion('codegen', 2, 'Write a quicksort');
    const exporter = new PromptBackupExporter();
    const outputPath = join(OUTPUT_DIR, 'versions.promptpack');
    const manifest = await exporter.exportAll(PROMPTS_DIR, outputPath);
    const entry = manifest.entries.find((e) => e.filename === 'codegen.prompt');
    expect(entry).toBeDefined();
    expect(entry!.versions.length).toBe(2);
    expect(entry!.versions[0].versionNumber).toBe(1);
    expect(entry!.versions[1].versionNumber).toBe(2);
    expect(manifest.totalVersions).toBe(2);
  });

  it('computes consistent checksums', () => {
    const exporter = new PromptBackupExporter();
    const cksum1 = exporter.computeChecksum('hello world');
    const cksum2 = exporter.computeChecksum('hello world');
    expect(cksum1).toBe(cksum2);
    const cksum3 = exporter.computeChecksum('hello world!');
    expect(cksum1).not.toBe(cksum3);
  });
});

describe('PromptBackupImporter', () => {
  it('imports and verifies a valid backup', async () => {
    await createSamplePrompt('test-prompt', 'Test content');
    const exporter = new PromptBackupExporter();
    const backupPath = join(OUTPUT_DIR, 'test.promptpack');
    await exporter.exportAll(PROMPTS_DIR, backupPath);

    const importDir = join(TEST_DIR, 'imported');
    const importer = new PromptBackupImporter();
    const result = await importer.import(backupPath + '.gz', importDir);
    expect(result.verified).toBe(true);
    expect(result.checksumValid).toBe(true);
    expect(result.totalImported).toBe(1);
    expect(result.totalErrors).toBe(0);

    const importedFile = join(importDir, 'test-prompt.prompt');
    const content = await readFile(importedFile, 'utf8');
    expect(content).toBe('Test content');
  });

  it('verifies but does not restore when using verify()', async () => {
    await createSamplePrompt('verify-prompt', 'Verify me');
    const exporter = new PromptBackupExporter();
    const backupPath = join(OUTPUT_DIR, 'verify.promptpack');
    await exporter.exportAll(PROMPTS_DIR, backupPath);

    const importer = new PromptBackupImporter();
    const result = await importer.verify(backupPath + '.gz');
    expect(result.verified).toBe(true);
    expect(result.checksumValid).toBe(true);
    expect(result.manifest.totalPrompts).toBe(1);
  });

  it('detects corrupted manifest checksum', async () => {
    const exporter = new PromptBackupExporter();
    const manifest: BackupManifest = {
      version: '0.1.0',
      exportedAt: Date.now(),
      exportedBy: 'test',
      source: '/tmp',
      totalPrompts: 0,
      totalVersions: 0,
      entries: [],
      checksum: '',
    };
    manifest.checksum = exporter.computeChecksum(JSON.stringify({ ...manifest, checksum: '' }));

    const importer = new PromptBackupImporter();
    expect(importer.verifyManifestChecksum(manifest)).toBe(true);

    manifest.checksum = 'invalid';
    expect(importer.verifyManifestChecksum(manifest)).toBe(false);
  });

  it('verifies manifest checksum correctly', () => {
    const exporter = new PromptBackupExporter();
    const importer = new PromptBackupImporter();
    const manifest: BackupManifest = {
      version: '0.1.0',
      exportedAt: Date.now(),
      exportedBy: 'test',
      source: '/tmp',
      totalPrompts: 0,
      totalVersions: 0,
      entries: [],
      checksum: '',
    };
    manifest.checksum = exporter.computeChecksum(JSON.stringify({ ...manifest, checksum: '' }));
    expect(importer.verifyManifestChecksum(manifest)).toBe(true);

    manifest.checksum = 'invalid';
    expect(importer.verifyManifestChecksum(manifest)).toBe(false);
  });
});

describe('RecoveryWalletManager', () => {
  it('configures recovery address and inactivity period', () => {
    const manager = new RecoveryWalletManager();
    manager.setRecoveryAddress('RecoveryAddr123');
    expect(manager.getConfig().recoveryAddress).toBe('RecoveryAddr123');
    expect(manager.getConfig().reclaimableAfter).toBeGreaterThan(Date.now());

    manager.setInactivityDays(30);
    expect(manager.getConfig().inactivityDays).toBe(30);
  });

  it('checks reclaimability', () => {
    const manager = new RecoveryWalletManager();
    manager.setRecoveryAddress('RecoveryAddr');
    manager.setInactivityDays(0);

    const entry: any = { filename: 'test.prompt', cid: 'abc123' };
    expect(manager.isReclaimable(entry, Date.now() - 1000)).toBe(true);
  });

  it('does not allow reclaim without recovery address', () => {
    const manager = new RecoveryWalletManager();
    const entry: any = { filename: 'test.prompt', cid: 'abc123' };
    expect(manager.isReclaimable(entry, 0)).toBe(false);
  });

  it('prevents double claim', () => {
    const manager = new RecoveryWalletManager();
    manager.setRecoveryAddress('RecoveryAddr');
    manager.setInactivityDays(0);

    const entry: any = { filename: 'test.prompt', cid: 'abc123' };
    expect(manager.isReclaimable(entry, 0)).toBe(true);
    manager.claimPrompt(entry, 'oldOwner', 'RecoveryAddr');
    expect(manager.isReclaimable(entry, 0)).toBe(false);
  });

  it('requires correct recovery address to claim', () => {
    const manager = new RecoveryWalletManager();
    manager.setRecoveryAddress('RecoveryAddr');
    const entry: any = { filename: 'test.prompt', cid: 'abc123' };
    expect(() => manager.claimPrompt(entry, 'oldOwner', 'WrongAddr')).toThrow();
  });

  it('tracks claims and supports revoke', () => {
    const manager = new RecoveryWalletManager();
    manager.setRecoveryAddress('RecoveryAddr');
    manager.setInactivityDays(0);

    const entry: any = { filename: 'test.prompt', cid: 'abc123' };
    manager.claimPrompt(entry, 'oldOwner', 'RecoveryAddr');
    expect(manager.getAllClaims().length).toBe(1);
    expect(manager.getClaim('abc123')).toBeDefined();

    manager.revokeClaim('abc123');
    expect(manager.getClaim('abc123')).toBeUndefined();
  });

  it('identifies recoverable prompts from a list', () => {
    const manager = new RecoveryWalletManager();
    manager.setRecoveryAddress('RecoveryAddr');
    manager.setInactivityDays(0);

    const activeEntry: any = { filename: 'active.prompt', cid: 'active' };
    const inactiveEntry: any = { filename: 'inactive.prompt', cid: 'inactive' };
    const claimedEntry: any = { filename: 'claimed.prompt', cid: 'claimed' };

    const lastActivity = new Map<string, number>();
    lastActivity.set('active', Date.now());
    lastActivity.set('inactive', 0);
    lastActivity.set('claimed', 0);

    manager.claimPrompt(claimedEntry, 'oldOwner', 'RecoveryAddr');
    const recoverable = manager.getRecoverablePrompts(
      [activeEntry, inactiveEntry, claimedEntry],
      lastActivity,
    );
    expect(recoverable.length).toBe(2);
    expect(recoverable.some((r) => r.cid === 'active')).toBe(true);
    expect(recoverable.some((r) => r.cid === 'inactive')).toBe(true);
  });

  it('exports and imports state', () => {
    const manager = new RecoveryWalletManager();
    manager.setRecoveryAddress('Addr1');
    const entry: any = { filename: 'test.prompt', cid: 'xyz' };
    manager.claimPrompt(entry, 'old', 'Addr1');

    const state = manager.exportState();
    expect(state.config.recoveryAddress).toBe('Addr1');
    expect(state.claims.length).toBe(1);

    const manager2 = new RecoveryWalletManager();
    manager2.importState(state);
    expect(manager2.getConfig().recoveryAddress).toBe('Addr1');
    expect(manager2.getClaim('xyz')).toBeDefined();
  });

  it('computes inactivity deadline', () => {
    const deadline = RecoveryWalletManager.computeInactivityDeadline(1000, 90);
    expect(deadline).toBe(1000 + 90 * 24 * 60 * 60 * 1000);
  });
});

describe('ColdStorageArchiver', () => {
  it('creates a daily snapshot', async () => {
    await createSamplePrompt('snapshot-prompt', 'Snapshot content');
    const archiver = new ColdStorageArchiver({
      archiveDir: ARCHIVE_DIR,
      enabled: false,
    });
    const snapshot = await archiver.createSnapshot(PROMPTS_DIR, 'daily');
    expect(snapshot.type).toBe('daily');
    expect(snapshot.entryCount).toBe(1);
    expect(snapshot.status).toBe('archived');
    expect(snapshot.id).toContain('daily');
  });

  it('lists snapshots', async () => {
    await createSamplePrompt('list-prompt', 'List me');
    const archiver = new ColdStorageArchiver({
      archiveDir: ARCHIVE_DIR,
      enabled: false,
    });
    await archiver.createSnapshot(PROMPTS_DIR, 'daily');
    await archiver.createSnapshot(PROMPTS_DIR, 'weekly');

    const snapshots = await archiver.listSnapshots();
    expect(snapshots.length).toBe(2);
  });

  it('gets latest snapshot', async () => {
    await createSamplePrompt('latest-prompt', 'Latest');
    const archiver = new ColdStorageArchiver({
      archiveDir: ARCHIVE_DIR,
      enabled: false,
    });
    await archiver.createSnapshot(PROMPTS_DIR, 'daily');
    await new Promise((r) => setTimeout(r, 10));
    await archiver.createSnapshot(PROMPTS_DIR, 'weekly');

    const latest = archiver.getLatestSnapshot();
    expect(latest).toBeDefined();
    expect(latest!.type).toBe('weekly');
  });

  it('restores from a snapshot', async () => {
    await createSamplePrompt('restore-prompt', 'Restore me');
    const archiver = new ColdStorageArchiver({
      archiveDir: ARCHIVE_DIR,
      enabled: false,
    });
    const snapshot = await archiver.createSnapshot(PROMPTS_DIR, 'daily');

    const restoreDir = join(TEST_DIR, 'restored');
    await archiver.restoreFromSnapshot(snapshot.id, restoreDir);
    const content = await readFile(join(restoreDir, 'restore-prompt.prompt'), 'utf8');
    expect(content).toBe('Restore me');
  });
});

describe('BackupScheduler', () => {
  it('loads and saves config', async () => {
    const scheduler = new BackupScheduler();
    scheduler.updateConfig({
      schedule: {
        ...DEFAULT_BACKUP_SCHEDULE,
        daily: { ...DEFAULT_BACKUP_SCHEDULE.daily, enabled: false },
      },
    });
    await scheduler.saveConfig();
    const scheduler2 = new BackupScheduler();
    await scheduler2.loadConfig();
    expect(scheduler2.getConfig().schedule.daily.enabled).toBe(false);
  });

  it('loads and saves state', async () => {
    const scheduler = new BackupScheduler();
    await scheduler.saveState();
    const scheduler2 = new BackupScheduler();
    await scheduler2.loadState();
    expect(scheduler2.getState()).toBeDefined();
  });

  it('checks and runs scheduled backups', async () => {
    await createSamplePrompt('scheduler-prompt', 'Scheduled');
    const scheduler = new BackupScheduler({
      schedule: {
        ...DEFAULT_BACKUP_SCHEDULE,
        daily: { ...DEFAULT_BACKUP_SCHEDULE.daily, enabled: true },
        weekly: { ...DEFAULT_BACKUP_SCHEDULE.weekly, enabled: false },
        monthly: { ...DEFAULT_BACKUP_SCHEDULE.monthly, enabled: false },
      },
    });
    const snapshots = await scheduler.checkAndRun(PROMPTS_DIR);
    expect(snapshots.length).toBeGreaterThan(0);
  });

  it('runs on demand', async () => {
    await createSamplePrompt('on-demand', 'On demand backup');
    const scheduler = new BackupScheduler();
    const snapshot = await scheduler.runNow(PROMPTS_DIR);
    expect(snapshot.status).toBe('archived');
  });

  it('starts and stops', () => {
    const scheduler = new BackupScheduler();
    scheduler.start(PROMPTS_DIR, 60_000);
    scheduler.stop();
  });
});

describe('Integration - Full Export and Import Cycle', () => {
  it('exports and re-imports prompts with versions', async () => {
    await createSamplePrompt('integration', 'Integration test');
    await createVersion('integration', 1, 'Version 1');
    await createVersion('integration', 2, 'Version 2');

    const exporter = new PromptBackupExporter();
    const backupPath = join(OUTPUT_DIR, 'integration.promptpack');
    const originalManifest = await exporter.exportAll(PROMPTS_DIR, backupPath);
    expect(originalManifest.totalPrompts).toBe(1);
    expect(originalManifest.totalVersions).toBe(2);

    const restoreDir = join(TEST_DIR, 'restored-integration');
    const importer = new PromptBackupImporter();
    const result = await importer.import(backupPath + '.gz', restoreDir);
    expect(result.verified).toBe(true);
    expect(result.totalImported).toBe(1);

    const restoredContent = await readFile(join(restoreDir, 'integration.prompt'), 'utf8');
    expect(restoredContent).toBe('Integration test');

    const restoredMeta = JSON.parse(
      await readFile(join(restoreDir, 'integration.meta.json'), 'utf8'),
    );
    expect(restoredMeta.name).toBe('integration');

    const restoredV1 = await readFile(
      join(restoreDir, '.versions', 'integration', 'v1.prompt'), 'utf8',
    );
    expect(restoredV1).toBe('Version 1');
  });
});
