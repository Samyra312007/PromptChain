import { createHash, randomBytes } from "crypto";
import {
  DelegatedIdentityConfig,
  DelegatedPermission,
  DelegatedActionLog,
  DEFAULT_IDENTITY_CONSTANTS,
} from "./types";

export class DelegatedIdentityManager {
  private delegations: Map<string, DelegatedIdentityConfig> = new Map();
  private actionLogs: DelegatedActionLog[] = [];

  delegate(
    coldWallet: string,
    hotWallet: string,
    permissions: DelegatedPermission[],
    expiresInDays?: number,
  ): DelegatedIdentityConfig {
    if (this.getActiveDelegations(coldWallet).length >= DEFAULT_IDENTITY_CONSTANTS.MAX_DELEGATIONS_PER_WALLET) {
      throw new Error(`Max delegations (${DEFAULT_IDENTITY_CONSTANTS.MAX_DELEGATIONS_PER_WALLET}) reached for wallet ${coldWallet}`);
    }

    const maxDays = expiresInDays ?? DEFAULT_IDENTITY_CONSTANTS.DELEGATION_MAX_EXPIRY_DAYS;
    if (maxDays > DEFAULT_IDENTITY_CONSTANTS.DELEGATION_MAX_EXPIRY_DAYS) {
      throw new Error(`Delegation expiry cannot exceed ${DEFAULT_IDENTITY_CONSTANTS.DELEGATION_MAX_EXPIRY_DAYS} days`);
    }

    const delegatedAt = Date.now();
    const expiresAt = maxDays ? delegatedAt + maxDays * 24 * 60 * 60 * 1000 : null;

    const config: DelegatedIdentityConfig = {
      coldWallet,
      hotWallet,
      delegatedAt,
      expiresAt,
      permissions: permissions.includes("all") ? ["all"] as DelegatedPermission[] : permissions,
      revoked: false,
    };

    const key = `${coldWallet}:${hotWallet}`;
    this.delegations.set(key, config);
    return config;
  }

  revokeDelegation(coldWallet: string, hotWallet: string): boolean {
    const key = `${coldWallet}:${hotWallet}`;
    const config = this.delegations.get(key);
    if (!config || config.revoked) return false;

    config.revoked = true;
    config.revokedAt = Date.now();
    return true;
  }

  verifyPermission(coldWallet: string, hotWallet: string, permission: DelegatedPermission): boolean {
    const config = this.getDelegation(coldWallet, hotWallet);
    if (!config) return false;
    if (config.revoked) return false;
    if (config.expiresAt && Date.now() > config.expiresAt) return false;
    if (config.permissions.includes("all")) return true;
    return config.permissions.includes(permission);
  }

  getDelegation(coldWallet: string, hotWallet: string): DelegatedIdentityConfig | undefined {
    return this.delegations.get(`${coldWallet}:${hotWallet}`);
  }

  getActiveDelegations(wallet: string): DelegatedIdentityConfig[] {
    return this.getDelegationsByWallet(wallet).filter(
      (d) => !d.revoked && (!d.expiresAt || Date.now() <= d.expiresAt),
    );
  }

  getDelegationsByWallet(wallet: string): DelegatedIdentityConfig[] {
    return Array.from(this.delegations.values()).filter(
      (d) => d.coldWallet === wallet || d.hotWallet === wallet,
    );
  }

  logAction(
    coldWallet: string,
    hotWallet: string,
    action: DelegatedPermission,
    target: string,
  ): DelegatedActionLog {
    const payload = `${coldWallet}:${hotWallet}:${action}:${target}:${Date.now()}`;
    const signature = createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 16);

    const log: DelegatedActionLog = {
      action,
      hotWallet,
      target,
      timestamp: Date.now(),
      signature,
    };

    this.actionLogs.push(log);
    return log;
  }

  getActionLogs(wallet?: string): DelegatedActionLog[] {
    if (!wallet) return this.actionLogs;
    return this.actionLogs.filter((l) => l.hotWallet === wallet);
  }

  verifyActionLog(log: DelegatedActionLog, coldWallet: string): boolean {
    const payload = `${coldWallet}:${log.hotWallet}:${log.action}:${log.target}:${log.timestamp}`;
    const expectedSig = createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 16);
    return log.signature === expectedSig;
  }

  exportState(): { delegations: DelegatedIdentityConfig[]; actionLogs: DelegatedActionLog[] } {
    return {
      delegations: Array.from(this.delegations.values()),
      actionLogs: this.actionLogs,
    };
  }

  importState(state: { delegations: DelegatedIdentityConfig[]; actionLogs: DelegatedActionLog[] }): void {
    this.delegations.clear();
    this.actionLogs = [];
    for (const d of state.delegations) {
      this.delegations.set(`${d.coldWallet}:${d.hotWallet}`, d);
    }
    this.actionLogs = state.actionLogs;
  }
}
