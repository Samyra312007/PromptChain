export const IDENTITY_VERSION = "0.1.0";

export const REPUTATION_ALPHA_BP = 4000;
export const REPUTATION_BETA_BP = 3000;
export const REPUTATION_GAMMA_BP = 2000;
export const REPUTATION_DELTA_BP = 1000;
export const BPS_DENOMINATOR = 10_000;
export const MAX_REPUTATION = 4_294_967_295;

export interface ReputationFactors {
  curationAccuracyBp: number;
  contentQualityBp: number;
  communityContributionsBp: number;
  slashingEventsBp: number;
}

export interface ReputationScore {
  overallBp: number;
  curationAccuracyBp: number;
  contentQualityBp: number;
  communityContributionsBp: number;
  slashingEventsBp: number;
  computedAt: number;
  version: string;
}

export interface ReputationHistoryEntry {
  overallBp: number;
  recordedAt: number;
  reason: string;
}

export interface SlashingEvent {
  curatorAddress: string;
  promptCid: string;
  amountBp: number;
  reason: string;
  timestamp: number;
}

export interface W3CVerifiableCredential {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string;
    [key: string]: unknown;
  };
  proof?: {
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    signature: string;
  };
}

export type CredentialType =
  | "PromptChainReputation"
  | "PromptChainCurator"
  | "PromptChainCreator"
  | "PromptChainVerifiedResearcher"
  | "PromptChainCommunityMember"
  | "PromptChainTranslationDAO"
  | "PromptChainModerator";

export interface CredentialTemplate {
  type: CredentialType;
  title: string;
  attributes: string[];
  expiresInDays: number | null;
}

export const CREDENTIAL_TEMPLATES: Record<CredentialType, CredentialTemplate> = {
  PromptChainReputation: {
    type: "PromptChainReputation",
    title: "PromptChain Reputation Attestation",
    attributes: ["overallScoreBp", "curationAccuracyBp", "contentQualityBp", "communityContributionsBp"],
    expiresInDays: 365,
  },
  PromptChainCurator: {
    type: "PromptChainCurator",
    title: "PromptChain Curator Attestation",
    attributes: ["stakeAmount", "totalRatings", "accuracyScoreBp"],
    expiresInDays: 180,
  },
  PromptChainCreator: {
    type: "PromptChainCreator",
    title: "PromptChain Creator Attestation",
    attributes: ["totalPrompts", "totalVersions", "averageRating"],
    expiresInDays: null,
  },
  PromptChainVerifiedResearcher: {
    type: "PromptChainVerifiedResearcher",
    title: "Verified Researcher",
    attributes: ["institution", "field", "verificationLevel"],
    expiresInDays: 365,
  },
  PromptChainCommunityMember: {
    type: "PromptChainCommunityMember",
    title: "PromptChain Community Member",
    attributes: ["joinedAt", "contributions"],
    expiresInDays: null,
  },
  PromptChainTranslationDAO: {
    type: "PromptChainTranslationDAO",
    title: "Translation DAO Contributor",
    attributes: ["languages", "translationsCount", "reputationEarned"],
    expiresInDays: null,
  },
  PromptChainModerator: {
    type: "PromptChainModerator",
    title: "Content Moderator",
    attributes: ["moderatedItems", "accuracyBp", "appointedAt"],
    expiresInDays: 90,
  },
};

export interface SoulboundAttestation {
  id: string;
  subject: string;
  issuer: string;
  credentialType: CredentialType;
  issuedAt: number;
  expiresAt: number | null;
  revoked: boolean;
  revokedAt?: number;
  revokedReason?: string;
  metadata: Record<string, unknown>;
  proof: string;
}

export interface DelegatedIdentityConfig {
  coldWallet: string;
  hotWallet: string;
  delegatedAt: number;
  expiresAt: number | null;
  permissions: DelegatedPermission[];
  revoked: boolean;
  revokedAt?: number;
}

export type DelegatedPermission =
  | "publish"
  | "rate"
  | "transfer"
  | "stake"
  | "vote"
  | "license"
  | "all";

export interface DelegatedActionLog {
  action: DelegatedPermission;
  hotWallet: string;
  target: string;
  timestamp: number;
  signature: string;
}

export interface IdentityProfile {
  walletAddress: string;
  reputation: ReputationScore | null;
  credentials: W3CVerifiableCredential[];
  soulboundAttestations: SoulboundAttestation[];
  delegations: DelegatedIdentityConfig[];
  promptsPublished: number;
  curationsPerformed: number;
  joinedAt: number;
}

export const MAX_CREDENTIAL_EXPIRY_DAYS = 730;
export const MIN_SOULBOUND_PROOF_LENGTH = 16;
export const DELEGATION_MAX_EXPIRY_DAYS = 365;
export const MAX_DELEGATIONS_PER_WALLET = 10;
export const REPUTATION_HALF_LIFE_DAYS = 90;

export const DEFAULT_IDENTITY_CONSTANTS = {
  MAX_CREDENTIAL_EXPIRY_DAYS,
  MIN_SOULBOUND_PROOF_LENGTH,
  DELEGATION_MAX_EXPIRY_DAYS,
  MAX_DELEGATIONS_PER_WALLET,
  REPUTATION_HALF_LIFE_DAYS,
} as const;
