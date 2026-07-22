import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync } from "fs";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { PromptFs } from "../src/promptfs";
import { computeCid } from "../src/prompt-file";

describe("PromptFs", () => {
  async function createTempDir(): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), "promptfs-test-"));
    return dir;
  }

  it("can mount and unmount", async () => {
    const dir = await createTempDir();
    const fs = new PromptFs(dir);
    expect(fs.mounted).toBe(false);

    await fs.mount();
    expect(fs.mounted).toBe(true);
    expect(existsSync(dir)).toBe(true);

    await fs.unmount();
    expect(fs.mounted).toBe(false);
  });

  it("creates sample structure on init", async () => {
    const dir = await createTempDir();
    const fs = new PromptFs(dir);

    await fs.mount(undefined, undefined, { createSampleOnInit: true });
    const tree = await fs.getTree();

    expect(tree.length).toBeGreaterThan(0);
    const promptFiles = tree.filter((e) => e.isPrompt);
    expect(promptFiles.length).toBeGreaterThanOrEqual(5);

    await fs.unmount();
  });

  it("can write and read prompts", async () => {
    const dir = await createTempDir();
    const fs = new PromptFs(dir);
    await fs.mount();

    const pf = await fs.writePrompt("test.prompt", "hello world", {
      name: "Test",
      category: "code",
    });

    expect(pf.cid).toBe(computeCid("hello world"));
    expect(pf.metadata.name).toBe("Test");

    const read = await fs.readPrompt("test.prompt");
    expect(read.promptText).toBe("hello world");
    expect(read.cid).toBe(pf.cid);

    await fs.unmount();
  });

  it("can list directory contents", async () => {
    const dir = await createTempDir();
    const fs = new PromptFs(dir);
    await fs.mount(undefined, undefined, { createSampleOnInit: true });

    const entries = await fs.listDirectory();
    expect(entries.length).toBeGreaterThan(0);

    const dirs = entries.filter((e) => e.isDirectory);
    expect(dirs.length).toBeGreaterThan(0);

    await fs.unmount();
  });

  it("can create and delete entries", async () => {
    const dir = await createTempDir();
    const fs = new PromptFs(dir);
    await fs.mount();

    await fs.writePrompt("test.prompt", "content");
    const entries = await fs.listDirectory();
    const promptFiles = entries.filter((e) => e.isPrompt);
    expect(promptFiles.length).toBe(1);

    await fs.deleteEntry("test.prompt");
    const remaining = await fs.listDirectory();
    expect(remaining.filter((e) => e.isPrompt).length).toBe(0);

    await fs.unmount();
  });

  it("can create directories", async () => {
    const dir = await createTempDir();
    const fs = new PromptFs(dir);
    await fs.mount();

    await fs.createDirectory("subdir");
    const entries = await fs.listDirectory();
    expect(entries.some((e) => e.isDirectory && e.name === "subdir")).toBe(true);

    await fs.unmount();
  });
});
