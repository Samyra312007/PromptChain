import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  PromptBackupExporter,
  PromptBackupImporter,
  RecoveryWalletManager,
  ColdStorageArchiver,
  BackupScheduler,
  DEFAULT_EXPORT_OPTIONS,
  DEFAULT_BACKUP_SCHEDULE,
} from '@promptchain/backup';

export async function backupExportCommand(
  directory: string,
  options: { output?: string; includeVersions?: boolean; compress?: boolean },
): Promise<void> {
  const exporter = new PromptBackupExporter({
    output: options.output || DEFAULT_EXPORT_OPTIONS.output,
    includeVersions: options.includeVersions ?? true,
    compress: options.compress ?? true,
  });

  console.log(`Exporting prompts from ${directory}...`);
  const manifest = await exporter.exportAll(directory, options.output);
  const outputPath = options.output || DEFAULT_EXPORT_OPTIONS.output;
  const finalPath = outputPath.endsWith('.gz') ? outputPath : outputPath + '.gz';

  console.log(`\nExport complete: ${finalPath}`);
  console.log(`  Prompts:   ${manifest.totalPrompts}`);
  console.log(`  Versions:  ${manifest.totalVersions}`);
  console.log(`  Checksum:  ${manifest.checksum.slice(0, 16)}...`);
  console.log(`  Exported:  ${new Date(manifest.exportedAt).toISOString()}`);
}

export async function backupImportCommand(
  path: string,
  outputDir: string,
  options: { verify?: boolean },
): Promise<void> {
  const importer = new PromptBackupImporter();

  if (options.verify) {
    console.log(`Verifying backup at ${path}...`);
    const result = await importer.verify(path);
    console.log(`\nVerification result:`);
    console.log(`  Valid:     ${result.verified ? 'YES' : 'NO'}`);
    console.log(`  Checksum:  ${result.checksumValid ? 'PASS' : 'FAIL'}`);
    console.log(`  Prompts:   ${result.manifest.totalPrompts}`);
    console.log(`  Versions:  ${result.manifest.totalVersions}`);
    console.log(`  Exported:  ${new Date(result.manifest.exportedAt).toISOString()}`);
    console.log(`  Exported by: ${result.manifest.exportedBy}`);

    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.totalErrors}):`);
      for (const err of result.errors) {
        console.log(`  [${err.code}] ${err.filename}: ${err.error}`);
      }
    }
    return;
  }

  console.log(`Importing backup from ${path} to ${outputDir}...`);
  const result = await importer.import(path, outputDir);

  console.log(`\nImport complete:`);
  console.log(`  Imported:  ${result.totalImported}`);
  console.log(`  Skipped:   ${result.totalSkipped}`);
  console.log(`  Verified:  ${result.verified ? 'YES' : 'NO'}`);

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.totalErrors}):`);
    for (const err of result.errors) {
      console.log(`  [${err.code}] ${err.filename}: ${err.error}`);
    }
  }
}

export async function backupArchiveCommand(
  directory: string,
  options: { type?: string; output?: string },
): Promise<void> {
  const type = (options.type || 'daily') as 'daily' | 'weekly' | 'monthly';
  const archiver = new ColdStorageArchiver({
    archiveDir: options.output || './.promptchain/archives',
  });

  console.log(`Creating ${type} archive snapshot...`);
  const snapshot = await archiver.createSnapshot(directory, type);

  console.log(`\nArchive snapshot created:`);
  console.log(`  ID:        ${snapshot.id}`);
  console.log(`  Type:      ${snapshot.type}`);
  console.log(`  Status:    ${snapshot.status}`);
  console.log(`  Prompts:   ${snapshot.entryCount}`);
  console.log(`  Size:      ${formatBytes(snapshot.totalSize)}`);
  console.log(`  Time:      ${new Date(snapshot.timestamp).toISOString()}`);

  const snapshots = await archiver.listSnapshots();
  console.log(`\nTotal snapshots: ${snapshots.length}`);
}

