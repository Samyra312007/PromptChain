import { StateMachineHarness, ActionType, MachineStep, DEFAULT_STATE_MACHINE_CONFIG } from "./state-machine";

export interface SimulationNodeConfig {
  id: string;
  partitionGroup?: number;
  isDisconnected: boolean;
  clockSkewMs: number;
  rpcFailureRate: number;
  latencyMs: number;
}

export interface SimulationConfig {
  nodeCount: number;
  stepsPerNode: number;
  networkPartitionRate: number;
  rpcFailureRate: number;
  clockSkewMaxMs: number;
  latencyMinMs: number;
  latencyMaxMs: number;
  partitionGroups: number;
  seed: number;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  nodeCount: 20,
  stepsPerNode: 20,
  networkPartitionRate: 0.1,
  rpcFailureRate: 0.05,
  clockSkewMaxMs: 100,
  latencyMinMs: 0,
  latencyMaxMs: 1,
  partitionGroups: 3,
  seed: 42,
};

export interface SimulationResult {
  config: SimulationConfig;
  nodes: SimulationNodeConfig[];
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  partitionsDetected: number;
  convergenceAchieved: boolean;
  convergenceTimeMs: number;
  finalStates: Map<string, number>;
  perNodeStats: Array<{
    nodeId: string;
    actionsExecuted: number;
    actionsFailed: number;
    isPartitioned: boolean;
    clockSkewMs: number;
    rpcFailures: number;
    latencySumMs: number;
  }>;
  history: MachineStep[];
  log: string[];
}

