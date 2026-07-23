import { createHash } from 'crypto';
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { createGzip } from 'zlib';
import {
  BackupManifest,
  BackupManifestEntry,
  BackupVersionEntry,
  ExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  BACKUP_MANIFEST_VERSION,
} from './types';
import {
  readPromptFile,
  computeCid,
  isValidPromptFile,
  PROMPT_FILE_EXT,
  META_FILE_SUFFIX,
} from '@promptchain/storage';

const TAR_BLOCK_SIZE = 512;
const TAR_TYPE_FILE = '0';

interface TarHeader {
  name: string;
  mode: number;
  uid: number;
  gid: number;
  size: number;
  mtime: number;
  type: string;
  linkname: string;
  uname: string;
  gname: string;
}

function encodeTarHeader(header: TarHeader): Buffer {
  const buf = Buffer.alloc(TAR_BLOCK_SIZE);
  const name = header.name.length > 100 ? header.name.slice(0, 100) : header.name;
  writeStr(buf, 0, 100, name);
  writeOct(buf, 100, 8, header.mode);
  writeOct(buf, 108, 8, header.uid);
  writeOct(buf, 116, 8, header.gid);
  writeOct(buf, 124, 12, header.size);
  writeOct(buf, 136, 12, header.mtime);
  buf[156] = header.type.charCodeAt(0);
  writeStr(buf, 157, 100, header.linkname);
  writeStr(buf, 257, 6, 'ustar');
  writeStr(buf, 263, 2, '00');
  writeStr(buf, 265, 32, header.uname);
  writeStr(buf, 297, 32, header.gname);
  const checksum = computeTarChecksum(buf);
  writeOct(buf, 148, 8, checksum);
  return buf;
}

function writeStr(buf: Buffer, offset: number, len: number, val: string): void {
  buf.write(val, offset, Math.min(len, val.length), 'ascii');
}

function writeOct(buf: Buffer, offset: number, len: number, val: number): void {
  const str = val.toString(8).padStart(len - 1, '0');
  buf.write(str, offset, str.length, 'ascii');
  buf[offset + len - 1] = 32;
}

function computeTarChecksum(buf: Buffer): number {
  let sum = 0;
  for (let i = 0; i < TAR_BLOCK_SIZE; i++) sum += buf[i];
  for (let i = 148; i < 156; i++) sum -= buf[i];
  sum += 32 * 8;
  return sum;
}

function padToBlock(data: Buffer): Buffer {
  const remainder = data.length % TAR_BLOCK_SIZE;
  if (remainder === 0) return data;
  const pad = Buffer.alloc(TAR_BLOCK_SIZE - remainder);
  return Buffer.concat([data, pad]);
}

export class PromptBackupExporter {
  private options: ExportOptions;

  constructor(options?: Partial<ExportOptions>) {
    this.options = { ...DEFAULT_EXPORT_OPTIONS, ...options };
  }

  async exportAll(directory: string, outputPath?: string): Promise<BackupManifest> {
    const resolvedOutput = outputPath || this.options.output;
    const entries = await this.collectEntries(directory);
    const manifest = this.buildManifest(entries, directory);
    const outputDir = dirname(resolvedOutput);
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
    await this.writePromptPack(resolvedOutput, manifest, entries);
    return manifest;
  }

  async exportPrompt(directory: string, promptName: string, outputPath: string): Promise<BackupManifestEntry> {
    const filePath = join(directory, promptName.endsWith(PROMPT_FILE_EXT) ? promptName : promptName + PROMPT_FILE_EXT);
    const prompt = await readPromptFile(filePath);
    const versions = await this.collectVersions(promptName, directory);
    const entry: BackupManifestEntry = {
      filename: prompt.filename,
      promptText: prompt.promptText,
      cid: prompt.cid,
      checksum: this.computeChecksum(prompt.promptText),
      metadata: prompt.metadata as unknown as Record<string, unknown>,
      versions,
    };
    const manifest: BackupManifest = {
      version: BACKUP_MANIFEST_VERSION,
      exportedAt: Date.now(),
      exportedBy: 'promptchain-cli',
      source: directory,
      totalPrompts: 1,
      totalVersions: versions.length,
      entries: [entry],
      checksum: '',
    };
    manifest.checksum = this.computeManifestChecksum(manifest);
    await this.writePromptPack(outputPath, manifest, [entry]);
    return entry;
  }

  private async collectEntries(directory: string): Promise<BackupManifestEntry[]> {
    const files = await readdir(directory);
    const promptFiles = files.filter((f: string) => isValidPromptFile(f));
    const entries: BackupManifestEntry[] = [];

    for (const file of promptFiles) {
      try {
        const filePath = join(directory, file);
        const prompt = await readPromptFile(filePath);
        const versions = this.options.includeVersions ? await this.collectVersions(file, directory) : [];
        entries.push({
          filename: prompt.filename,
          promptText: prompt.promptText,
          cid: prompt.cid,
          checksum: this.computeChecksum(prompt.promptText),
          metadata: prompt.metadata as unknown as Record<string, unknown>,
          versions,
        });
      } catch {
        continue;
      }
    }

    return entries;
  }

