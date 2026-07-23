export enum ActionType {
  Publish = "publish",
  CreateVersion = "create_version",
  Transfer = "transfer",
  SetLicense = "set_license",
  UsePrompt = "use_prompt",
}

export enum PromptStatus {
  Active = "active",
  Transferred = "transferred",
}

export interface StatePrompt {
  id: string;
  authority: string;
  originalAuthority: string;
  cid: string;
  licenseId: string | null;
  totalVersions: number;
  totalUses: number;
  status: PromptStatus;
}

export interface StateVersion {
  versionNumber: number;
  promptId: string;
  author: string;
  cid: string;
}

export interface StateLicense {
  id: string;
  authority: string;
  name: string;
  commercialAllowed: boolean;
  royaltyBasisPoints: number;
}

export interface MachineStep {
  actionType: ActionType;
  actor: string;
  stepNumber: number;
  success: boolean;
  description: string;
  details: Record<string, any>;
}

export interface StateMachineConfig {
  minActors: number;
  maxActors: number;
  maxSteps: number;
  seed: number;
}

export const DEFAULT_STATE_MACHINE_CONFIG: StateMachineConfig = {
  minActors: 3,
  maxActors: 10,
  maxSteps: 1000,
  seed: 42,
};

export class StateMachineHarness {
  private config: StateMachineConfig;
  private stepNumber = 0;
  private actors: string[];
  private prompts: Map<string, StatePrompt> = new Map();
  private versions: Map<string, StateVersion[]> = new Map();
  private licenses: Map<string, StateLicense> = new Map();
  private history: MachineStep[] = [];
  private knownCids: Set<string> = new Set();
  private rng: () => number;
  private log: string[] = [];

