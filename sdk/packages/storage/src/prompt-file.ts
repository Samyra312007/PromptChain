import { createHash } from "crypto";
import { readFile, writeFile, readdir, mkdir, stat, unlink } from "fs/promises";
import { join, basename, extname, dirname } from "path";
import type { PromptMetadata } from "@promptchain/schema";

export const PROMPT_FILE_EXT = ".prompt";
export const META_FILE_SUFFIX = ".meta.json";

export interface PromptFile {
  filename: string;
  directory: string;
  promptText: string;
  metadata: PromptMetadata;
  cid: string;
}

export function computeCid(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function promptFilePath(directory: string, name: string): string {
  const base = name.endsWith(PROMPT_FILE_EXT) ? name : name + PROMPT_FILE_EXT;
  return join(directory, base);
}

export function metaFilePath(promptPath: string): string {
  const dir = dirname(promptPath);
  const base = basename(promptPath, PROMPT_FILE_EXT);
  return join(dir, base + META_FILE_SUFFIX);
}

export function isValidPromptFile(name: string): boolean {
  return name.endsWith(PROMPT_FILE_EXT) && !name.startsWith(".");
}

export function isValidMetaFile(name: string): boolean {
  return name.endsWith(META_FILE_SUFFIX);
}

export async function readPromptFile(filePath: string): Promise<PromptFile> {
  const promptText = await readFile(filePath, "utf8");
  const metaPath = metaFilePath(filePath);
  let metadata: PromptMetadata;

  try {
    const metaContent = await readFile(metaPath, "utf8");
    metadata = JSON.parse(metaContent);
  } catch {
    metadata = createDefaultMetadata(basename(filePath, PROMPT_FILE_EXT));
  }

  return {
    filename: basename(filePath),
    directory: dirname(filePath),
    promptText,
    metadata,
    cid: computeCid(promptText),
  };
}

export async function writePromptFile(
  directory: string,
  name: string,
  promptText: string,
  metadata: PromptMetadata,
): Promise<PromptFile> {
  const promptPath = promptFilePath(directory, name);
  await mkdir(dirname(promptPath), { recursive: true });
  await writeFile(promptPath, promptText, "utf8");

  const metaPath = metaFilePath(promptPath);
  await writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf8");

  return {
    filename: basename(promptPath),
    directory,
    promptText,
    metadata,
    cid: computeCid(promptText),
  };
}

export async function listPromptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  const promptFiles = entries.filter(isValidPromptFile);
  return promptFiles.map((f) => join(directory, f));
}

export async function deletePromptFile(filePath: string): Promise<void> {
  await unlink(filePath);
  const metaPath = metaFilePath(filePath);
  try {
    await unlink(metaPath);
  } catch {
    // meta file is optional
  }
}

export function createDefaultMetadata(name: string): PromptMetadata {
  const now = new Date().toISOString();
  return {
    name,
    description: "",
    prompt_text: "",
    category: "general",
    tags: [],
    task_description: "",
    created_at: now,
    updated_at: now,
    language: "en",
  };
}

export async function scanDirectoryTree(
  rootDir: string,
): Promise<PromptFile[]> {
  const results: PromptFile[] = [];
  const entries = await readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      const nested = await scanDirectoryTree(fullPath);
      results.push(...nested);
    } else if (isValidPromptFile(entry.name)) {
      try {
        const pf = await readPromptFile(fullPath);
        results.push(pf);
      } catch {
        // skip unreadable files
      }
    }
  }

  return results;
}
