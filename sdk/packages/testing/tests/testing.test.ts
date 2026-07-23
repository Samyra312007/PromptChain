import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "fs";
import { rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";

import {
  PromptFsFuzzer,
  StateMachineHarness,
  DeterministicSimulation,
  RegressionSuite,
  SnapshotManager,
  PromptSnapshotComparer,
  ActionType,
} from "../src/index";

// ─────────────────────────────────────────────
// PromptFS Fuzzer Tests
// ─────────────────────────────────────────────

describe("PromptFsFuzzer", () => {
  let tempDir: string;
  let fuzzer: PromptFsFuzzer;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "promptchain-fuzz-"));
    fuzzer = new PromptFsFuzzer({ seed: 42, casesPerCategory: 5, maxStringLength: 100 });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("fuzzMalformedCids produces results", async () => {
    const results = await fuzzer.fuzzMalformedCids(tempDir);
    expect(results.length).toBeGreaterThan(0);
  });

  it("fuzzMalformedCids has expectedRejection field", async () => {
    const results = await fuzzer.fuzzMalformedCids(tempDir);
    for (const r of results) {
      expect(typeof r.expectedRejection).toBe("boolean");
      expect(typeof r.rejectedAsExpected).toBe("boolean");
      expect(r.cid).toBeDefined();
    }
  });

  it("fuzzMalformedMetadata produces results", async () => {
    const results = await fuzzer.fuzzMalformedMetadata(tempDir);
    expect(results.length).toBeGreaterThan(0);
  });

  it("fuzzUnicodeEdgeCases produces results", async () => {
    const results = await fuzzer.fuzzUnicodeEdgeCases(tempDir);
    expect(results.length).toBeGreaterThan(0);
  });

  it("runAll runs all fuzz categories", async () => {
    const results = await fuzzer.runAll(tempDir);
    expect(results.length).toBeGreaterThan(0);
  });

  it("summary provides stats", async () => {
    await fuzzer.runAll(tempDir);
    const summary = fuzzer.summary();
    expect(summary.total).toBeGreaterThan(0);
    expect(typeof summary.errors).toBe("number");
    expect(typeof summary.warnings).toBe("number");
    expect(typeof summary.infos).toBe("number");
    expect(typeof summary.expectedRejections).toBe("number");
    expect(typeof summary.unexpectedAccepts).toBe("number");
  });

  it("getResults returns recorded results", async () => {
    await fuzzer.runAll(tempDir);
    const summary = fuzzer.summary();
    const results = fuzzer.getResults();
    expect(results.length).toBe(summary.total);
  });

  it("non-rejection scenarios are recorded", async () => {
    await fuzzer.fuzzUnicodeEdgeCases(tempDir);
    const results = fuzzer.getResults();
    const nonRejected = results.filter((r) => !r.expectedRejection);
    expect(nonRejected.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// State Machine Harness Tests
// ─────────────────────────────────────────────

describe("StateMachineHarness", () => {
  let sm: StateMachineHarness;

  beforeEach(() => {
    sm = new StateMachineHarness({ minActors: 3, maxActors: 10, maxSteps: 100, seed: 42 });
  });

  it("initializes with minimum actors", () => {
    expect(sm.getActors().length).toBe(3);
    expect(sm.getStepNumber()).toBe(0);
  });

  it("executePublish creates a prompt and returns step", () => {
    const step = sm.executePublish();
    expect(step.actionType).toBe(ActionType.Publish);
    expect(step.success).toBe(true);
    expect(sm.getPrompts().size).toBe(1);
  });

  it("executeCreateVersion returns failed step when no prompts", () => {
    const step = sm.executeCreateVersion();
    expect(step.success).toBe(false);
    expect(step.description).toContain("no active prompts");
  });

  it("executeCreateVersion succeeds after publish", () => {
    sm.executePublish();
    const step = sm.executeCreateVersion();
    expect(step.success).toBe(true);
    expect(step.actionType).toBe(ActionType.CreateVersion);
  });

  it("executeTransfer returns failed step when no prompts", () => {
    const step = sm.executeTransfer();
    expect(step.success).toBe(false);
  });

  it("executeSetLicense creates a license", () => {
    const step = sm.executeSetLicense();
    expect(step.success).toBe(true);
    expect(sm.getLicenses().size).toBe(1);
  });

  it("executeUsePrompt returns failed step when no prompts", () => {
    const step = sm.executeUsePrompt();
    expect(step.success).toBe(false);
  });

  it("executeUsePrompt succeeds after publish", () => {
    sm.executePublish();
    const step = sm.executeUsePrompt();
    expect(step.success).toBe(true);
    expect(step.details.totalUses).toBe(1);
  });

  it("runSimulation runs all actions", async () => {
    const history = await sm.runSimulation(50);
    expect(history.length).toBe(50);
    expect(sm.getHistory().length).toBe(50);
  });

  it("simulation includes all action types", async () => {
    await sm.runSimulation(200);
    const actionTypes = new Set(sm.getHistory().map((s) => s.actionType));
    expect(actionTypes.has(ActionType.Publish)).toBe(true);
    expect(actionTypes.has(ActionType.CreateVersion)).toBe(true);
    expect(actionTypes.has(ActionType.Transfer)).toBe(true);
    expect(actionTypes.has(ActionType.SetLicense)).toBe(true);
    expect(actionTypes.has(ActionType.UsePrompt)).toBe(true);
  });

  it("simulation has consistent history numbering", async () => {
    await sm.runSimulation(100);
    const history = sm.getHistory();
    expect(history.length).toBe(100);
    for (let i = 0; i < history.length; i++) {
      expect(history[i].stepNumber).toBe(i);
    }
  });

  it("runAllInvariants checks all invariants", () => {
    const results = sm.runAllInvariants();
    expect(results.length).toBe(5);
    for (const r of results) {
      expect(typeof r.passed).toBe("boolean");
    }
  });

  it("assertNoDuplicateCids passes on empty state", () => {
    expect(sm.assertInvariant("no duplicate CIDs")).toBe(true);
  });

  it("assertOwnershipChainVerifiable passes on empty state", () => {
    expect(sm.assertInvariant("ownership chain is verifiable")).toBe(true);
  });

  it("assertOriginalAuthorityNeverChanges passes", () => {
    sm.executePublish();
    const results = sm.runAllInvariants();
    const origAuth = results.find((r) => r.name === "original authority never changes");
    expect(origAuth).toBeDefined();
    expect(origAuth!.passed).toBe(true);
  });

  it("summary returns detailed stats", () => {
    sm.executePublish();
    sm.executeSetLicense();
    const summary = sm.summary();
    expect(summary.totalSteps).toBe(2);
    expect(summary.totalPrompts).toBe(1);
    expect(summary.totalLicenses).toBe(1);
    expect(summary.invariantsTotal).toBe(5);
  });

  it("saveLog captures messages", () => {
    sm.saveLog("test message");
    const log = sm.getLog();
    expect(log.length).toBe(1);
    expect(log[0]).toContain("test message");
  });

  it("addActor increases actor count", () => {
    const before = sm.getActors().length;
    sm.addActor();
    expect(sm.getActors().length).toBe(before + 1);
  });
});

// ─────────────────────────────────────────────
// Deterministic Simulation Tests
// ─────────────────────────────────────────────

describe("DeterministicSimulation", () => {
  it("initializes nodes correctly", () => {
    const sim = new DeterministicSimulation({
      nodeCount: 10,
      stepsPerNode: 10,
      seed: 42,
    });
    const nodes = sim.initialize();
    expect(nodes.length).toBe(10);
    for (const node of nodes) {
      expect(node.id).toBeTruthy();
      expect(typeof node.isDisconnected).toBe("boolean");
      expect(typeof node.rpcFailureRate).toBe("number");
    }
  });

  it("injectNetworkPartition disconnects some nodes", () => {
    const sim = new DeterministicSimulation({
      nodeCount: 10,
      partitionGroups: 2,
      seed: 42,
    });
    sim.initialize();
    sim.injectNetworkPartition(1.0);
    const someDisconnected = sim.getNodes().some((n) => n.isDisconnected);
    expect(someDisconnected).toBe(true);
  });

  it("healPartitions reconnects nodes", () => {
    const sim = new DeterministicSimulation({
      nodeCount: 10,
      partitionGroups: 1,
      seed: 42,
    });
    sim.initialize();
    sim.injectNetworkPartition(1.0);
    expect(sim.getNodes().some((n) => n.isDisconnected)).toBe(true);
    sim.healPartitions();
    expect(sim.getNodes().every((n) => !n.isDisconnected)).toBe(true);
  });

  it("run completes without error", async () => {
    const sim = new DeterministicSimulation({
      nodeCount: 5,
      stepsPerNode: 10,
      seed: 42,
    });
    const result = await sim.run();
    expect(result.totalActions).toBeGreaterThan(0);
    expect(result.config.nodeCount).toBe(5);
  });

  it("run produces perNodeStats", async () => {
    const sim = new DeterministicSimulation({
      nodeCount: 5,
      stepsPerNode: 10,
      seed: 42,
    });
    const result = await sim.run();
    expect(result.perNodeStats.length).toBe(5);
    for (const stat of result.perNodeStats) {
      expect(typeof stat.actionsExecuted).toBe("number");
      expect(typeof stat.nodeId).toBe("string");
    }
  });
});

// ─────────────────────────────────────────────
// Regression Suite Tests
// ─────────────────────────────────────────────

describe("RegressionSuite", () => {
  let suite: RegressionSuite;

  beforeEach(() => {
    suite = new RegressionSuite();
  });

  it("starts with no tests", () => {
    expect(suite.getTests().length).toBe(0);
  });

  it("register adds a test", () => {
    suite.register({
      id: "test-001",
      category: "kernel",
      description: "Publish with empty CID fails",
      dateReported: "2024-01-01",
      run: async () => ({ testId: "test-001", passed: true, durationMs: 0 }),
    });
    expect(suite.getTests().length).toBe(1);
  });

  it("registerBatch adds multiple tests", () => {
    suite.registerBatch([
      {
        id: "t1", category: "kernel", description: "d1", dateReported: "2024-01-01",
        run: async () => ({ testId: "t1", passed: true, durationMs: 0 }),
      },
      {
        id: "t2", category: "curation", description: "d2", dateReported: "2024-01-01",
        run: async () => ({ testId: "t2", passed: true, durationMs: 0 }),
      },
    ]);
    expect(suite.getTests().length).toBe(2);
  });

  it("runAll passes when all tests pass", async () => {
    suite.register({
      id: "t1", category: "kernel", description: "test", dateReported: "2024-01-01",
      run: async () => ({ testId: "t1", passed: true, durationMs: 10 }),
    });
    suite.register({
      id: "t2", category: "curation", description: "test", dateReported: "2024-01-01",
      run: async () => ({ testId: "t2", passed: true, durationMs: 10 }),
    });
    const result = await suite.runAll();
    expect(result.total).toBe(2);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it("runAll reports failures", async () => {
    suite.register({
      id: "t1", category: "kernel", description: "failing test", dateReported: "2024-01-01",
      run: async () => ({ testId: "t1", passed: false, error: "expected failure", durationMs: 5 }),
    });
    const result = await suite.runAll();
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(1);
  });

  it("createPublishRegressionTest creates a test", () => {
    const test = suite.createPublishRegressionTest(
      "reg-001", "Test description", "kernel", "2024-06-01", "GH-123",
      async () => true,
    );
    expect(test.id).toBe("reg-001");
    expect(test.category).toBe("kernel");
    expect(test.issueRef).toBe("GH-123");
  });

  it("regression test catches failures", async () => {
    const passTest = suite.createPublishRegressionTest(
      "pass", "passing", "kernel", "2024-01-01", undefined,
      async () => true,
    );
    const failTest = suite.createPublishRegressionTest(
      "fail", "failing", "kernel", "2024-01-01", undefined,
      async () => { throw new Error("simulated failure"); },
    );
    suite.register(passTest);
    suite.register(failTest);

    const result = await suite.runAll();
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
  });
});

// ─────────────────────────────────────────────
// Snapshot Testing Tests
// ─────────────────────────────────────────────

describe("SnapshotManager", () => {
  let manager: SnapshotManager;

  beforeEach(() => {
    manager = new SnapshotManager();
  });

  it("startSnapshot creates a snapshot session", () => {
    const id = manager.startSnapshot("test snapshot");
    expect(id).toBeTruthy();
    expect(id.startsWith("snap_")).toBe(true);
  });

  it("recordEntry adds entries to current snapshot", () => {
    manager.startSnapshot("test");
    manager.recordEntry("key1", "value1");
    manager.recordEntry("key2", "value2");
  });

  it("commitSnapshot returns a completed snapshot", () => {
    manager.startSnapshot("test");
    manager.recordEntry("key", "value");
    const snap = manager.commitSnapshot();
    expect(snap.id).toBeTruthy();
    expect(snap.entries.length).toBe(1);
    expect(snap.rootHash).toBeTruthy();
    expect(snap.rootHash.length).toBe(64);
  });

  it("commitSnapshot throws without startSnapshot", () => {
    expect(() => manager.commitSnapshot()).toThrow("No active snapshot");
  });

  it("getSnapshot retrieves committed snapshot", () => {
    manager.startSnapshot("test");
    manager.recordEntry("k", "v");
    const committed = manager.commitSnapshot();
    const retrieved = manager.getSnapshot(committed.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(committed.id);
  });

  it("listSnapshots returns all snapshots in order", () => {
    manager.startSnapshot("first");
    manager.recordEntry("a", "1");
    manager.commitSnapshot();

    manager.startSnapshot("second");
    manager.recordEntry("b", "2");
    manager.commitSnapshot();

    const list = manager.listSnapshots();
    expect(list.length).toBe(2);
    expect(list[0].description).toBe("first");
    expect(list[1].description).toBe("second");
  });

  it("recordEntity stores typed entries", () => {
    manager.startSnapshot("entity test");
    manager.recordEntity("prompt", "prompt-1", { cid: "QmTest", authority: "wallet1" });
    const snap = manager.commitSnapshot();
    expect(snap.entries.length).toBe(1);
    expect(snap.entries[0].key).toBe("entity:prompt:prompt-1");
  });

  it("recordState stores state entries", () => {
    manager.startSnapshot("state test");
    manager.recordState("summary", { total: 42 });
    const snap = manager.commitSnapshot();
    expect(snap.entries[0].key).toBe("state:summary");
  });

  it("compareSnapshots detects identical snapshots", () => {
    manager.startSnapshot("s1");
    manager.recordEntry("k", "v");
    const s1 = manager.commitSnapshot();

    manager.startSnapshot("s2");
    manager.recordEntry("k", "v");
    const s2 = manager.commitSnapshot();

    const diff = manager.compareSnapshots(s1.id, s2.id);
    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(0);
    expect(diff.modified.length).toBe(0);
    expect(diff.unchanged).toBe(1);
  });

  it("compareSnapshots detects differences", () => {
    manager.startSnapshot("s1");
    manager.recordEntry("k", "v1");
    const s1 = manager.commitSnapshot();

    manager.startSnapshot("s2");
    manager.recordEntry("k", "v2");
    const s2 = manager.commitSnapshot();

    const diff = manager.compareSnapshots(s1.id, s2.id);
    expect(diff.modified.length).toBe(1);
    expect(diff.modified[0].key).toBe("k");
  });

  it("compareSnapshots detects added entries", () => {
    manager.startSnapshot("s1");
    manager.recordEntry("k", "v");
    const s1 = manager.commitSnapshot();

    manager.startSnapshot("s2");
    manager.recordEntry("k", "v");
    manager.recordEntry("k2", "v2");
    const s2 = manager.commitSnapshot();

    const diff = manager.compareSnapshots(s1.id, s2.id);
    expect(diff.added.length).toBe(1);
    expect(diff.added[0].key).toBe("k2");
  });

  it("compareSnapshots detects removed entries", () => {
    manager.startSnapshot("s1");
    manager.recordEntry("k", "v");
    manager.recordEntry("k2", "v2");
    const s1 = manager.commitSnapshot();

    manager.startSnapshot("s2");
    manager.recordEntry("k", "v");
    const s2 = manager.commitSnapshot();

    const diff = manager.compareSnapshots(s1.id, s2.id);
    expect(diff.removed.length).toBe(1);
    expect(diff.removed[0].key).toBe("k2");
  });

  it("assertSnapshotMatch returns match for identical snapshots", () => {
    manager.startSnapshot("s1");
    manager.recordEntry("k", "v");
    const s1 = manager.commitSnapshot();

    manager.startSnapshot("s2");
    manager.recordEntry("k", "v");
    const s2 = manager.commitSnapshot();

    const result = manager.assertSnapshotMatch(s1.id, s2.id);
    expect(result.match).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("assertSnapshotMatch reports mismatches", () => {
    manager.startSnapshot("s1");
    manager.recordEntry("k", "v1");
    const s1 = manager.commitSnapshot();

    manager.startSnapshot("s2");
    manager.recordEntry("k", "v2");
    const s2 = manager.commitSnapshot();

    const result = manager.assertSnapshotMatch(s1.id, s2.id);
    expect(result.match).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("verifySnapshotIntegrity passes for valid snapshot", () => {
    manager.startSnapshot("test");
    manager.recordEntry("k", "v");
    const snap = manager.commitSnapshot();
    const result = manager.verifySnapshotIntegrity(snap.id);
    expect(result.valid).toBe(true);
  });

  it("clear removes all snapshots", () => {
    manager.startSnapshot("t");
    manager.recordEntry("k", "v");
    manager.commitSnapshot();
    manager.clear();
    expect(manager.listSnapshots().length).toBe(0);
  });

  it("exportSnapshot returns snapshot data", () => {
    manager.startSnapshot("t");
    manager.recordEntry("k", "v");
    const snap = manager.commitSnapshot();
    const exported = manager.exportSnapshot(snap.id);
    expect(exported).toBeDefined();
    expect(exported!.id).toBe(snap.id);
  });

  it("importSnapshot loads external snapshot", () => {
    const entries = [{ key: "ext", value: "data", hash: "", timestamp: Date.now() }];
    entries[0].hash = createHash("sha256").update("data").digest("hex");
    const combined = createHash("sha256");
    combined.update(entries[0].hash);
    const rootHash = combined.digest("hex");

    const external = {
      id: "snap_external",
      description: "imported",
      createdAt: Date.now(),
      entries,
      rootHash,
      metadata: {},
    };

    manager.importSnapshot(external);
    expect(manager.listSnapshots().length).toBe(1);
  });
});

describe("PromptSnapshotComparer", () => {
  let manager: SnapshotManager;
  let comparer: PromptSnapshotComparer;

  beforeEach(() => {
    manager = new SnapshotManager();
    comparer = new PromptSnapshotComparer(manager);
  });

  it("capturePromptState creates a snapshot", async () => {
    const snap = await comparer.capturePromptState(
      "test state",
      [{ id: "p1", authority: "wallet1", cid: "QmTest", totalVersions: 1, totalUses: 0, licenseId: null }],
      [{ id: "l1", name: "MIT", authority: "wallet1", royaltyBasisPoints: 0 }],
      [{ promptId: "p1", versionNumber: 0, cid: "QmTest", author: "wallet1" }],
    );
    expect(snap.entries.length).toBeGreaterThan(0);
  });

  it("comparePromptStates with identical states returns match", async () => {
    const prompts = [{ id: "p1", authority: "wallet1", cid: "QmTest", totalVersions: 1, totalUses: 0, licenseId: null }];
    const licenses = [{ id: "l1", name: "MIT", authority: "wallet1", royaltyBasisPoints: 0 }];
    const versions = [{ promptId: "p1", versionNumber: 0, cid: "QmTest", author: "wallet1" }];

    const s1 = await comparer.capturePromptState("first", prompts, licenses, versions);
    const s2 = await comparer.capturePromptState("second", prompts, licenses, versions);

    const result = comparer.comparePromptStates(s1.id, s2.id);
    expect(result.match).toBe(true);
  });

  it("comparePromptStates allows new prompts", async () => {
    const prompts1 = [{ id: "p1", authority: "wallet1", cid: "QmTest", totalVersions: 1, totalUses: 0, licenseId: null }];
    const prompts2 = [
      { id: "p1", authority: "wallet1", cid: "QmTest", totalVersions: 1, totalUses: 0, licenseId: null },
      { id: "p2", authority: "wallet2", cid: "QmTest2", totalVersions: 1, totalUses: 0, licenseId: null },
    ];

    const s1 = await comparer.capturePromptState("first", prompts1, [], []);
    const s2 = await comparer.capturePromptState("second", prompts2, [], []);

    const result = comparer.comparePromptStates(s1.id, s2.id, true, true);
    expect(result.match).toBe(true);
  });
});
