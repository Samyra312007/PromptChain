import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { StorageManager } from "../src/storage-manager";
import { LocalStorageProvider } from "../src/providers/local";
import { CompositeStorageProvider } from "../src/providers/composite";
import { rmSync } from "fs";

const TEST_DIR = "/tmp/promptchain-test-storage";

afterAll(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

describe("StorageManager", () => {
  let manager: StorageManager;

  beforeEach(() => {
    manager = new StorageManager();
    manager.register(new LocalStorageProvider({ basePath: `${TEST_DIR}/local` }), { priority: 0, enabled: true });
  });

  it("registers a provider", () => {
    expect(manager.getProvider("local")).toBeDefined();
    expect(manager.getAvailableProviders()).toHaveLength(1);
  });

  it("negotiates fastest available provider", async () => {
    await manager.initializeAll();
    const negotiation = await manager.negotiate();
    expect(negotiation.selected).toBe("local");
    expect(negotiation.reason).toContain("latency");
  });

  it("stores and retrieves data", async () => {
    await manager.initializeAll();
    const result = await manager.store("hello world", "text/plain", ["local"]);
    expect(result.successCount).toBe(1);
    expect(result.cid).toBeTruthy();
    const data = await manager.retrieve(result.cid, ["local"]);
    expect(data.toString("utf8")).toBe("hello world");
  });

  it("checks existence", async () => {
    await manager.initializeAll();
    const result = await manager.store("exists check", "text/plain", ["local"]);
    const exists = await manager.exists(result.cid);
    expect(exists).toBe(true);
  });

  it("checkHealth returns results for all providers", async () => {
    const health = await manager.checkHealth();
    expect(health.length).toBe(1);
    expect(health[0].name).toBe("local");
    expect(health[0].available).toBe(true);
  });

  it("creates composite provider", () => {
    const local = new LocalStorageProvider({ basePath: `${TEST_DIR}/composite-inner` });
    const composite = manager.createComposite([local], 1);
    expect(composite).toBeInstanceOf(CompositeStorageProvider);
    expect(composite.innerProviders).toHaveLength(1);
  });

  it("prefers configured providers", async () => {
    await manager.initializeAll();
    const result = await manager.store("preferred test", "text/plain", ["local"]);
    expect(result.results[0].provider).toBe("local");
  });

  it("falls back to local when no providers configured", async () => {
    const emptyManager = new StorageManager();
    const negotiation = await emptyManager.negotiate();
    expect(negotiation.selected).toBe("local");
  });
});

describe("LocalStorageProvider", () => {
  it("stores and retrieves data", async () => {
    const local = new LocalStorageProvider({ basePath: `${TEST_DIR}/local2` });
    await local.initialize();
    const stored = await local.store("test content");
    expect(stored.cid).toBeTruthy();
    expect(stored.provider).toBe("local");
    const data = await local.retrieve(stored.cid);
    expect(data.toString("utf8")).toBe("test content");
  });

  it("checks existence", async () => {
    const local = new LocalStorageProvider({ basePath: `${TEST_DIR}/local3` });
    await local.initialize();
    const stored = await local.store("exists test");
    expect(await local.exists(stored.cid)).toBe(true);
    expect(await local.exists("nonexistent")).toBe(false);
  });

  it("deletes data", async () => {
    const local = new LocalStorageProvider({ basePath: `${TEST_DIR}/local4` });
    await local.initialize();
    const stored = await local.store("delete test");
    expect(await local.exists(stored.cid)).toBe(true);
    await local.delete(stored.cid);
    expect(await local.exists(stored.cid)).toBe(false);
  });

  it("reports health", async () => {
    const local = new LocalStorageProvider({ basePath: `${TEST_DIR}/local5` });
    const health = await local.health();
    expect(health.available).toBe(false);
    await local.initialize();
    const health2 = await local.health();
    expect(health2.available).toBe(true);
  });
});

describe("CompositeStorageProvider", () => {
  it("stores to all providers and requires majority", async () => {
    const providers = [
      new LocalStorageProvider({ basePath: `${TEST_DIR}/comp-1` }),
      new LocalStorageProvider({ basePath: `${TEST_DIR}/comp-2` }),
      new LocalStorageProvider({ basePath: `${TEST_DIR}/comp-3` }),
    ];
    const composite = new CompositeStorageProvider(providers, { minSurvive: 2 });
    await composite.initialize();
    const stored = await composite.store("composite data");
    expect(stored.cid).toBeTruthy();
    const data = await composite.retrieve(stored.cid);
    expect(data.toString("utf8")).toBe("composite data");
  });

  it("retrieves from first available provider", async () => {
    const local = new LocalStorageProvider({ basePath: `${TEST_DIR}/comp-ret` });
    await local.initialize();
    const stored = await local.store("retrieve test");
    const composite = new CompositeStorageProvider([local], { minSurvive: 1 });
    const data = await composite.retrieve(stored.cid);
    expect(data.toString("utf8")).toBe("retrieve test");
  });

  it("fails if insufficient providers survive", async () => {
    const providers = [new LocalStorageProvider({ basePath: `${TEST_DIR}/comp-fail` })];
    const composite = new CompositeStorageProvider(providers, { minSurvive: 2 });
    await composite.initialize();
    await expect(composite.store("fail test")).rejects.toThrow();
  });

  it("checks health across all providers", async () => {
    const local = new LocalStorageProvider({ basePath: `${TEST_DIR}/comp-health` });
    await local.initialize();
    const composite = new CompositeStorageProvider([local], { minSurvive: 1 });
    const health = await composite.health();
    expect(health.available).toBe(true);
  });
});
