import { createHash } from "crypto";

export interface SnapshotEntry {
  key: string;
  value: string;
  hash: string;
  timestamp: number;
}

export interface Snapshot {
  id: string;
  description: string;
  createdAt: number;
  entries: SnapshotEntry[];
  rootHash: string;
  metadata: Record<string, any>;
}

export interface SnapshotDiff {
  added: SnapshotEntry[];
  removed: SnapshotEntry[];
  modified: Array<{ key: string; oldHash: string; newHash: string; oldValue: string; newValue: string }>;
  unchanged: number;
}

export interface SnapshotConfig {
  snapshotDir?: string;
  compareOnRead: boolean;
  strictMode: boolean;
}

export const DEFAULT_SNAPSHOT_CONFIG: SnapshotConfig = {
  compareOnRead: true,
  strictMode: false,
};

export class SnapshotManager {
  private snapshots: Map<string, Snapshot> = new Map();
  private config: SnapshotConfig;
  private currentSnapshot: Snapshot | null = null;
  private log: string[] = [];

  constructor(config: Partial<SnapshotConfig> = {}) {
    this.config = { ...DEFAULT_SNAPSHOT_CONFIG, ...config };
  }

  private logMessage(msg: string): void {
    this.log.push(msg);
  }

  getLog(): string[] { return [...this.log]; }

  startSnapshot(description: string, metadata: Record<string, any> = {}): string {
    const id = `snap_${Date.now()}_${createHash("sha256").update(description).digest("hex").substring(0, 12)}`;
    this.currentSnapshot = {
      id,
      description,
      createdAt: Date.now(),
      entries: [],
      rootHash: "",
      metadata,
    };
    this.logMessage(`Started snapshot: ${id} - ${description}`);
    return id;
  }

  recordEntry(key: string, value: string): void {
    if (!this.currentSnapshot) {
      throw new Error("No active snapshot. Call startSnapshot() first.");
    }
    const hash = createHash("sha256").update(value).digest("hex");
    this.currentSnapshot.entries.push({
      key,
      value,
      hash,
      timestamp: Date.now(),
    });
  }

  recordEntity(type: string, id: string, data: any): void {
    this.recordEntry(`entity:${type}:${id}`, JSON.stringify(data));
  }

  recordState(label: string, state: any): void {
    this.recordEntry(`state:${label}`, JSON.stringify(state));
  }

  commitSnapshot(): Snapshot {
    if (!this.currentSnapshot) {
      throw new Error("No active snapshot to commit.");
    }

    const sortedEntries = [...this.currentSnapshot.entries].sort((a, b) => a.key.localeCompare(b.key));
    const combinedHash = createHash("sha256");
    for (const entry of sortedEntries) {
      combinedHash.update(entry.hash);
    }
    this.currentSnapshot.rootHash = combinedHash.digest("hex");
    this.currentSnapshot.entries = sortedEntries;

    const snapshot: Snapshot = { ...this.currentSnapshot };
    this.snapshots.set(snapshot.id, snapshot);
    this.currentSnapshot = null;

    this.logMessage(`Committed snapshot ${snapshot.id} with ${snapshot.entries.length} entries, rootHash=${snapshot.rootHash.substring(0, 16)}...`);
    return snapshot;
  }

  getSnapshot(id: string): Snapshot | undefined {
    return this.snapshots.get(id);
  }

