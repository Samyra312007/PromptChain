import { createHash, randomBytes } from 'crypto';
import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { createGunzip } from 'zlib';
import {
  BackupManifest,
  BackupManifestEntry,
  ImportResult,
  ImportError,
  BACKUP_MANIFEST_VERSION,
} from './types';
import {
  writePromptFile,
  computeCid,
  META_FILE_SUFFIX,
  PROMPT_FILE_EXT,
} from '@promptchain/storage';

const TAR_BLOCK_SIZE = 512;

export class PromptBackupImporter {
  async import(path: string, outputDir: string): Promise<ImportResult> {
    const tarData = await this.readArchive(path);
    const files = this.extractTar(tarData);
    const manifest = this.extractManifest(files);

    const result: ImportResult = {
      manifest,
      totalImported: 0,
      totalSkipped: 0,
      totalErrors: 0,
      errors: [],
      verified: false,
      checksumValid: false,
    };

    result.checksumValid = this.verifyManifestChecksum(manifest);
    if (!result.checksumValid) {
      result.errors.push({
        filename: 'manifest.json',
        error: 'Manifest checksum is invalid — file may be corrupted',
        code: 'checksum_mismatch',
      });
      result.totalErrors++;
    }

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    for (const entry of manifest.entries) {
      try {
        await this.restoreEntry(entry, outputDir, files);
        result.totalImported++;
      } catch (err) {
        result.totalErrors++;
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push({
          filename: entry.filename,
          error: errMsg,
          code: errMsg.includes('checksum') ? 'checksum_mismatch'
            : errMsg.includes('CID') ? 'cid_mismatch'
            : 'validation_failed',
        });
      }
    }

    result.totalSkipped = 0;
    result.verified = result.checksumValid && result.totalErrors === 0;
    return result;
  }

  async verify(path: string): Promise<ImportResult> {
    const tarData = await this.readArchive(path);
    const files = this.extractTar(tarData);
    const manifest = this.extractManifest(files);

    const result: ImportResult = {
      manifest,
      totalImported: 0,
      totalSkipped: 0,
      totalErrors: 0,
      errors: [],
      verified: false,
      checksumValid: false,
    };

    result.checksumValid = this.verifyManifestChecksum(manifest);
    if (!result.checksumValid) {
      result.errors.push({
        filename: 'manifest.json',
        error: 'Manifest checksum is invalid — file may be corrupted',
        code: 'checksum_mismatch',
      });
      result.totalErrors++;
    }

    for (const entry of manifest.entries) {
      const validationError = this.validateEntry(entry, files);
      if (validationError) {
        result.errors.push(validationError);
        result.totalErrors++;
      } else {
        result.totalImported++;
      }
    }

    result.verified = result.checksumValid && result.totalErrors === 0;
    return result;
  }

  private async readArchive(path: string): Promise<Buffer> {
    const data = await readFile(path);
    if (path.endsWith('.gz') || path.endsWith('.promptpack')) {
      if (this.isGzipped(data)) {
        return await this.gunzip(data);
      }
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
      gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
      gunzip.on('end', () => resolve(Buffer.concat(chunks)));
      gunzip.on('error', reject);
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
      if (type === TAR_TYPE_DIR) continue;

      if (size > 0 && offset + size <= data.length) {
        const content = data.subarray(offset, offset + size);
        files.set(name, content);
      }

      offset += Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
      if (offset >= data.length) break;
    }

    return files;
  }

  private extractManifest(files: Map<string, Buffer>): BackupManifest {
    const manifestData = files.get('manifest.json');
    if (!manifestData) {
      throw new Error('Backup archive is missing manifest.json — corrupt or invalid format');
    }
    try {
      return JSON.parse(manifestData.toString('utf8'));
    } catch {
      throw new Error('manifest.json is not valid JSON — archive may be corrupted');
    }
  }

  private async restoreEntry(
    entry: BackupManifestEntry,
    outputDir: string,
    files: Map<string, Buffer>,
  ): Promise<void> {
    const validationError = this.validateEntry(entry, files);
    if (validationError) throw new Error(validationError.error);

    const promptName = entry.filename;
    const promptPath = join(outputDir, promptName);
    if (!existsSync(dirname(promptPath))) mkdirSync(dirname(promptPath), { recursive: true });

    await writeFile(promptPath, entry.promptText, 'utf8');

    const metaPath = promptPath.replace(PROMPT_FILE_EXT, META_FILE_SUFFIX);
    await writeFile(metaPath, JSON.stringify(entry.metadata, null, 2), 'utf8');

    for (const version of entry.versions) {
      const versionsDir = join(outputDir, '.versions', promptName.replace(PROMPT_FILE_EXT, ''));
      if (!existsSync(versionsDir)) mkdirSync(versionsDir, { recursive: true });
      const vPath = join(versionsDir, `v${version.versionNumber}${PROMPT_FILE_EXT}`);
      await writeFile(vPath, version.promptText, 'utf8');
      const vMetaPath = vPath.replace(PROMPT_FILE_EXT, META_FILE_SUFFIX);
      await writeFile(vMetaPath, JSON.stringify(version.metadata, null, 2), 'utf8');
    }
  }

  private validateEntry(
    entry: BackupManifestEntry,
    files: Map<string, Buffer>,
  ): ImportError | null {
    const expectedCid = computeCid(entry.promptText);
    if (expectedCid !== entry.cid) {
      return {
        filename: entry.filename,
        error: `CID mismatch for ${entry.filename}: expected ${entry.cid}, computed ${expectedCid}`,
        code: 'cid_mismatch',
      };
    }

    const expectedChecksum = createHash('sha256')
      .update(entry.promptText, 'utf8')
      .digest('hex');
    if (expectedChecksum !== entry.checksum) {
      return {
        filename: entry.filename,
        error: `Checksum mismatch for ${entry.filename}`,
        code: 'checksum_mismatch',
      };
    }

    for (const version of entry.versions) {
      const vCid = computeCid(version.promptText);
      if (vCid !== version.cid) {
        return {
          filename: `${entry.filename} v${version.versionNumber}`,
          error: `CID mismatch for version ${version.versionNumber}`,
          code: 'cid_mismatch',
        };
      }
      const vChecksum = createHash('sha256')
        .update(version.promptText, 'utf8')
        .digest('hex');
      if (vChecksum !== version.checksum) {
        return {
          filename: `${entry.filename} v${version.versionNumber}`,
          error: `Checksum mismatch for version ${version.versionNumber}`,
          code: 'checksum_mismatch',
        };
      }
    }

    return null;
  }

  verifyManifestChecksum(manifest: BackupManifest): boolean {
    const { checksum, ...rest } = manifest;
    const expected = createHash('sha256')
      .update(JSON.stringify({ ...rest, checksum: '' }), 'utf8')
      .digest('hex');
    return expected === checksum;
  }

  private readStr(buf: Buffer, offset: number, len: number): string {
    const end = buf.indexOf(0, offset);
    return buf.toString('ascii', offset, end >= 0 ? end : offset + len);
  }
}

const TAR_TYPE_DIR = '5';
