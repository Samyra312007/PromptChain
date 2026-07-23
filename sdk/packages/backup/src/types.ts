export interface BackupManifestEntry {
  filename: string;
  promptText: string;
  cid: string;
  checksum: string;
  metadata: Record<string, unknown>;
  versions: BackupVersionEntry[];
  recoveredFrom?: string;
  importedAt?: number;
}

export interface BackupVersionEntry {
  versionNumber: number;
  author: string;
  promptText: string;
  cid: string;
  checksum: string;
  changelogUri: string;
  metadata: Record<string, unknown>;
}

export interface BackupManifest {
  version: string;
  exportedAt: number;
  exportedBy: string;
  source: string;
  totalPrompts: number;
  totalVersions: number;
  entries: BackupManifestEntry[];
  checksum: string;
  signature?: string;
}

export interface ExportOptions {
  output: string;
  directory: string;
  includeVersions: boolean;
  includeMetadata: boolean;
  compress: boolean;
  format: 'promptpack' | 'tar.gz';
  maxFileSize: number;
}

export interface ImportResult {
  manifest: BackupManifest;
  totalImported: number;
  totalSkipped: number;
  totalErrors: number;
  errors: ImportError[];
  verified: boolean;
  checksumValid: boolean;
}

export interface ImportError {
  filename: string;
  error: string;
  code: 'checksum_mismatch' | 'cid_mismatch' | 'corrupt_entry' | 'missing_file' | 'validation_failed';
}

export interface RecoveryWalletConfig {
  recoveryAddress: string;
  inactivityDays: number;
  reclaimableAfter: number;
}

export interface RecoveryClaim {
  promptCid: string;
  originalAuthority: string;
  recoveredBy: string;
  recoveredAt: number;
  signature: string;
}

export interface ArchiveSnapshot {
  id: string;
  timestamp: number;
  type: 'daily' | 'weekly' | 'monthly';
  manifestCid: string;
  entryCount: number;
  totalSize: number;
  arweaveTx?: string;
  status: 'pending' | 'archived' | 'failed';
}

export interface BackupSchedule {
  daily: {
    enabled: boolean;
    time: string;
    destination: string;
    keepLast: number;
  };
  weekly: {
    enabled: boolean;
    day: number;
    time: string;
    destination: string;
    keepLast: number;
  };
  monthly: {
    enabled: boolean;
    day: number;
    time: string;
    destination: string;
    keepLast: number;
  };
  arweave: {
    enabled: boolean;
    endpoint: string;
    archiveOnExport: boolean;
  };
}

export interface BackupConfig {
  version: string;
  schedule: BackupSchedule;
  recovery?: RecoveryWalletConfig;
  exportDefaults: Partial<ExportOptions>;
}

export const DEFAULT_BACKUP_SCHEDULE: BackupSchedule = {
  daily: {
    enabled: true,
    time: '02:00',
    destination: './.promptchain/backups/daily',
    keepLast: 7,
  },
  weekly: {
    enabled: true,
    day: 0,
    time: '03:00',
    destination: './.promptchain/backups/weekly',
    keepLast: 4,
  },
  monthly: {
    enabled: true,
    day: 1,
    time: '04:00',
    destination: './.promptchain/backups/monthly',
    keepLast: 12,
  },
  arweave: {
    enabled: false,
    endpoint: 'https://arweave.net',
    archiveOnExport: true,
  },
};

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  output: './promptchain-backup.promptpack',
  directory: '.',
  includeVersions: true,
  includeMetadata: true,
  compress: true,
  format: 'promptpack',
  maxFileSize: 500 * 1024 * 1024,
};

export const BACKUP_MANIFEST_VERSION = '0.1.0';