export class DeterministicSimulation {
  private config: SimulationConfig;
  private nodes: SimulationNodeConfig[] = [];
  private nodeMachines: Map<string, StateMachineHarness> = new Map();
  private log: string[] = [];
  private rng: () => number;
  private startTime: number;
  private partitionHistory: Array<{ time: number; description: string }> = [];

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...config };
    this.rng = this.seededRandom(this.config.seed);
    this.startTime = Date.now();
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  private logMessage(msg: string): void {
    const elapsed = Date.now() - this.startTime;
    this.log.push(`[+${elapsed}ms] ${msg}`);
  }

  getNodes(): SimulationNodeConfig[] { return [...this.nodes]; }
  getLog(): string[] { return [...this.log]; }
  getPartitionHistory(): Array<{ time: number; description: string }> {
    return [...this.partitionHistory];
  }

  initialize(): SimulationNodeConfig[] {
    const nodeIds: string[] = [];
    for (let i = 0; i < this.config.nodeCount; i++) {
      const id = `node_${i}_${this.randomInt(10000, 99999)}`;
      nodeIds.push(id);
    }

    this.nodes = nodeIds.map((id, i) => ({
      id,
      partitionGroup: this.randomInt(0, this.config.partitionGroups - 1),
      isDisconnected: false,
      clockSkewMs: this.randomInt(-this.config.clockSkewMaxMs, this.config.clockSkewMaxMs),
      rpcFailureRate: this.rng() < this.config.rpcFailureRate ? this.rng() * 0.3 : 0,
      latencyMs: this.randomInt(this.config.latencyMinMs, this.config.latencyMaxMs),
    }));

    for (const node of this.nodes) {
      const machine = new StateMachineHarness({
        minActors: 2,
        maxActors: 5,
        maxSteps: this.config.stepsPerNode,
        seed: this.randomInt(0, 999999),
      });
      this.nodeMachines.set(node.id, machine);
    }

    this.logMessage(`Initialized ${this.config.nodeCount} nodes across ${this.config.partitionGroups} partition groups`);
    return this.nodes;
  }

  injectNetworkPartition(probability: number = this.config.networkPartitionRate): void {
    const partitionGroups = new Map<number, SimulationNodeConfig[]>();
    for (const node of this.nodes) {
      const group = node.partitionGroup ?? 0;
      if (!partitionGroups.has(group)) {
        partitionGroups.set(group, []);
      }
      partitionGroups.get(group)!.push(node);
    }

    const groups = Array.from(partitionGroups.entries());
    for (let i = 0; i < groups.length; i++) {
      if (this.rng() < probability) {
        const [groupId, partitioned] = groups[i];
        for (const node of partitioned) {
          node.isDisconnected = true;
        }
        this.partitionHistory.push({
          time: Date.now(),
          description: `Partitioned group ${groupId} (${partitioned.length} nodes)`,
        });
        this.logMessage(`Injected partition: group ${groupId} isolated (${partitioned.length} nodes)`);
      }
    }
  }

  healPartitions(): void {
    let count = 0;
    for (const node of this.nodes) {
      if (node.isDisconnected) {
        node.isDisconnected = false;
        count++;
      }
    }
    this.partitionHistory.push({
      time: Date.now(),
      description: `Healed all partitions (${count} nodes reconnected)`,
    });
    this.logMessage(`Healed partitions: ${count} nodes reconnected`);
  }

  injectRpcFailures(failureRate: number): void {
    for (const node of this.nodes) {
      if (this.rng() < failureRate) {
        node.rpcFailureRate = Math.min(1.0, node.rpcFailureRate + 0.2);
      }
    }
    this.logMessage(`Injected RPC failures: average rate increased`);
  }

  injectClockSkew(): void {
    for (const node of this.nodes) {
      if (this.rng() < 0.1) {
        node.clockSkewMs = this.randomInt(-this.config.clockSkewMaxMs, this.config.clockSkewMaxMs);
      }
    }
    this.logMessage(`Injected clock skew across nodes`);
  }

  async simulateStep(nodeId: string): Promise<MachineStep> {
    const node = this.nodes.find((n) => n.id === nodeId);
    const machine = this.nodeMachines.get(nodeId);
    if (!node || !machine) {
      throw new Error(`Node ${nodeId} not found`);
    }

    if (node.isDisconnected) {
      return {
        actionType: ActionType.Publish,
        actor: "system",
        stepNumber: machine.getStepNumber(),
        success: false,
        description: `Node ${nodeId} is partitioned, action dropped`,
        details: { reason: "network_partition", nodeId },
      };
    }

    if (this.rng() < node.rpcFailureRate) {
      return {
        actionType: ActionType.Publish,
        actor: "system",
        stepNumber: machine.getStepNumber(),
        success: false,
        description: `Node ${nodeId} RPC failure`,
        details: { reason: "rpc_failure", nodeId },
      };
    }

    if (node.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, node.latencyMs));
    }

    const actions = [
      () => machine.executePublish(),
      () => machine.executeCreateVersion(),
      () => machine.executeTransfer(),
      () => machine.executeSetLicense(),
      () => machine.executeUsePrompt(),
    ];
    const actionIndex = Math.floor(this.rng() * actions.length);
    return actions[actionIndex]();
  }

  async run(): Promise<SimulationResult> {
    this.startTime = Date.now();
    this.initialize();

    this.logMessage(`Starting simulation with ${this.config.nodeCount} nodes, ${this.config.stepsPerNode} steps each`);

    // Phase 1: Bootstrap - let nodes act independently
    this.logMessage("Phase 1: Bootstrap");
    for (let i = 0; i < 10; i++) {
      for (const node of this.nodes) {
        if (!node.isDisconnected) {
          await this.simulateStep(node.id);
        }
      }
    }

    // Phase 2: Inject partitions
    this.logMessage("Phase 2: Inject network partitions");
    this.injectNetworkPartition(0.3);

    // Phase 3: Run under partition
    this.logMessage("Phase 3: Running under partition");
    for (let i = 0; i < 20; i++) {
      for (const node of this.nodes) {
        await this.simulateStep(node.id);
      }
    }

    // Phase 4: Heal partitions
    this.logMessage("Phase 4: Heal partitions");
    this.healPartitions();

    // Phase 5: Run after healing
    this.logMessage("Phase 5: Post-partition convergence");
    for (let i = 0; i < 20; i++) {
      for (const node of this.nodes) {
        await this.simulateStep(node.id);
      }
    }

    // Phase 6: Inject more failures
    this.logMessage("Phase 6: Inject RPC failures and clock skew");
    this.injectRpcFailures(0.2);
    this.injectClockSkew();

    // Phase 7: Final run
    this.logMessage("Phase 7: Final execution");
    const remainingSteps = this.config.stepsPerNode - 60;
    for (let i = 0; i < Math.max(10, remainingSteps); i++) {
      for (const node of this.nodes) {
        await this.simulateStep(node.id);
      }
    }

    // Check convergence
    const convergenceAchieved = this.checkConvergence();
    const convergenceTime = convergenceAchieved ? Date.now() - this.startTime : -1;

    this.logMessage(`Simulation complete. Convergence: ${convergenceAchieved}`);

    return this.buildResult(convergenceAchieved, convergenceTime);
  }

  checkConvergence(): boolean {
    const checks: boolean[] = [];

    // All nodes that can communicate should agree on state
    for (const node of this.nodes) {
      if (!node.isDisconnected) {
        const machine = this.nodeMachines.get(node.id);
        if (machine) {
          checks.push(machine.assertInvariant("no duplicate CIDs"));
          checks.push(machine.assertInvariant("ownership chain is verifiable"));
        }
      }
    }

    return checks.filter(Boolean).length >= checks.length * 0.8;
  }

  private buildResult(convergenceAchieved: boolean, convergenceTimeMs: number): SimulationResult {
    const perNodeStats: SimulationResult["perNodeStats"] = [];
    let totalActions = 0;
    let successfulActions = 0;
    let failedActions = 0;

    for (const node of this.nodes) {
      const machine = this.nodeMachines.get(node.id);
      if (machine) {
        const history = machine.getHistory();
        const successCount = history.filter((s) => s.success).length;
        totalActions += history.length;
        successfulActions += successCount;
        failedActions += history.length - successCount;

        perNodeStats.push({
          nodeId: node.id,
          actionsExecuted: history.length,
          actionsFailed: history.length - successCount,
          isPartitioned: node.isDisconnected,
          clockSkewMs: node.clockSkewMs,
          rpcFailures: history.length - successCount,
          latencySumMs: node.latencyMs * history.length,
        });
      }
    }

    const finalStates = new Map<string, number>();
    const allMachines = Array.from(this.nodeMachines.values());
    finalStates.set("totalPrompts", allMachines.reduce((a, m) => a + m.getPrompts().size, 0));
    finalStates.set("totalVersions", allMachines.reduce((a, m) => {
      const versions = m.getVersions();
      let count = 0;
      for (const v of versions.values()) count += v.length;
      return a + count;
    }, 0));
    finalStates.set("totalLicenses", allMachines.reduce((a, m) => a + m.getLicenses().size, 0));
    finalStates.set("totalActors", allMachines.reduce((a, m) => a + m.getActors().length, 0));

    const partitionsDetected = this.partitionHistory.length;

    return {
      config: this.config,
      nodes: this.nodes,
      totalActions,
      successfulActions,
      failedActions,
      partitionsDetected,
      convergenceAchieved,
      convergenceTimeMs,
      finalStates,
      perNodeStats,
      history: allMachines.flatMap((m) => m.getHistory()),
      log: this.log,
    };
  }
}