  listSnapshots(): Snapshot[] {
    return Array.from(this.snapshots.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  importSnapshot(data: Snapshot): void {
    this.snapshots.set(data.id, data);
    this.logMessage(`Imported snapshot: ${data.id}`);
  }

  exportSnapshot(id: string): Snapshot | undefined {
    return this.snapshots.get(id);
  }

  exportAllSnapshots(): Snapshot[] {
    return this.listSnapshots();
  }

  compareSnapshots(snap1Id: string, snap2Id: string): SnapshotDiff {
    const snap1 = this.snapshots.get(snap1Id);
    const snap2 = this.snapshots.get(snap2Id);

    if (!snap1 || !snap2) {
      throw new Error(`Snapshots not found: ${!snap1 ? snap1Id : snap2Id}`);
    }

    const map1 = new Map(snap1.entries.map((e) => [e.key, e]));
    const map2 = new Map(snap2.entries.map((e) => [e.key, e]));

    const added: SnapshotEntry[] = [];
    const removed: SnapshotEntry[] = [];
    const modified: SnapshotDiff["modified"] = [];
    let unchanged = 0;

    for (const [key, entry] of map2) {
      if (!map1.has(key)) {
        added.push(entry);
      }
    }

    for (const [key, entry] of map1) {
      if (!map2.has(key)) {
        removed.push(entry);
      } else {
        const other = map2.get(key)!;
        if (entry.hash === other.hash) {
          unchanged++;
        } else {
          modified.push({
            key,
            oldHash: entry.hash,
            newHash: other.hash,
            oldValue: entry.value,
            newValue: other.value,
          });
        }
      }
    }

    return { added, removed, modified, unchanged };
  }

  assertSnapshotMatch(
    snap1Id: string,
    snap2Id: string,
    allowedDifferences: string[] = [],
  ): { match: boolean; diff: SnapshotDiff; errors: string[] } {
    const diff = this.compareSnapshots(snap1Id, snap2Id);
    const errors: string[] = [];

    const isAllowed = (key: string): boolean =>
      allowedDifferences.some((allowed) => key === allowed || key.startsWith(allowed));

    for (const mod of diff.modified) {
      if (!isAllowed(mod.key)) {
        errors.push(`Key "${mod.key}" differs between snapshots`);
      }
    }

    for (const entry of diff.added) {
      if (!isAllowed(entry.key)) {
        errors.push(`Key "${entry.key}" added in second snapshot`);
      }
    }

    for (const entry of diff.removed) {
      if (!isAllowed(entry.key)) {
        errors.push(`Key "${entry.key}" removed in second snapshot`);
      }
    }

    const match = errors.length === 0;
    if (match) {
      this.logMessage(`Snapshots match: ${snap1Id} == ${snap2Id} (${diff.unchanged} unchanged entries)`);
    } else {
      this.logMessage(`Snapshots DIFFER: ${snap1Id} vs ${snap2Id} (${errors.length} differences)`);
    }

    return { match, diff, errors };
  }

  takeFullStateSnapshot(
    description: string,
    stateProvider: () => Promise<Record<string, any>>,
    metadata: Record<string, any> = {},
  ): Promise<Snapshot> {
    return this.takeStateSnapshot(description, stateProvider, metadata);
  }

  async takeStateSnapshot(
    description: string,
    stateProvider: () => Promise<Record<string, any>>,
    metadata: Record<string, any> = {},
  ): Promise<Snapshot> {
    this.startSnapshot(description, metadata);
    const state = await stateProvider();

    for (const [key, value] of Object.entries(state)) {
      this.recordEntry(key, JSON.stringify(value));
    }

    return this.commitSnapshot();
  }

  verifySnapshotIntegrity(snapshotId: string): { valid: boolean; errors: string[] } {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return { valid: false, errors: [`Snapshot "${snapshotId}" not found`] };
    }

    const errors: string[] = [];
    const sortedEntries = [...snapshot.entries].sort((a, b) => a.key.localeCompare(b.key));
    const combinedHash = createHash("sha256");

    for (const entry of sortedEntries) {
      const computedHash = createHash("sha256").update(entry.value).digest("hex");
      if (computedHash !== entry.hash) {
        errors.push(`Entry "${entry.key}" hash mismatch: expected ${entry.hash}, computed ${computedHash}`);
      }
      combinedHash.update(entry.hash);
    }

    const computedRoot = combinedHash.digest("hex");
    if (computedRoot !== snapshot.rootHash) {
      errors.push(`Root hash mismatch: expected ${snapshot.rootHash}, computed ${computedRoot}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  clear(): void {
    this.snapshots.clear();
    this.currentSnapshot = null;
    this.log = [];
  }
}

export class PromptSnapshotComparer {
  private manager: SnapshotManager;

  constructor(manager: SnapshotManager) {
    this.manager = manager;
  }

  async capturePromptState(
    label: string,
    prompts: Array<{ id: string; authority: string; cid: string; totalVersions: number; totalUses: number; licenseId: string | null }>,
    licenses: Array<{ id: string; name: string; authority: string; royaltyBasisPoints: number }>,
    versions: Array<{ promptId: string; versionNumber: number; cid: string; author: string }>,
    metadata: Record<string, any> = {},
  ): Promise<Snapshot> {
    this.manager.startSnapshot(`Prompt state: ${label}`, metadata);

    for (const prompt of prompts) {
      this.manager.recordEntity("prompt", prompt.id, prompt);
    }

    for (const license of licenses) {
      this.manager.recordEntity("license", license.id, license);
    }

    for (const version of versions) {
      this.manager.recordEntity("version", `${version.promptId}_v${version.versionNumber}`, version);
    }

    this.manager.recordState("summary", {
      totalPrompts: prompts.length,
      totalLicenses: licenses.length,
      totalVersions: versions.length,
      capturedAt: Date.now(),
    });

    return this.manager.commitSnapshot();
  }

  comparePromptStates(
    snap1Id: string,
    snap2Id: string,
    allowNewPrompts: boolean = true,
    allowNewVersions: boolean = true,
  ): { match: boolean; diff: SnapshotDiff; errors: string[] } {
    const allowed: string[] = [];
    if (allowNewPrompts) allowed.push("entity:prompt:");
    if (allowNewVersions) allowed.push("entity:version:");
    allowed.push("state:summary");

    return this.manager.assertSnapshotMatch(snap1Id, snap2Id, allowed);
  }
}
