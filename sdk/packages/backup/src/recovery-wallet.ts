import { createHash, randomBytes } from 'crypto';
import {
  BackupManifestEntry,
  RecoveryWalletConfig,
  RecoveryClaim,
  BackupManifest,
} from './types';

const DEFAULT_INACTIVITY_DAYS = 90;

export class RecoveryWalletManager {
  private config: RecoveryWalletConfig;
  private claims: Map<string, RecoveryClaim> = new Map();

  constructor(config?: Partial<RecoveryWalletConfig>) {
    this.config = {
      recoveryAddress: config?.recoveryAddress || '',
      inactivityDays: config?.inactivityDays || DEFAULT_INACTIVITY_DAYS,
      reclaimableAfter: config?.reclaimableAfter || 0,
    };
  }

  getConfig(): RecoveryWalletConfig {
    return { ...this.config };
  }

  setRecoveryAddress(address: string): void {
    this.config.recoveryAddress = address;
    this.config.reclaimableAfter = Date.now() + this.config.inactivityDays * 24 * 60 * 60 * 1000;
  }

  setInactivityDays(days: number): void {
    this.config.inactivityDays = days;
    this.config.reclaimableAfter = Date.now() + days * 24 * 60 * 60 * 1000;
  }

  isReclaimable(prompt: BackupManifestEntry, lastActivityTimestamp: number): boolean {
    const inactivityPeriod = this.config.inactivityDays * 24 * 60 * 60 * 1000;
    const isInactive = Date.now() - lastActivityTimestamp >= inactivityPeriod;

    if (!this.config.recoveryAddress) return false;
    if (!isInactive) return false;

    if (this.claims.has(prompt.cid)) return false;

    return true;
  }

  claimPrompt(
    prompt: BackupManifestEntry,
    originalAuthority: string,
    recoveredBy: string,
  ): RecoveryClaim {
    if (!this.config.recoveryAddress) {
      throw new Error('No recovery address configured');
    }
    if (recoveredBy !== this.config.recoveryAddress) {
      throw new Error(`Only the configured recovery address (${this.config.recoveryAddress}) can reclaim prompts`);
    }

    const claim: RecoveryClaim = {
      promptCid: prompt.cid,
      originalAuthority,
      recoveredBy,
      recoveredAt: Date.now(),
      signature: this.signClaim(prompt.cid, originalAuthority, recoveredBy),
    };

    this.claims.set(prompt.cid, claim);
    return claim;
  }

  getClaim(promptCid: string): RecoveryClaim | undefined {
    return this.claims.get(promptCid);
  }

  getAllClaims(): RecoveryClaim[] {
    return [...this.claims.values()];
  }

  revokeClaim(promptCid: string): boolean {
    return this.claims.delete(promptCid);
  }

  getRecoverablePrompts(
    entries: BackupManifestEntry[],
    lastActivityMap: Map<string, number>,
  ): BackupManifestEntry[] {
    return entries.filter((e) => {
      const lastActive = lastActivityMap.get(e.cid) || 0;
      return this.isReclaimable(e, lastActive);
    });
  }

  exportState(): { config: RecoveryWalletConfig; claims: RecoveryClaim[] } {
    return {
      config: { ...this.config },
      claims: [...this.claims.values()],
    };
  }

  importState(state: { config: RecoveryWalletConfig; claims: RecoveryClaim[] }): void {
    this.config = { ...state.config };
    for (const claim of state.claims) {
      this.claims.set(claim.promptCid, claim);
    }
  }

  private signClaim(promptCid: string, originalAuthority: string, recoveredBy: string): string {
    const data = `${promptCid}:${originalAuthority}:${recoveredBy}:${Date.now()}`;
    return createHash('sha256').update(data, 'utf8').digest('hex');
  }

  static computeInactivityDeadline(createdAt: number, inactivityDays: number = DEFAULT_INACTIVITY_DAYS): number {
    return createdAt + inactivityDays * 24 * 60 * 60 * 1000;
  }
}
