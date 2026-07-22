import { describe, it, expect } from "vitest";
import { computeCid, createDefaultMetadata, isValidPromptFile, isValidMetaFile, PROMPT_FILE_EXT, META_FILE_SUFFIX } from "../src/prompt-file";

describe("PromptFile", () => {
  it("computeCid returns deterministic hashes", () => {
    const a = computeCid("hello world");
    const b = computeCid("hello world");
    expect(a).toEqual(b);
  });

  it("computeCid returns different hashes for different inputs", () => {
    const a = computeCid("hello");
    const b = computeCid("world");
    expect(a).not.toEqual(b);
  });

  it("computeCid returns 64-char hex string", () => {
    const hash = computeCid("test");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("isValidPromptFile recognizes .prompt files", () => {
    expect(isValidPromptFile("test.prompt")).toBe(true);
    expect(isValidPromptFile("test.json")).toBe(false);
    expect(isValidPromptFile(".hidden.prompt")).toBe(false);
  });

  it("isValidMetaFile recognizes .meta.json files", () => {
    expect(isValidMetaFile("test.meta.json")).toBe(true);
    expect(isValidMetaFile("test.prompt")).toBe(false);
  });

  it("createDefaultMetadata creates valid metadata", () => {
    const meta = createDefaultMetadata("test-prompt");
    expect(meta.name).toBe("test-prompt");
    expect(meta.category).toBe("general");
    expect(meta.tags).toEqual([]);
    expect(meta.created_at).toBeDefined();
    expect(meta.updated_at).toBeDefined();
  });
});
