import { PublicKey } from '@solana/web3.js';

export interface RlhfSession {
  authority: PublicKey;
  sessionId: number;
  promptCid: string;
  modelName: string;
  maxPreferences: number;
  rewardPerPreference: number;
  totalPreferences: number;
  totalRatings: number;
  totalRewardPool: number;
  distributedRewards: number;
  isActive: boolean;
  createdAt: number;
  endedAt: number;
}

export interface Preference {
  session: PublicKey;
  preferenceId: number;
  rater: PublicKey;
  preferredOutputUri: string;
  rejectedOutputUri: string;
  criteria: string;
  submittedAt: number;
  rewardClaimed: boolean;
}

export interface RlhfRating {
  session: PublicKey;
  ratingId: number;
  rater: PublicKey;
  outputUri: string;
  ratingValue: number;
  criteria: string;
  submittedAt: number;
  rewardClaimed: boolean;
}

export interface RlhfReward {
  rater: PublicKey;
  session: PublicKey;
  totalPreferences: number;
  totalRatings: number;
  totalEarned: number;
  claimedAmount: number;
}

export interface PreferenceSubmission {
  preferredOutputUri: string;
  rejectedOutputUri: string;
  criteria: string;
}

export interface RatingSubmission {
  outputUri: string;
  ratingValue: number;
  criteria: string;
}

export enum SessionStatus {
  Active = 'active',
  Ended = 'ended',
  Full = 'full',
}
