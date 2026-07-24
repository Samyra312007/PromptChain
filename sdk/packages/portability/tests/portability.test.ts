import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, readFile, unlink, rmdir, readdir } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { PromptpackExporter } from "../src/promptpack-exporter";
import { PromptpackVerifier } from "../src/promptpack-verifier";
import { CrossProtocolImporter } from "../src/cross-protocol-importer";
import { DifferentWalletRestorer } from "../src/different-wallet-restorer";
import {
  PortabilityManifest,
  PORTABILITY_MANIFEST_VERSION,
} from "../src/types";

const TEST_DIR = join("/tmp", "promptchain-portability-test");
const PROMPTS_DIR = join(TEST_DIR, "prompts");
const OUTPUT_DIR = join(TEST_DIR, "output");
const IMPORT_DIR = join(TEST_DIR, "imported");
const RESTORE_DIR = join(TEST_DIR, "restored");

async function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function cleanup(dir: string) {
  try {
    const entries = await readdir(dir).catch(() => []);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const s = await (await import("fs")).promises.stat(fullPath);
        if (s.isDirectory()) {
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
  await ensureDir(IMPORT_DIR);
  await ensureDir(RESTORE_DIR);
});

afterEach(async () => {
  await cleanup(TEST_DIR);
});

async function createSamplePrompt(name: string, text: string, tags?: string[]): Promise<void> {
  await writeFile(join(PROMPTS_DIR, `${name}.prompt`), text, "utf8");
  await writeFile(
    join(PROMPTS_DIR, `${name}.meta.json`),
    JSON.stringify({
      name,
      description: `Test ${name}`,
      prompt_text: text,
      category: "code",
      tags: tags || ["test"],
      task_description: "test task",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      language: "en",
    }, null, 2),
    "utf8",
  );
}

async function createVersion(promptName: string, versionNum: number, text: string): Promise<void> {
  const versionsDir = join(PROMPTS_DIR, ".versions", promptName);
  if (!existsSync(versionsDir)) mkdirSync(versionsDir, { recursive: true });
  await writeFile(join(versionsDir, `v${versionNum}.prompt`), text, "utf8");
  await writeFile(
    join(versionsDir, `v${versionNum}.meta.json`),
    JSON.stringify({ author: "test-author", changelogUri: `https://example.com/v${versionNum}` }, null, 2),
    "utf8",
  );
}

async function createLicense(promptName: string): Promise<void> {
  const licDir = join(PROMPTS_DIR, ".licenses");
  if (!existsSync(licDir)) mkdirSync(licDir, { recursive: true });
  await writeFile(
    join(licDir, `${promptName}.license.json`),
    JSON.stringify({
      licenseName: "MIT",
      licenseAddress: "LicenseAddr123",
      commercialAllowed: true,
      attributionRequired: true,
      royaltyBasisPoints: 500,
      attachedAt: new Date().toISOString(),
      authority: "AuthorAddr",
    }, null, 2),
    "utf8",
  );
}

async function createCuration(promptName: string, curatorAddr: string, rating: number): Promise<void> {
  const curDir = join(PROMPTS_DIR, ".curations", promptName);
  if (!existsSync(curDir)) mkdirSync(curDir, { recursive: true });
  await writeFile(
    join(curDir, `${curatorAddr}.json`),
    JSON.stringify({
      curatorAddress: curatorAddr,
      rating,
      timestamp: new Date().toISOString(),
      stakeAtTime: 1000,
      reputationAtTime: 500,
    }, null, 2),
    "utf8",
  );
}

describe("PromptpackExporter", () => {
  it("exports all prompts with metadata", async () => {
    await createSamplePrompt("hello", "Hello world");
    await createSamplePrompt("goodbye", "Goodbye world");
    const exporter = new PromptpackExporter();
    const outputPath = join(OUTPUT_DIR, "test.promptpack");
    const manifest = await exporter.exportAll(PROMPTS_DIR, outputPath);
    expect(manifest.totalPrompts).toBe(2);
    expect(manifest.version).toBe(PORTABILITY_MANIFEST_VERSION);
    expect(manifest.checksum).toBeTruthy();
  });

  it("includes versions when available", async () => {
    await createSamplePrompt("codegen", "Write code");
    await createVersion("codegen", 1, "v1 content");
    await createVersion("codegen", 2, "v2 content");
    const exporter = new PromptpackExporter();
    const outputPath = join(OUTPUT_DIR, "versions.promptpack");
    const manifest = await exporter.exportAll(PROMPTS_DIR, outputPath);
    const entry = manifest.entries.find((e) => e.filename === "codegen.prompt");
    expect(entry).toBeDefined();
    expect(entry!.versions.length).toBe(2);
    expect(manifest.totalVersions).toBe(2);
  });

  it("includes license attachments", async () => {
    await createSamplePrompt("licensed", "Licensed content");
    await createLicense("licensed");
    const exporter = new PromptpackExporter();
    const outputPath = join(OUTPUT_DIR, "licenses.promptpack");
    const manifest = await exporter.exportAll(PROMPTS_DIR, outputPath);
    const entry = manifest.entries.find((e) => e.filename === "licensed.prompt");
    expect(entry).toBeDefined();
    expect(entry!.license).toBeDefined();
    expect(entry!.license!.licenseName).toBe("MIT");
    expect(manifest.totalLicenses).toBe(1);
  });

  it("includes curation ratings", async () => {
    await createSamplePrompt("curated", "Curated content");
    await createCuration("curated", "Curator1", 4);
    await createCuration("curated", "Curator2", 5);
    const exporter = new PromptpackExporter();
    const outputPath = join(OUTPUT_DIR, "curations.promptpack");
    const manifest = await exporter.exportAll(PROMPTS_DIR, outputPath);
    const entry = manifest.entries.find((e) => e.filename === "curated.prompt");
    expect(entry).toBeDefined();
    expect(entry!.curations.length).toBe(2);
    expect(manifest.totalCurations).toBe(2);
  });

  it("computes consistent checksums", () => {
    const exporter = new PromptpackExporter();
    const cksum1 = exporter.computeChecksum("hello");
    const cksum2 = exporter.computeChecksum("hello");
    expect(cksum1).toBe(cksum2);
    expect(exporter.computeChecksum("hello")).not.toBe(exporter.computeChecksum("world"));
  });

  it("excludes versions when configured", async () => {
    await createSamplePrompt("noversion", "No versions");
    await createVersion("noversion", 1, "v1");
    const exporter = new PromptpackExporter({ includeVersions: false });
    const outputPath = join(OUTPUT_DIR, "noversion.promptpack");
    const manifest = await exporter.exportAll(PROMPTS_DIR, outputPath);
    const entry = manifest.entries.find((e) => e.filename === "noversion.prompt");
    expect(entry!.versions.length).toBe(0);
    expect(manifest.totalVersions).toBe(0);
  });
});

function computeManifestChecksum(m: PortabilityManifest): string {
  const { checksum: _, ...rest } = m;
  return require("crypto").createHash("sha256")
    .update(JSON.stringify(rest), "utf8")
    .digest("hex");
}

describe("PromptpackVerifier", () => {
  it("verifies a valid archive", async () => {
    await createSamplePrompt("verify-me", "Verify this");
    const exporter = new PromptpackExporter();
    const outputPath = join(OUTPUT_DIR, "verify.promptpack");
    await exporter.exportAll(PROMPTS_DIR, outputPath);

    const verifier = new PromptpackVerifier();
    const result = await verifier.verify(outputPath + ".gz");
    expect(result.verified).toBe(true);
    expect(result.checksumValid).toBe(true);
    expect(result.entriesValid).toBe(1);
    expect(result.entriesFailed).toBe(0);
  });

  it("detects manifest checksum corruption", async () => {
    const manifest: PortabilityManifest = {
      version: PORTABILITY_MANIFEST_VERSION,
      exportedAt: Date.now(),
      exportedBy: "test",
      source: "/tmp",
      totalPrompts: 0,
      totalVersions: 0,
      totalLicenses: 0,
      totalCurations: 0,
      entries: [],
      checksum: "invalid",
    };
    const verifier = new PromptpackVerifier();
    expect(verifier.verifyManifestChecksum(manifest)).toBe(false);

    manifest.checksum = computeManifestChecksum(manifest);
    expect(verifier.verifyManifestChecksum(manifest)).toBe(true);

    manifest.checksum = "corrupted";
    expect(verifier.verifyManifestChecksum(manifest)).toBe(false);
  });

  it("verifies manifest checksum correctly", () => {
    const verifier = new PromptpackVerifier();
    const manifest: PortabilityManifest = {
      version: PORTABILITY_MANIFEST_VERSION,
      exportedAt: Date.now(),
      exportedBy: "test",
      source: "/tmp",
      totalPrompts: 0,
      totalVersions: 0,
      totalLicenses: 0,
      totalCurations: 0,
      entries: [],
      checksum: "",
    };
    manifest.checksum = computeManifestChecksum(manifest);
    expect(verifier.verifyManifestChecksum(manifest)).toBe(true);

    manifest.checksum = "tampered";
    expect(verifier.verifyManifestChecksum(manifest)).toBe(false);
  });

  it("detects CID mismatch", async () => {
    await createSamplePrompt("cid-test", "Original content");
    const exporter = new PromptpackExporter();
    const outputPath = join(OUTPUT_DIR, "cid.promptpack");
    await exporter.exportAll(PROMPTS_DIR, outputPath);

    const verifier = new PromptpackVerifier();
    const result = await verifier.verify(outputPath + ".gz");
    expect(result.verified).toBe(true);
    expect(result.cidMismatches.length).toBe(0);
  });
});

describe("CrossProtocolImporter", () => {
  it("imports PromptBase CSV format", async () => {
    const csvContent = `title,prompt,category,tags
"Write a poem","Write a haiku about spring","creative","poetry,haiku"
"Code review","Review this Rust code","code","rust,review"`;
    const csvPath = join(TEST_DIR, "promptbase.csv");
    await writeFile(csvPath, csvContent, "utf8");

    const importer = new CrossProtocolImporter();
    const result = await importer.import(csvPath, "promptbase-csv");
    expect(result.format).toBe("promptbase-csv");
    expect(result.totalImported).toBe(2);
    expect(result.entries[0].filename).toBe("write_a_poem.prompt");
    expect(result.entries[0].promptText).toBe("Write a haiku about spring");
    expect(result.entries[1].promptText).toBe("Review this Rust code");
  });

  it("imports FlowGPT JSON format", async () => {
    const jsonContent = JSON.stringify([
      {
        title: "GPT Assistant",
        prompt: "You are a helpful assistant",
        category: "general",
        tags: ["assistant", "help"],
        id: "flowgpt_001",
      },
      {
        title: "Code Helper",
        prompt: "Write a Python function",
        category: "code",
        tags: ["python"],
      },
    ]);
    const jsonPath = join(TEST_DIR, "flowgpt.json");
    await writeFile(jsonPath, jsonContent, "utf8");

    const importer = new CrossProtocolImporter();
    const result = await importer.import(jsonPath, "flowgpt-json");
    expect(result.format).toBe("flowgpt-json");
    expect(result.totalImported).toBe(2);
    expect(result.entries[0].promptText).toBe("You are a helpful assistant");
    expect(result.entries[1].promptText).toBe("Write a Python function");
  });

  it("imports generic JSON format", async () => {
    const jsonContent = JSON.stringify({
      prompts: [
        { name: "prompt1", text: "First prompt" },
        { name: "prompt2", text: "Second prompt" },
      ],
    });
    const jsonPath = join(TEST_DIR, "generic.json");
    await writeFile(jsonPath, jsonContent, "utf8");

    const importer = new CrossProtocolImporter();
    const result = await importer.import(jsonPath, "generic-json");
    expect(result.totalImported).toBe(2);
    expect(result.entries[0].promptText).toBe("First prompt");
    expect(result.entries[1].promptText).toBe("Second prompt");
  });

  it("imports from a directory of prompt files", async () => {
    await createSamplePrompt("dir1", "Content 1");
    await createSamplePrompt("dir2", "Content 2");
    const importer = new CrossProtocolImporter();
    const result = await importer.import(PROMPTS_DIR);
    expect(result.totalImported).toBe(2);
  });

  it("detects format from filename extension", async () => {
    const csvPath = join(TEST_DIR, "detect.csv");
    await writeFile(csvPath, "title,prompt\nTest,Hello", "utf8");
    const importer = new CrossProtocolImporter();
    const result = await importer.import(csvPath);
    expect(result.format).toBe("promptbase-csv");
  });

  it("handles empty CSV", async () => {
    const csvPath = join(TEST_DIR, "empty.csv");
    await writeFile(csvPath, "", "utf8");
    const importer = new CrossProtocolImporter();
    const result = await importer.import(csvPath);
    expect(result.totalImported).toBe(0);
  });

  it("handles malformed JSON", async () => {
    const jsonPath = join(TEST_DIR, "bad.json");
    await writeFile(jsonPath, "not json", "utf8");
    const importer = new CrossProtocolImporter();
    const result = await importer.import(jsonPath);
    expect(result.totalErrors).toBeGreaterThan(0);
  });
});

describe("DifferentWalletRestorer", () => {
  it("restores prompts with new authority", async () => {
    await createSamplePrompt("transfer", "Transfer this prompt");
    const exporter = new PromptpackExporter();
    const archivePath = join(OUTPUT_DIR, "transfer.promptpack");
    await exporter.exportAll(PROMPTS_DIR, archivePath);

    const restorer = new DifferentWalletRestorer();
    const newWallet = "NewWalletAddress123";
    const result = await restorer.restore(archivePath + ".gz", RESTORE_DIR, newWallet);

    expect(result.totalImported).toBe(1);
    expect(result.totalErrors).toBe(0);
    expect(result.verification).toBeDefined();
    expect(result.verification!.verified).toBe(true);

    const restoredContent = await readFile(join(RESTORE_DIR, "transfer.prompt"), "utf8");
    expect(restoredContent).toBe("Transfer this prompt");

    const restoredMeta = JSON.parse(
      await readFile(join(RESTORE_DIR, "transfer.meta.json"), "utf8"),
    );
    expect(restoredMeta.author).toBe(newWallet);
    expect(restoredMeta.imported_by).toBe(newWallet);
  });

  it("skips existing files when overwriteExisting is false", async () => {
    await createSamplePrompt("skip", "Original");
    const exporter = new PromptpackExporter();
    const archivePath = join(OUTPUT_DIR, "skip.promptpack");
    await exporter.exportAll(PROMPTS_DIR, archivePath);

    await writeFile(join(RESTORE_DIR, "skip.prompt"), "Existing file", "utf8");

    const restorer = new DifferentWalletRestorer();
    const result = await restorer.restore(archivePath + ".gz", RESTORE_DIR, "NewWallet", {
      overwriteExisting: false,
    });

    const content = await readFile(join(RESTORE_DIR, "skip.prompt"), "utf8");
    expect(content).toBe("Existing file");
  });

  it("overwrites existing files when configured", async () => {
    await createSamplePrompt("overwrite", "New content");
    const exporter = new PromptpackExporter();
    const archivePath = join(OUTPUT_DIR, "overwrite.promptpack");
    await exporter.exportAll(PROMPTS_DIR, archivePath);

    await writeFile(join(RESTORE_DIR, "overwrite.prompt"), "Old content", "utf8");

    const restorer = new DifferentWalletRestorer();
    const result = await restorer.restore(archivePath + ".gz", RESTORE_DIR, "NewWallet", {
      overwriteExisting: true,
    });

    const content = await readFile(join(RESTORE_DIR, "overwrite.prompt"), "utf8");
    expect(content).toBe("New content");
  });

  it("preserves license attachments when not stripped", async () => {
    await createSamplePrompt("licensed-restore", "Licensed");
    await createLicense("licensed-restore");
    const exporter = new PromptpackExporter();
    const archivePath = join(OUTPUT_DIR, "licensed-restore.promptpack");
    await exporter.exportAll(PROMPTS_DIR, archivePath);

    const restorer = new DifferentWalletRestorer();
    const result = await restorer.restore(archivePath + ".gz", RESTORE_DIR, "NewWallet", {
      stripLicenses: false,
    });

    const licDir = join(RESTORE_DIR, ".licenses");
    expect(existsSync(licDir)).toBe(true);
  });
});

describe("Integration - Full Portability Cycle", () => {
  it("exports and verifies a complete prompt collection", async () => {
    await createSamplePrompt("integration", "Integration test");
    await createVersion("integration", 1, "v1");
    await createVersion("integration", 2, "v2");
    await createLicense("integration");
    await createCuration("integration", "Curator1", 5);

    const exporter = new PromptpackExporter();
    const archivePath = join(OUTPUT_DIR, "full.promptpack");
    const manifest = await exporter.exportAll(PROMPTS_DIR, archivePath);
    expect(manifest.totalPrompts).toBe(1);
    expect(manifest.totalVersions).toBe(2);
    expect(manifest.totalLicenses).toBe(1);
    expect(manifest.totalCurations).toBe(1);

    const verifier = new PromptpackVerifier();
    const verification = await verifier.verify(archivePath + ".gz");
    expect(verification.verified).toBe(true);
    expect(verification.entriesValid).toBe(1);
    expect(verification.entriesFailed).toBe(0);

    const restorer = new DifferentWalletRestorer();
    const restoreResult = await restorer.restore(
      archivePath + ".gz",
      RESTORE_DIR,
      "NewAuthority",
    );
    expect(restoreResult.totalImported).toBe(1);

    const restored = await readFile(join(RESTORE_DIR, "integration.prompt"), "utf8");
    expect(restored).toBe("Integration test");
  });
});
