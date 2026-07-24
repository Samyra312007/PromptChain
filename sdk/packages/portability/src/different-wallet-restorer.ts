import { createHash } from "crypto";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { createGunzip } from "zlib";
import {
  PortabilityManifest,
  PortabilityManifestEntry,
  PortabilityVersionEntry,
  DifferentWalletRestoreOptions,
  DEFAULT_RESTORE_OPTIONS,
  VerificationResult,
  VerificationError,
} from "./types";
import { PromptpackVerifier } from "./promptpack-verifier";
import { computeCid, PROMPT_FILE_EXT, META_FILE_SUFFIX } from "@promptchain/storage";

const TAR_BLOCK_SIZE = 512;

export interface RestoreResult {
  totalImported: number;
  totalSkipped: number;
  totalErrors: number;
  errors: RestoreError[];
  verification: VerificationResult | null;
}

export interface RestoreError {
  filename: string;
  error: string;
}

export class DifferentWalletRestorer {
  private verifier: PromptpackVerifier;

  constructor() {
    this.verifier = new PromptpackVerifier();
  }

  async restore(
    archivePath: string,
    outputDir: string,
    newAuthority: string,
    options?: Partial<DifferentWalletRestoreOptions>,
  ): Promise<RestoreResult> {
    const opts: DifferentWalletRestoreOptions = { ...DEFAULT_RESTORE_OPTIONS, ...options, newAuthority };
    const rawData = await readFile(archivePath);
    const data = await this.maybeDecompress(rawData, archivePath);
    const files = this.extractTar(data);
    const manifest = this.extractManifest(files);

    const verification = await this.verifier.verify(archivePath);

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const result: RestoreResult = {
      totalImported: 0,
      totalSkipped: 0,
      totalErrors: 0,
      errors: [],
      verification,
    };

    for (const entry of manifest.entries) {
      try {
        await this.restoreEntry(entry, outputDir, opts, files);
        result.totalImported++;
      } catch (err) {
        result.totalErrors++;
        result.errors.push({
          filename: entry.filename,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }

  private async restoreEntry(
    entry: PortabilityManifestEntry,
    outputDir: string,
    opts: DifferentWalletRestoreOptions,
    files: Map<string, Buffer>,
  ): Promise<void> {
    const finalDir = opts.generateNewTimestamps ? outputDir : outputDir;
    const promptName = entry.filename;
    const promptPath = join(finalDir, promptName);
    if (existsSync(promptPath) && !opts.overwriteExisting) {
      return;
    }

    if (!existsSync(dirname(promptPath))) {
      mkdirSync(dirname(promptPath), { recursive: true });
    }

    let metadata = { ...entry.metadata };
    if (opts.generateNewTimestamps) {
      const now = new Date().toISOString();
      metadata.created_at = now;
      metadata.updated_at = now;
    }
    if (opts.newAuthority) {
      metadata.imported_by = opts.newAuthority;
      metadata.original_author = entry.metadata.original_author || entry.metadata.author || "";
      metadata.author = opts.newAuthority;
    }

    await writeFile(promptPath, entry.promptText, "utf8");
    const metaPath = promptPath.replace(PROMPT_FILE_EXT, META_FILE_SUFFIX);
    await writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf8");

    if (!opts.stripLicenses && entry.license) {
      const licensesDir = join(finalDir, ".licenses");
      if (!existsSync(licensesDir)) mkdirSync(licensesDir, { recursive: true });
      const licensePath = join(licensesDir, `${promptName.replace(PROMPT_FILE_EXT, ".license.json")}`);
      const updatedLicense = { ...entry.license };
      if (opts.newAuthority) {
        updatedLicense.authority = opts.newAuthority;
      }
      await writeFile(licensePath, JSON.stringify(updatedLicense, null, 2), "utf8");
    }

    if (!opts.stripCurations && entry.curations.length > 0) {
      const curationsDir = join(finalDir, ".curations", promptName.replace(PROMPT_FILE_EXT, ""));
      if (!existsSync(curationsDir)) mkdirSync(curationsDir, { recursive: true });
      for (let i = 0; i < entry.curations.length; i++) {
        const curPath = join(curationsDir, `curation_${i}.json`);
        await writeFile(curPath, JSON.stringify(entry.curations[i], null, 2), "utf8");
      }
    }

    for (const version of entry.versions) {
      const versionsDir = join(finalDir, ".versions", promptName.replace(PROMPT_FILE_EXT, ""));
      if (!existsSync(versionsDir)) mkdirSync(versionsDir, { recursive: true });
      const vPath = join(versionsDir, `v${version.versionNumber}${PROMPT_FILE_EXT}`);
      await writeFile(vPath, version.promptText, "utf8");
      const vMetaPath = vPath.replace(PROMPT_FILE_EXT, META_FILE_SUFFIX);
      const vMeta = { ...version.metadata, author: opts.newAuthority || version.author };
      if (opts.generateNewTimestamps) {
        (vMeta as any).updated_at = new Date().toISOString();
      }
      await writeFile(vMetaPath, JSON.stringify(vMeta, null, 2), "utf8");
    }
  }

  private async maybeDecompress(data: Buffer, path: string): Promise<Buffer> {
    if (path.endsWith(".gz") || this.isGzipped(data)) {
      return this.gunzip(data);
    }
    return data;
  }

  private isGzipped(data: Buffer): boolean {
    return data.length > 2 && data[0] === 0x1f && data[1] === 0x8b;
  }

  private gunzip(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const gunzip = createGunzip();
      const chunks: Buffer[] = [];
      gunzip.on("data", (chunk: Buffer) => chunks.push(chunk));
      gunzip.on("end", () => resolve(Buffer.concat(chunks)));
      gunzip.on("error", reject);
      gunzip.write(data);
      gunzip.end();
    });
  }

  private extractTar(data: Buffer): Map<string, Buffer> {
    const files = new Map<string, Buffer>();
    let offset = 0;

    while (offset + TAR_BLOCK_SIZE <= data.length) {
      const header = data.subarray(offset, offset + TAR_BLOCK_SIZE);
      const name = this.readStr(header, 0, 100);
      if (name.length === 0) break;

      const sizeStr = this.readStr(header, 124, 12);
      const size = parseInt(sizeStr, 8);
      const type = String.fromCharCode(header[156]);

      offset += TAR_BLOCK_SIZE;
      if (type === "5") continue;

      if (size > 0 && offset + size <= data.length) {
        files.set(name, data.subarray(offset, offset + size));
      }

      offset += Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
      if (offset >= data.length) break;
    }

    return files;
  }

  private extractManifest(files: Map<string, Buffer>): PortabilityManifest {
    const manifestData = files.get("manifest.json");
    if (!manifestData) {
      throw new Error("Archive is missing manifest.json — corrupt or invalid format");
    }
    return JSON.parse(manifestData.toString("utf8"));
  }

  private readStr(buf: Buffer, offset: number, len: number): string {
    const end = buf.indexOf(0, offset);
    return buf.toString("ascii", offset, end >= 0 ? end : offset + len);
  }
}
