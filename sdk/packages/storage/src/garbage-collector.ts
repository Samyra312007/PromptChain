import { readdir, stat, unlink, rmdir } from "fs/promises";
import { join } from "path";
import { META_FILE_SUFFIX, PROMPT_FILE_EXT } from "./prompt-file";

export interface GcOptions {
  dryRun?: boolean;
  removeOrphans?: boolean;
  removeEmptyDirs?: boolean;
}

export interface GcResult {
  removed: number;
  orphanedMetaRemoved: number;
  emptyDirsRemoved: number;
  errors: string[];
  dryRun: boolean;
}

export async function garbageCollect(
  rootDir: string,
  options: GcOptions = {},
): Promise<GcResult> {
  const result: GcResult = {
    removed: 0,
    orphanedMetaRemoved: 0,
    emptyDirsRemoved: 0,
    errors: [],
    dryRun: options.dryRun ?? false,
  };

  if (options.removeOrphans) {
    result.orphanedMetaRemoved = await removeOrphanedMetaFiles(rootDir, options.dryRun ?? false, result.errors);
  }

  if (options.removeEmptyDirs) {
    result.emptyDirsRemoved = await removeEmptyDirectories(rootDir, options.dryRun ?? false, result.errors);
  }

  return result;
}

async function removeOrphanedMetaFiles(
  rootDir: string,
  dryRun: boolean,
  errors: string[],
): Promise<number> {
  let count = 0;
  const entries = await readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      count += await removeOrphanedMetaFiles(fullPath, dryRun, errors);
      continue;
    }

    if (entry.name.endsWith(META_FILE_SUFFIX)) {
      const promptFileName = entry.name.replace(META_FILE_SUFFIX, PROMPT_FILE_EXT);
      const promptPath = join(rootDir, promptFileName);

      try {
        await stat(promptPath);
      } catch {
        if (!dryRun) {
          try {
            await unlink(fullPath);
          } catch (err) {
            errors.push(`Failed to remove orphaned meta ${fullPath}: ${err}`);
            continue;
          }
        }
        count++;
      }
    }
  }

  return count;
}

async function removeEmptyDirectories(
  rootDir: string,
  dryRun: boolean,
  errors: string[],
): Promise<number> {
  let count = 0;
  const entries = await readdir(rootDir, { withFileTypes: true });
  let hasContent = false;

  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name);

    if (entry.name.startsWith(".")) {
      hasContent = true;
      continue;
    }

    if (entry.isDirectory()) {
      const subCount = await removeEmptyDirectories(fullPath, dryRun, errors);
      count += subCount;

      try {
        const remaining = await readdir(fullPath);
        if (remaining.filter((e) => !e.startsWith(".")).length === 0) {
          if (!dryRun) {
            try {
              await rmdir(fullPath);
            } catch (err) {
              errors.push(`Failed to remove empty dir ${fullPath}: ${err}`);
              continue;
            }
          }
          count++;
        } else {
          hasContent = true;
        }
      } catch {
        hasContent = true;
      }
    } else {
      hasContent = true;
    }
  }

  return count;
}


