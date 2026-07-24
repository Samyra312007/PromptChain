import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import {
  PromptpackExporter,
  PromptpackVerifier,
  CrossProtocolImporter,
  DifferentWalletRestorer,
  DEFAULT_PORTABILITY_EXPORT_OPTIONS,
  CrossProtocolFormat,
} from "@promptchain/portability";

export async function portabilityExportCommand(
  directory: string,
  options: {
    output?: string;
    noVersions?: boolean;
    noLicenses?: boolean;
    noCurations?: boolean;
    noCompress?: boolean;
    signWith?: string;
  },
): Promise<void> {
  const exporter = new PromptpackExporter({
    output: options.output || DEFAULT_PORTABILITY_EXPORT_OPTIONS.output,
    includeVersions: !options.noVersions,
    includeLicenses: !options.noLicenses,
    includeCurations: !options.noCurations,
    compress: !options.noCompress,
    signWith: options.signWith,
  });

  console.log(`Exporting prompts from ${directory} for portability...`);
  const manifest = await exporter.exportAll(directory, options.output);

  const outputPath = options.output || DEFAULT_PORTABILITY_EXPORT_OPTIONS.output;
  const finalPath = outputPath.endsWith(".gz") ? outputPath : outputPath + ".gz";

  console.log(`\nPortability export complete: ${finalPath}`);
  console.log(`  Prompts:   ${manifest.totalPrompts}`);
  console.log(`  Versions:  ${manifest.totalVersions}`);
  console.log(`  Licenses:  ${manifest.totalLicenses}`);
  console.log(`  Curations: ${manifest.totalCurations}`);
  console.log(`  Checksum:  ${manifest.checksum.slice(0, 16)}...`);
  if (manifest.signature) {
    console.log(`  Signed:    by ${manifest.signer}`);
  }
  console.log(`  Exported:  ${new Date(manifest.exportedAt).toISOString()}`);
}

export async function portabilityImportCommand(
  path: string,
  outputDir: string,
  options: { format?: string; newAuthority?: string; overwrite?: boolean },
): Promise<void> {
  if (options.newAuthority) {
    const restorer = new DifferentWalletRestorer();
    console.log(`Restoring to different wallet: ${options.newAuthority}`);
    const result = await restorer.restore(path, outputDir, options.newAuthority, {
      overwriteExisting: options.overwrite || false,
    });
    console.log(`\nRestore complete:`);
    console.log(`  Imported:  ${result.totalImported}`);
    console.log(`  Errors:    ${result.totalErrors}`);
    if (result.verification) {
      console.log(`  Verified:  ${result.verification.verified ? "YES" : "NO"}`);
      console.log(`  Checksum:  ${result.verification.checksumValid ? "PASS" : "FAIL"}`);
    }
    if (result.errors.length > 0) {
      for (const err of result.errors) {
        console.log(`  Error: [${err.filename}] ${err.error}`);
      }
    }
    return;
  }

  const format = options.format as CrossProtocolFormat | undefined;
  const importer = new CrossProtocolImporter();
  console.log(`Importing from ${path} (format: ${format || "auto-detect"})...`);
  const result = await importer.import(path, format);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  let written = 0;
  for (const entry of result.entries) {
    const promptPath = join(outputDir, entry.filename);
    const metaPath = promptPath.replace(/\.prompt$/, ".meta.json");
    try {
      const { writeFile, mkdir } = await import("fs/promises");
      await mkdir(outputDir, { recursive: true });
      await writeFile(promptPath, entry.promptText, "utf8");
      await writeFile(metaPath, JSON.stringify(entry.metadata, null, 2), "utf8");
      written++;
    } catch (err) {
      result.totalErrors++;
      result.errors.push(`Failed to write ${entry.filename}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nImport complete (format: ${result.format}):`);
  console.log(`  Imported:  ${written}`);
  console.log(`  Errors:    ${result.totalErrors}`);
  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.log(`  Error: ${err}`);
    }
  }
}

export async function portabilityVerifyCommand(
  path: string,
): Promise<void> {
  const verifier = new PromptpackVerifier();
  console.log(`Verifying ${path}...`);
  const result = await verifier.verify(path);

  console.log(`\nVerification result:`);
  console.log(`  Valid:      ${result.verified ? "YES" : "NO"}`);
  console.log(`  Checksum:   ${result.checksumValid ? "PASS" : "FAIL"}`);
  console.log(`  Entries:    ${result.entriesValid} valid, ${result.entriesFailed} failed`);
  console.log(`  Total errs: ${result.totalErrors}`);
  if (result.signatureValid !== null) {
    console.log(`  Signature:  ${result.signatureValid ? "VALID" : "INVALID"}${result.signer ? ` (${result.signer})` : ""}`);
  }
  if (result.cidMismatches.length > 0) {
    console.log(`\nCID mismatches (${result.cidMismatches.length}):`);
    for (const m of result.cidMismatches) {
      console.log(`  [${m.filename}] ${m.error}`);
    }
  }
  if (result.checksumMismatches.length > 0) {
    console.log(`\nChecksum mismatches (${result.checksumMismatches.length}):`);
    for (const m of result.checksumMismatches) {
      console.log(`  [${m.filename}] ${m.error}`);
    }
  }
  if (result.errors.length > 0) {
    console.log(`\nAll errors (${result.totalErrors}):`);
    for (const err of result.errors) {
      console.log(`  [${err.code}] ${err.filename}: ${err.error}`);
    }
  }
}

export async function portabilityRestoreCommand(
  archivePath: string,
  outputDir: string,
  newAuthority: string,
  options: { overwrite?: boolean },
): Promise<void> {
  const restorer = new DifferentWalletRestorer();
  console.log(`Restoring from ${archivePath} to ${outputDir} as ${newAuthority}...`);
  const result = await restorer.restore(archivePath, outputDir, newAuthority, {
    overwriteExisting: options.overwrite || false,
  });

  console.log(`\nRestore complete:`);
  console.log(`  Imported:  ${result.totalImported}`);
  console.log(`  Errors:    ${result.totalErrors}`);
  if (result.verification) {
    console.log(`  Verified:  ${result.verification.verified ? "YES" : "NO"}`);
    console.log(`  Checksum:  ${result.verification.checksumValid ? "PASS" : "FAIL"}`);
  }
  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.log(`  Error: [${err.filename}] ${err.error}`);
    }
  }
}