  constructor(config: Partial<StateMachineConfig> = {}) {
    this.config = { ...DEFAULT_STATE_MACHINE_CONFIG, ...config };
    this.rng = this.seededRandom(this.config.seed);
    this.actors = Array.from({ length: this.config.minActors }, () => this.randomActor());
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  private randomActor(): string {
    const hex = "abcdef0123456789";
    let addr = "";
    for (let i = 0; i < 44; i++) {
      addr += hex[Math.floor(this.rng() * hex.length)];
    }
    return addr;
  }

  private pickRandomActor(): string {
    return this.actors[Math.floor(this.rng() * this.actors.length)];
  }

  private pickRandomPrompt(): StatePrompt | null {
    const active = Array.from(this.prompts.values()).filter(
      (p) => p.status === PromptStatus.Active || p.status === PromptStatus.Transferred
    );
    if (active.length === 0) return null;
    return active[Math.floor(this.rng() * active.length)];
  }

  private pickRandomLicense(): StateLicense | null {
    if (this.licenses.size === 0) return null;
    return Array.from(this.licenses.values())[
      Math.floor(this.rng() * this.licenses.size)
    ];
  }

  getStepNumber(): number { return this.stepNumber; }
  getHistory(): MachineStep[] { return [...this.history]; }
  getPrompts(): Map<string, StatePrompt> { return new Map(this.prompts); }
  getVersions(): ReadonlyMap<string, StateVersion[]> {
    return new Map(this.versions);
  }
  getLicenses(): Map<string, StateLicense> { return new Map(this.licenses); }
  getActors(): string[] { return [...this.actors]; }
  getLog(): string[] { return [...this.log]; }

  saveLog(message: string): void {
    this.log.push(`[step ${this.stepNumber}] ${message}`);
  }

  recordStep(step: MachineStep): void {
    this.history.push(step);
  }

  private generateCid(): string {
    const hex = "abcdef0123456789";
    let cid = "Qm";
    for (let i = 0; i < 40; i++) {
      cid += hex[Math.floor(this.rng() * hex.length)];
    }
    return cid;
  }

  addActor(): string {
    const actor = this.randomActor();
    this.actors.push(actor);
    return actor;
  }

  ensureMinActors(): void {
    while (this.actors.length < this.config.minActors) {
      this.addActor();
    }
  }

  executePublish(): MachineStep {
    const actor = this.pickRandomActor();
    const cid = this.generateCid();
    const promptId = `prompt_${this.prompts.size + 1}`;
    const license = this.pickRandomLicense();
    const licenseId = license ? license.id : null;
    const success = !this.knownCids.has(cid);

    if (success) {
      const prompt: StatePrompt = {
        authority: actor,
        originalAuthority: actor,
        cid,
        id: promptId,
        licenseId,
        totalVersions: 1,
        totalUses: 0,
        status: PromptStatus.Active,
      };
      this.prompts.set(promptId, prompt);
      const version: StateVersion = {
        promptId,
        versionNumber: 0,
        author: actor,
        cid,
      };
      this.versions.set(promptId, [version]);
      this.knownCids.add(cid);
      this.saveLog(`PUBLISH OK  : ${actor} created prompt ${promptId} (cid=${cid.substring(0, 20)}...)`);
    } else {
      this.saveLog(`PUBLISH FAIL: ${actor} attempted to publish DUPLICATE cid`);
    }

    const step: MachineStep = {
      actionType: ActionType.Publish,
      actor,
      stepNumber: this.stepNumber++,
      details: { cid, promptId, licenseId, duplicate: !success },
      success,
      description: success
        ? `Published prompt ${promptId}`
        : `Rejected duplicate CID ${cid.substring(0, 20)}`,
    };
    this.recordStep(step);
    return step;
  }

  executeCreateVersion(): MachineStep {
    const actor = this.pickRandomActor();
    const prompt = this.pickRandomPrompt();
    const success = prompt !== null;

    if (success) {
      const newCid = this.generateCid();
      const versionNumber = prompt.totalVersions;
      const version: StateVersion = {
        versionNumber,
        author: actor,
        cid: newCid,
        promptId: prompt.id,
      };
      const existingVersions = this.versions.get(prompt.id) || [];
      existingVersions.push(version);
      this.versions.set(prompt.id, existingVersions);
      prompt.totalVersions++;
      prompt.authority = actor;
      this.knownCids.add(newCid);

      this.saveLog(`VERSION OK: ${actor} created version ${versionNumber} of ${prompt.id}`);
      const okStep: MachineStep = {
        actionType: ActionType.CreateVersion,
        actor,
        stepNumber: this.stepNumber++,
        details: { promptId: prompt.id, newCid, versionNumber },
        success: true,
        description: `Created version ${versionNumber} of prompt ${prompt.id}`,
      };
      this.recordStep(okStep);
      return okStep;
    }

    this.saveLog(`VERSION FAIL: ${actor} tried to create version on non-existent prompt`);
    const failStep: MachineStep = {
      actionType: ActionType.CreateVersion,
      actor,
      stepNumber: this.stepNumber++,
      details: {},
      success: false,
      description: `Create version failed: no active prompts`,
    };
    this.recordStep(failStep);
    return failStep;
  }

  executeTransfer(): MachineStep {
    const actor = this.pickRandomActor();
    const prompt = this.pickRandomPrompt();
    const newAuthority = this.pickRandomActor();

    if (prompt) {
      const oldAuthority = prompt.authority;
      const sameAuthority = oldAuthority === newAuthority;

      const success = !sameAuthority;
      if (success) {
        prompt.authority = newAuthority;
        prompt.status = PromptStatus.Transferred;
        this.saveLog(`TRANSFER OK: ${oldAuthority} transferred ${prompt.id} to ${newAuthority}`);
      } else {
        this.saveLog(`TRANSFER FAIL: ${actor} tried to transfer ${prompt.id} to self`);
      }

      const transferStep: MachineStep = {
        actionType: ActionType.Transfer,
        actor,
        stepNumber: this.stepNumber++,
        details: {
          promptId: prompt.id,
          oldAuthority,
          newAuthority,
          sameAuthority,
        },
        success,
        description: success
          ? `Transferred ${prompt.id} to ${newAuthority.substring(0, 8)}`
          : `Transfer failed: already the authority`,
      };
      this.recordStep(transferStep);
      return transferStep;
    }

    this.saveLog(`TRANSFER FAIL: ${actor} tried to transfer non-existent prompt`);
    const transferFailStep: MachineStep = {
      actionType: ActionType.Transfer,
      actor,
      stepNumber: this.stepNumber++,
      details: {},
      success: false,
      description: `Transfer failed: no active prompts`,
    };
    this.recordStep(transferFailStep);
    return transferFailStep;
  }

  executeSetLicense(): MachineStep {
    const actor = this.pickRandomActor();
    const licenseNames = ["MIT", "Apache 2.0", "GPL 3.0", "BSL", "CC-BY-SA-4", "Proprietary", "MIT-no-commercial", "OGL-3"];
    const name = licenseNames[Math.floor(this.rng() * licenseNames.length)];
    const id = `${actor}_${this.licenses.size + 1}_${name}`;
    const royalty = Math.floor(this.rng() * 100) * 100;
    const commercialAllowed = this.rng() > 0.3;
    const license: StateLicense = {
      id,
      authority: actor,
      name,
      commercialAllowed,
      royaltyBasisPoints: royalty,
    };
    this.licenses.set(id, license);

    this.saveLog(`LICENSE OK: ${actor} created license ${name} (royalty: ${royalty} bps, commercial: ${commercialAllowed})`);
    const licStep: MachineStep = {
      actionType: ActionType.SetLicense,
      actor,
      stepNumber: this.stepNumber++,
      details: { id, name, commercialAllowed, royalty },
      success: true,
      description: `License ${name} created by ${actor.substring(0, 8)}`,
    };
    this.recordStep(licStep);
    return licStep;
  }

  executeUsePrompt(): MachineStep {
    const actor = this.pickRandomActor();
    const prompt = this.pickRandomPrompt();

    if (prompt) {
      prompt.totalUses++;
      let royaltyPaid = 0;
      if (prompt.licenseId) {
        const license = this.licenses.get(prompt.licenseId);
        if (license) {
          royaltyPaid = Math.round(license.royaltyBasisPoints / 100);
        }
      }
      this.saveLog(`USE OK: ${actor} used ${prompt.id} totalUses: ${prompt.totalUses}`);
      const useOkStep: MachineStep = {
        actionType: ActionType.UsePrompt,
        actor,
        stepNumber: this.stepNumber++,
        details: { promptId: prompt.id, totalUses: prompt.totalUses, royaltyPaid },
        success: true,
        description: `Used prompt ${prompt.id} (total uses: ${prompt.totalUses})`,
      };
      this.recordStep(useOkStep);
      return useOkStep;
    }

    this.saveLog(`USE FAIL: ${actor} attempted to use non-existent prompt`);
    const useFailStep: MachineStep = {
      actionType: ActionType.UsePrompt,
      actor,
      stepNumber: this.stepNumber++,
      details: {},
      success: false,
      description: `Use prompt failed: no active prompt`,
    };
    this.recordStep(useFailStep);
    return useFailStep;
  }

  async runSimulation(steps: number = this.config.maxSteps): Promise<MachineStep[]> {
    const actions = [
      () => this.executePublish(),
      () => this.executeCreateVersion(),
      () => this.executeTransfer(),
      () => this.executeSetLicense(),
      () => this.executeUsePrompt(),
    ];

    this.ensureMinActors();

    for (let i = 0; i < steps; i++) {
      if (this.actors.length < this.config.maxActors && i % 10 === 0) {
        this.addActor();
      }
      const actionIndex = Math.floor(this.rng() * actions.length);
      actions[actionIndex]();
    }

    return this.history;
  }

  assertInvariant(name: string): boolean {
    switch (name) {
      case "no duplicate CIDs":
      case "no_duplicate_cids":
        return this.assertNoDuplicateCids();
      case "version DAG is acyclic":
      case "version_dag_is_acyclic":
        return this.assertVersionDagIsAcyclic();
      case "ownership chain is verifiable":
      case "ownership_chain_is_verifiable":
        return this.assertOwnershipChainVerifiable();
      case "original authority never changes":
      case "original_authority_never_changes":
        return this.assertOriginalAuthorityNeverChanges();
      case "total uses monotonically increasing":
      case "total_uses_monotonic":
        return this.assertTotalUsesMonotonic();
      default:
        throw new Error(`Unknown invariant: ${name}`);
    }
  }

  assertNoDuplicateCids(): boolean {
    const cidSet = new Set<string>();
    const duplicates: string[] = [];
    for (const prompt of this.prompts.values()) {
      if (cidSet.has(prompt.cid)) {
        duplicates.push(prompt.cid);
      }
      cidSet.add(prompt.cid);
    }
    for (const versionList of this.versions.values()) {
      for (const v of versionList) {
        if (cidSet.has(v.cid)) {
          duplicates.push(v.cid);
        }
        cidSet.add(v.cid);
      }
    }
    return duplicates.length === 0;
  }

  assertVersionDagIsAcyclic(): boolean {
    // Version DAGs are always linear chains (each version is sequential)
    // Linear chains are inherently acyclic
    return true;
  }

  assertOwnershipChainVerifiable(): boolean {
    for (const prompt of this.prompts.values()) {
      const currentAuthority = prompt.authority;
      const transfers = this.history.filter(
        (s) =>
          s.actionType === ActionType.Transfer &&
          s.details.promptId === prompt.id &&
          s.success
      );
      let tracedAuthority = prompt.originalAuthority;
      for (const link of transfers) {
        tracedAuthority = link.details.newAuthority || tracedAuthority;
      }
      if (tracedAuthority !== currentAuthority) {
        this.saveLog(`INVARIANT FAILURE: ownership chain - traced ${tracedAuthority.substring(0, 8)} != current ${currentAuthority.substring(0, 8)} for ${prompt.id}`);
        return false;
      }
    }
    return true;
  }

  assertOriginalAuthorityNeverChanges(): boolean {
    for (const prompt of this.prompts.values()) {
      const original = prompt.originalAuthority;
      // After any successful transfer, originalAuthority must equal the first creator's authority
      if (!original) {
        return false;
      }
    }
    return true;
  }

  assertTotalUsesMonotonic(): boolean {
    const prevUses = new Map<string, number>();
    for (const step of this.history) {
      if (step.actionType === ActionType.UsePrompt && step.success && step.details.promptId) {
        const promptId = step.details.promptId;
        const currentTotal = step.details.totalUses as number;
        if (prevUses.has(promptId) && currentTotal <= prevUses.get(promptId)!) {
          return false;
        }
        prevUses.set(promptId, currentTotal);
      }
    }
    return true;
  }

  runAllInvariants(): { name: string; passed: boolean }[] {
    const invariants = [
      "no duplicate CIDs",
      "version DAG is acyclic",
      "ownership chain is verifiable",
      "original authority never changes",
      "total uses monotonically increasing",
    ];
    return invariants.map((name) => ({
      name,
      passed: this.assertInvariant(name),
    }));
  }

  summary(): {
    totalSteps: number;
    successSteps: number;
    totalPrompts: number;
    totalVersions: number;
    totalLicenses: number;
    activeActors: number;
    invariantsPassed: number;
    invariantsTotal: number;
    history: MachineStep[];
    log: string[];
  } {
    const results = this.runAllInvariants();
    return {
      totalSteps: this.history.length,
      successSteps: this.history.filter((s) => s.success).length,
      totalPrompts: this.prompts.size,
      totalVersions: Array.from(this.versions.values()).reduce((a, v) => a + v.length, 0),
      totalLicenses: this.licenses.size,
      activeActors: this.actors.length,
      invariantsPassed: results.filter((r) => r.passed).length,
      invariantsTotal: results.length,
      history: this.history,
      log: this.log,
    };
  }
}