  private async collectVersions(promptName: string, directory: string): Promise<BackupVersionEntry[]> {
    const baseName = promptName.replace(PROMPT_FILE_EXT, '');
    const versionsDir = join(directory, '.versions', baseName);
    try {
      await stat(versionsDir);
    } catch {
      return [];
    }

    let versionFiles: string[];
    try {
      versionFiles = (await readdir(versionsDir))
        .filter((f: string) => f.endsWith(PROMPT_FILE_EXT))
        .sort();
    } catch {
      return [];
    }

    const versions: BackupVersionEntry[] = [];
    for (const vf of versionFiles) {
      try {
        const vPath = join(versionsDir, vf);
        const vText = await readFile(vPath, 'utf8');
        const metaPath = vPath.replace(PROMPT_FILE_EXT, META_FILE_SUFFIX);
        let vMeta: Record<string, unknown> = {};
        try {
          vMeta = JSON.parse(await readFile(metaPath, 'utf8'));
        } catch {}
        versions.push({
          versionNumber: parseInt(vf.replace(PROMPT_FILE_EXT, '').replace(/^v/, '')) || 0,
          author: (vMeta.author as string) || '',
          promptText: vText,
          cid: computeCid(vText),
          checksum: this.computeChecksum(vText),
          changelogUri: (vMeta.changelogUri as string) || '',
          metadata: vMeta,
        });
      } catch {
        continue;
      }
    }

    return versions;
  }

  private buildManifest(entries: BackupManifestEntry[], directory: string): BackupManifest {
    const totalVersions = entries.reduce((sum: number, e: BackupManifestEntry) => sum + e.versions.length, 0);
    const manifest: BackupManifest = {
      version: BACKUP_MANIFEST_VERSION,
      exportedAt: Date.now(),
      exportedBy: 'promptchain-cli',
      source: directory,
      totalPrompts: entries.length,
      totalVersions,
      entries,
      checksum: '',
    };
    manifest.checksum = this.computeManifestChecksum(manifest);
    return manifest;
  }

  private async writePromptPack(outputPath: string, manifest: BackupManifest, entries: BackupManifestEntry[]): Promise<void> {
    const tarParts: Buffer[] = [];

    const manifestJson = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
    tarParts.push(encodeTarHeader({
      name: 'manifest.json',
      mode: 0o644,
      uid: 1000,
      gid: 1000,
      size: manifestJson.length,
      mtime: Math.floor(Date.now() / 1000),
      type: TAR_TYPE_FILE,
      linkname: '',
      uname: 'promptchain',
      gname: 'promptchain',
    }));
    tarParts.push(manifestJson);
    tarParts.push(padToBlock(manifestJson));

    for (const entry of entries) {
      const promptData = Buffer.from(entry.promptText, 'utf8');
      const promptName = `prompts/${entry.filename}`;
      tarParts.push(encodeTarHeader({
        name: promptName,
        mode: 0o644,
        uid: 1000,
        gid: 1000,
        size: promptData.length,
        mtime: Math.floor(Date.now() / 1000),
        type: TAR_TYPE_FILE,
        linkname: '',
        uname: 'promptchain',
        gname: 'promptchain',
      }));
      tarParts.push(promptData);
      tarParts.push(padToBlock(promptData));

      if (this.options.includeMetadata) {
        const metaJson = Buffer.from(JSON.stringify(entry.metadata, null, 2), 'utf8');
        const metaName = `prompts/${entry.filename.replace(PROMPT_FILE_EXT, META_FILE_SUFFIX)}`;
        tarParts.push(encodeTarHeader({
          name: metaName,
          mode: 0o644,
          uid: 1000,
          gid: 1000,
          size: metaJson.length,
          mtime: Math.floor(Date.now() / 1000),
          type: TAR_TYPE_FILE,
          linkname: '',
          uname: 'promptchain',
          gname: 'promptchain',
        }));
        tarParts.push(metaJson);
        tarParts.push(padToBlock(metaJson));
      }

      for (const version of entry.versions) {
        const vData = Buffer.from(version.promptText, 'utf8');
        const vName = `versions/${entry.filename.replace(PROMPT_FILE_EXT, '')}/v${version.versionNumber}${PROMPT_FILE_EXT}`;
        tarParts.push(encodeTarHeader({
          name: vName,
          mode: 0o644,
          uid: 1000,
          gid: 1000,
          size: vData.length,
          mtime: Math.floor(Date.now() / 1000),
          type: TAR_TYPE_FILE,
          linkname: '',
          uname: 'promptchain',
          gname: 'promptchain',
        }));
        tarParts.push(vData);
        tarParts.push(padToBlock(vData));
      }
    }

    const endBlocks = Buffer.alloc(TAR_BLOCK_SIZE * 2);
    tarParts.push(endBlocks);

    const tarBuffer = Buffer.concat(tarParts);
    const finalPath = outputPath.endsWith('.tar.gz') || outputPath.endsWith('.promptpack')
      ? outputPath
      : outputPath + '.promptpack';

    if (this.options.compress) {
      const gzPath = finalPath.endsWith('.gz') ? finalPath : finalPath + '.gz';
      const gzip = createGzip();
      const writer = createWriteStream(gzPath);
      gzip.pipe(writer);
      gzip.write(tarBuffer);
      gzip.end();
      await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } else {
      await writeFile(finalPath, tarBuffer);
    }
  }

  computeChecksum(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  private computeManifestChecksum(manifest: BackupManifest): string {
    const rest = { ...manifest, checksum: '' };
    return createHash('sha256')
      .update(JSON.stringify(rest), 'utf8')
      .digest('hex');
  }
}