export async function backupListCommand(
  options: { archiveDir?: string },
): Promise<void> {
  const archiver = new ColdStorageArchiver({
    archiveDir: options.archiveDir || './.promptchain/archives',
  });

  const snapshots = await archiver.listSnapshots();
  if (snapshots.length === 0) {
    console.log('No snapshots found.');
    return;
  }

  console.log(`Snapshots (${snapshots.length}):\n`);
  for (const snap of snapshots) {
    const statusIcon = snap.status === 'archived' ? '✓' : snap.status === 'failed' ? '✗' : '○';
    console.log(`  ${statusIcon} ${snap.id}`);
    console.log(`     Type: ${snap.type} | Date: ${new Date(snap.timestamp).toISOString()} | Prompts: ${snap.entryCount} | Size: ${formatBytes(snap.totalSize)}`);
    if (snap.arweaveTx) console.log(`     Arweave TX: ${snap.arweaveTx}`);
    console.log();
  }
}

export async function backupRestoreCommand(
  snapshotId: string,
  outputDir: string,
  options: { archiveDir?: string },
): Promise<void> {
  const archiver = new ColdStorageArchiver({
    archiveDir: options.archiveDir || './.promptchain/archives',
  });

  console.log(`Restoring from snapshot ${snapshotId}...`);
  await archiver.restoreFromSnapshot(snapshotId, outputDir);
  console.log(`\nRestored to ${outputDir}`);
}

export async function backupRecoveryCommand(
  action: string,
  options: { address?: string; days?: string; promptDir?: string },
): Promise<void> {
  const manager = new RecoveryWalletManager();

  switch (action) {
    case 'config':
      if (options.address) {
        manager.setRecoveryAddress(options.address);
        console.log(`Recovery address set to: ${options.address}`);
      }
      if (options.days) {
        manager.setInactivityDays(parseInt(options.days));
        console.log(`Inactivity period set to: ${options.days} days`);
      }
      console.log('\nCurrent config:');
      console.log(`  Recovery address: ${manager.getConfig().recoveryAddress || '(not set)'}`);
      console.log(`  Inactivity days:  ${manager.getConfig().inactivityDays}`);
      break;

    case 'status':
      console.log('Recovery wallet status:');
      console.log(`  Recovery address: ${manager.getConfig().recoveryAddress || '(not set)'}`);
      console.log(`  Inactivity days:  ${manager.getConfig().inactivityDays}`);
      console.log(`  Claims:           ${manager.getAllClaims().length}`);
      console.log(`  Reclaimable after: ${manager.getConfig().reclaimableAfter ? new Date(manager.getConfig().reclaimableAfter).toISOString() : 'N/A'}`);
      break;

    default:
      console.error(`Unknown action: ${action}. Use: config, status`);
      process.exit(1);
  }
}

export async function backupScheduleCommand(
  action: string,
  options: { interval?: string; sourceDir?: string },
): Promise<void> {
  const scheduler = new BackupScheduler();

  switch (action) {
    case 'status':
      await scheduler.loadConfig();
      await scheduler.loadState();
      const config = scheduler.getConfig();
      const state = scheduler.getState();

      console.log('Backup schedule:');
      console.log(`  Daily:    ${config.schedule.daily.enabled ? 'enabled' : 'disabled'} at ${config.schedule.daily.time}, keep ${config.schedule.daily.keepLast}`);
      console.log(`  Weekly:   ${config.schedule.weekly.enabled ? 'enabled' : 'disabled'} at ${config.schedule.weekly.time}, keep ${config.schedule.weekly.keepLast}`);
      console.log(`  Monthly:  ${config.schedule.monthly.enabled ? 'enabled' : 'disabled'} at ${config.schedule.monthly.time}, keep ${config.schedule.monthly.keepLast}`);
      console.log(`  Arweave:  ${config.schedule.arweave.enabled ? 'enabled' : 'disabled'}`);
      console.log(`\nLast runs:`);
      console.log(`  Daily:    ${state.lastDaily ? new Date(state.lastDaily).toISOString() : 'never'}`);
      console.log(`  Weekly:   ${state.lastWeekly ? new Date(state.lastWeekly).toISOString() : 'never'}`);
      console.log(`  Monthly:  ${state.lastMonthly ? new Date(state.lastMonthly).toISOString() : 'never'}`);
      break;

    case 'run':
      const sourceDir = options.sourceDir || '.';
      const snapshot = await scheduler.runNow(sourceDir);
      console.log(`Backup completed: ${snapshot.id}`);
      break;

    default:
      console.error(`Unknown action: ${action}. Use: status, run`);
      process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
