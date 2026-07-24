export const PORTABILITY_MANIFEST_VERSION = "0.1.0";

export interface LicenseAttachment {
  licenseName: string;
  licenseAddress: string;
  commercialAllowed: boolean;
  attributionRequired: boolean;
  royaltyBasisPoints: number;
  attachedAt: string;
  authority: string;
}

export interface CurationRating {
  curatorAddress: string;
  rating: number;
  reviewUri?: string;
  timestamp: string;
  stakeAtTime: number;
  reputationAtTime: number;
}

export interface PortabilityManifestEntry {
  filename: string;
  promptText: string;
  cid: string;
  checksum: string;
  metadata: Record<string, unknown>;
  versions: PortabilityVersionEntry[];
  license?: LicenseAttachment;
  curations: CurationRating[];
}

export interface PortabilityVersionEntry {
  versionNumber: number;
  author: string;
  promptText: string;
  cid: string;
  checksum: string;
  changelogUri: string;
  metadata: Record<string, unknown>;
}

export interface PortabilityManifest {
  version: string;
  exportedAt: number;
  exportedBy: string;
  source: string;
  totalPrompts: number;
  totalVersions: number;
  totalLicenses: number;
  totalCurations: number;
  entries: PortabilityManifestEntry[];
  checksum: string;
  signature?: string;
  signer?: string;
}

export interface PortabilityExportOptions {
  output: string;
  directory: string;
  includeVersions: boolean;
  includeLicenses: boolean;
  includeCurations: boolean;
  compress: boolean;
  signWith?: string;
}

export const DEFAULT_PORTABILITY_EXPORT_OPTIONS: PortabilityExportOptions = {
  output: "./promptchain-portable.promptpack",
  directory: ".",
  includeVersions: true,
  includeLicenses: true,
  includeCurations: true,
  compress: true,
};

export interface VerificationResult {
  verified: boolean;
  checksumValid: boolean;
  entriesValid: number;
  entriesFailed: number;
  cidMismatches: VerificationError[];
  checksumMismatches: VerificationError[];
  signatureValid: boolean | null;
  signer?: string;
  totalErrors: number;
  errors: VerificationError[];
}

export interface VerificationError {
  filename: string;
  code: "checksum_mismatch" | "cid_mismatch" | "corrupt_entry" | "missing_file" | "signature_invalid" | "validation_failed";
  error: string;
}

export type CrossProtocolFormat = "promptbase-csv" | "flowgpt-json" | "generic-json" | "auto";

export interface CrossProtocolImportResult {
  filename: string;
  promptText: string;
  metadata: Record<string, unknown>;
  cid: string;
}

export interface CrossProtocolImportSummary {
  format: CrossProtocolFormat;
  totalImported: number;
  totalSkipped: number;
  totalErrors: number;
  entries: CrossProtocolImportResult[];
  errors: string[];
}

export interface DifferentWalletRestoreOptions {
  overwriteExisting: boolean;
  newAuthority: string;
  stripCurations: boolean;
  stripLicenses: boolean;
  generateNewTimestamps: boolean;
}

export const DEFAULT_RESTORE_OPTIONS: DifferentWalletRestoreOptions = {
  overwriteExisting: false,
  newAuthority: "",
  stripCurations: true,
  stripLicenses: false,
  generateNewTimestamps: true,
};
