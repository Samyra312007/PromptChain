import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { createGunzip } from "zlib";
import {
  PortabilityManifest,
  PortabilityManifestEntry,
  VerificationResult,
  VerificationError,
} from "./types";
import { computeCid } from "@promptchain/storage";

const TAR_BLOCK_SIZE = 512;

export class PromptpackVerifier {
  async verify(path: string): Promise<VerificationResult> {
    const rawData = await readFile(path);
    const data = await this.maybeDecompress(rawData, path);
    const files = this.extractTar(data);
    const manifest = this.extractManifest(files);

    const result: VerificationResult = {
      verified: false,
      checksumValid: false,
      entriesValid: 0,
      entriesFailed: 0,
      cidMismatches: [],
      checksumMismatches: [],
      signatureValid: null,
      totalErrors: 0,
      errors: [],
    };

    result.checksumValid = this.verifyManifestChecksum(manifest);
    if (!result.checksumValid) {
      result.errors.push({
        filename: "manifest.json",
        code: "checksum_mismatch",
        error: "Manifest checksum is invalid — file may be corrupted",
      });
      result.totalErrors++;
    }

    if (manifest.signature && manifest.signer) {
      result.signatureValid = this.verifySignature(manifest);
      if (!result.signatureValid) {
        result.errors.push({
          filename: "manifest.json",
          code: "signature_invalid",
          error: `Signature from ${manifest.signer} is invalid`,
        });
        result.totalErrors++;
      }
      result.signer = manifest.signer;
    }

    for (const entry of manifest.entries) {
      const entryErrors = this.validateEntry(entry, files);
      if (entryErrors.length > 0) {
        result.entriesFailed++;
        result.errors.push(...entryErrors);
        result.totalErrors += entryErrors.length;
        for (const err of entryErrors) {
          if (err.code === "cid_mismatch") result.cidMismatches.push(err);
          if (err.code === "checksum_mismatch") result.checksumMismatches.push(err);
        }
      } else {
        result.entriesValid++;
      }
    }

    result.verified = result.checksumValid && result.entriesFailed === 0;
    return result;
  }

  verifyManifestChecksum(manifest: PortabilityManifest): boolean {
    const checksum = manifest.checksum;
    const { checksum: _removed, ...rest } = manifest;
    const expected = createHash("sha256")
      .update(JSON.stringify(rest), "utf8")
      .digest("hex");
    return expected === checksum;
  }

  private verifySignature(manifest: PortabilityManifest): boolean {
    if (!manifest.signature || !manifest.signer) return false;
    const { checksum } = manifest;
    const signedData = `${manifest.version}|${manifest.exportedAt}|${manifest.exportedBy}|${checksum}`;
    const expectedSig = createHash("sha256")
      .update(signedData + manifest.signer, "utf8")
      .digest("hex")
      .slice(0, 16);
    return manifest.signature === expectedSig;
  }

  private validateEntry(
    entry: PortabilityManifestEntry,
    files: Map<string, Buffer>,
  ): VerificationError[] {
    const errors: VerificationError[] = [];

    const expectedCid = computeCid(entry.promptText);
    if (expectedCid !== entry.cid) {
      errors.push({
        filename: entry.filename,
        code: "cid_mismatch",
        error: `CID mismatch for ${entry.filename}: expected ${expectedCid}, found ${entry.cid}`,
      });
    }

    const expectedChecksum = createHash("sha256")
      .update(entry.promptText, "utf8")
      .digest("hex");
    if (expectedChecksum !== entry.checksum) {
      errors.push({
        filename: entry.filename,
        code: "checksum_mismatch",
        error: `Checksum mismatch for ${entry.filename}`,
      });
    }

    const promptFile = files.get(`prompts/${entry.filename}`);
    if (promptFile) {
      const fileCid = computeCid(promptFile.toString("utf8"));
      if (fileCid !== entry.cid) {
        errors.push({
          filename: entry.filename,
          code: "cid_mismatch",
          error: `Archive file CID mismatch for ${entry.filename}: computed ${fileCid}, manifest says ${entry.cid}`,
        });
      }
    }

    for (const version of entry.versions) {
      const vCid = computeCid(version.promptText);
      if (vCid !== version.cid) {
        errors.push({
          filename: `${entry.filename} v${version.versionNumber}`,
          code: "cid_mismatch",
          error: `CID mismatch for version ${version.versionNumber} of ${entry.filename}`,
        });
      }
      const vChecksum = createHash("sha256")
        .update(version.promptText, "utf8")
        .digest("hex");
      if (vChecksum !== version.checksum) {
        errors.push({
          filename: `${entry.filename} v${version.versionNumber}`,
          code: "checksum_mismatch",
          error: `Checksum mismatch for version ${version.versionNumber} of ${entry.filename}`,
        });
      }
    }

    return errors;
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
        const content = data.subarray(offset, offset + size);
        files.set(name, content);
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
    try {
      return JSON.parse(manifestData.toString("utf8"));
    } catch {
      throw new Error("manifest.json is not valid JSON — archive may be corrupted");
    }
  }

  private readStr(buf: Buffer, offset: number, len: number): string {
    const end = buf.indexOf(0, offset);
    return buf.toString("ascii", offset, end >= 0 ? end : offset + len);
  }
}
