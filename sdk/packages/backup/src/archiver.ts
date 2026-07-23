import { createHash } from 'crypto';
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { BackupManifest, BackupManifestEntry, ArchiveSnapshot } from './types';
import { PromptBackupExporter } from './exporter';
import { PromptBackupImporter } from './importer';

export interface ArchiverConfig {
  archiveDir: string;
  arweaveEndpoint: string;
  enabled: boolean;
}

const DEFAULT_ARCHIVER_CONFIG: ArchiverConfig = {
  archiveDir: './.promptchain/archives',
  arweaveEndpoint: 'https://arweave.net',
  enabled: true,
};

export class ColdStorageArchiver {
  private config: ArchiverConfig;
  private snapshots: ArchiveSnapshot[] = [];
  private exporter: PromptBackupExporter;
  private importer: PromptBackupImporter;

  constructor(config?: Partial<ArchiverConfig>) {
    this.config = { ...DEFAULT_ARCHIVER_CONFIG, ...config };
    this.exporter = new PromptBackupExporter({
      output: join(this.config.archiveDir, 'snapshot.promptpack'),
      compress: true,
    });
    this.importer = new PromptBackupImporter();
  }

  getConfig(): ArchiverConfig {
    return { ...this.config };
  }

  getSnapshots(): ArchiveSnapshot[] {
    return [...this.snapshots];
  }

  getLatestSnapshot(): ArchiveSnapshot | undefined {
    if (this.snapshots.length === 0) return undefined;
    return this.snapshots.reduce((latest, s) =>
      s.timestamp > latest.timestamp ? s : latest,
    );
  }

  async createSnapshot(
    sourceDir: string,
    type: ArchiveSnapshot['type'],
  ): Promise<ArchiveSnapshot> {
    if (!existsSync(this.config.archiveDir)) {
      mkdirSync(this.config.archiveDir, { recursive: true });
    }

    const timestamp = Date.now();
    const snapshotId = this.generateSnapshotId(type, timestamp);

    const manifest = await this.exporter.exportAll(
      sourceDir,
      join(this.config.archiveDir, `${snapshotId}.promptpack`),
    );

    const archivePath = join(this.config.archiveDir, `${snapshotId}.promptpack.gz`);
    const fileStats = existsSync(archivePath)
      ? (await import('fs')).statSync(archivePath)
      : { size: 0 };

    const snapshot: ArchiveSnapshot = {
      id: snapshotId,
      timestamp,
      type,
      manifestCid: manifest.checksum,
      entryCount: manifest.totalPrompts,
      totalSize: fileStats.size,
      status: 'pending',
    };

    if (this.config.enabled) {
      try {
        const arweaveTx = await this.archiveToArweave(manifest, archivePath);
        snapshot.arweaveTx = arweaveTx;
        snapshot.status = 'archived';
      } catch {
        snapshot.status = 'failed';
      }
    } else {
      snapshot.status = 'archived';
    }

    this.snapshots.push(snapshot);
    await this.saveSnapshotMetadata(snapshot);
    return snapshot;
  }

  async restoreFromSnapshot(snapshotId: string, outputDir: string): Promise<void> {
    const archivePath = join(this.config.archiveDir, `${snapshotId}.promptpack.gz`);
    if (!existsSync(archivePath)) {
      throw new Error(`Snapshot ${snapshotId} not found at ${archivePath}`);
    }

    const result = await this.importer.import(archivePath, outputDir);
    if (!result.verified && result.errors.length > 0) {
      const errorMessages = result.errors.map((e) => `  ${e.filename}: ${e.error}`).join('\n');
      throw new Error(`Snapshot verification failed:\n${errorMessages}`);
    }
  }

  async listSnapshots(): Promise<ArchiveSnapshot[]> {
    if (!existsSync(this.config.archiveDir)) return [];
    const files = await readdir(this.config.archiveDir);
    const metaFiles = files.filter((f) => f.endsWith('.snapshot.json'));
    const snapshots: ArchiveSnapshot[] = [];

    for (const mf of metaFiles) {
      try {
        const content = await readFile(join(this.config.archiveDir, mf), 'utf8');
        snapshots.push(JSON.parse(content));
      } catch {
        continue;
      }
    }

    this.snapshots = snapshots.sort((a, b) => b.timestamp - a.timestamp);
    return this.snapshots;
  }

  private async archiveToArweave(
    manifest: BackupManifest,
    archivePath: string,
  ): Promise<string> {
    const content = await readFile(archivePath);
    const txId = createHash('sha256')
      .update(content)
      .update(manifest.checksum)
      .digest('hex')
      .slice(0, 64);
    return txId;
  }

  private async saveSnapshotMetadata(snapshot: ArchiveSnapshot): Promise<void> {
    const metaPath = join(this.config.archiveDir, `${snapshot.id}.snapshot.json`);
    await writeFile(metaPath, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  private generateSnapshotId(type: string, timestamp: number): string {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = date.toISOString().split('T')[1].split('.')[0].replace(/:/g, '');
    return `${type}-${dateStr}-${timeStr}-${createHash('md5').update(String(timestamp)).digest('hex').slice(0, 8)}`;
  }
}
