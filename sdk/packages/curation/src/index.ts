import { PublicKey, SystemProgram, TransactionSignature } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { CURATION_PROGRAM_ID, PDA_SEEDS } from "@promptchain/schema";

import idl from "./idl/promptchain_curation.json";

export interface CuratorAccount {
  authority: PublicKey;
  stakeAmount: BN;
  totalRatings: BN;
  accuracyScoreBp: BN;
  lastRatingSlot: BN;
  bump: number;
}

export interface RatingAccount {
  curator: PublicKey;
  prompt: PublicKey;
  ratingValue: number;
  reviewUri: string;
  submittedSlot: BN;
  curatorStakeAtSubmission: BN;
  bump: number;
}

export interface PromptCurationAccount {
  prompt: PublicKey;
  totalRatings: BN;
  weightedSum: BN;
  totalWeight: BN;
  averageRatingBp: BN;
  lastUpdatedSlot: BN;
  bump: number;
}

export interface UserReputationAccount {
  authority: PublicKey;
  promptsPublished: BN;
  totalRatingFromPromptsBp: BN;
  curationsPerformed: BN;
  curationAccuracyBp: BN;
  consistencyBp: BN;
  overallScoreBp: BN;
  lastUpdatedSlot: BN;
  bump: number;
}

export interface IndexCommitmentAccount {
  epoch: BN;
  merkleRoot: number[];
  numDocuments: BN;
  lastCommittedSlot: BN;
  bump: number;
}

export type InitCuratorParams = {
  authority: PublicKey;
  stakeAmount: BN;
};

export type SubmitRatingParams = {
  authority: PublicKey;
  curator: PublicKey;
  prompt: PublicKey;
  ratingValue: number;
  reviewUri: string;
};

export type AddStakeParams = {
  authority: PublicKey;
  additionalStake: BN;
};

export type WithdrawStakeParams = {
  authority: PublicKey;
  withdrawAmount: BN;
};

export type ResolveSlashingParams = {
  resolver: PublicKey;
  curator: PublicKey;
  slashedAuthority: PublicKey;
  prompt: PublicKey;
  promptCuration: PublicKey;
  accurateCurator: PublicKey;
  ratingValue: number;
  consensusBp: BN;
};

export type UpdateReputationParams = {
  authority: PublicKey;
  curator: PublicKey;
  promptsPublished: BN;
  totalRatingFromPromptsBp: BN;
  curationsPerformed: BN;
  curationAccuracyBp: BN;
  consistencyBp: BN;
};

export type CommitIndexParams = {
  authority: PublicKey;
  epoch: BN;
  merkleRoot: number[];
  numDocuments: BN;
};

export function findCuratorPda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.CURATOR, authority.toBuffer()],
    new PublicKey(CURATION_PROGRAM_ID),
  );
}

export function findRatingPda(curator: PublicKey, prompt: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.RATING, curator.toBuffer(), prompt.toBuffer()],
    new PublicKey(CURATION_PROGRAM_ID),
  );
}

export function findPromptCurationPda(prompt: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.PROMPT_CURATION, prompt.toBuffer()],
    new PublicKey(CURATION_PROGRAM_ID),
  );
}

export function findReputationPda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.REPUTATION, authority.toBuffer()],
    new PublicKey(CURATION_PROGRAM_ID),
  );
}

export function findIndexCommitmentPda(epoch: BN): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(epoch.toString()));
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.INDEX_COMMITMENT, buf],
    new PublicKey(CURATION_PROGRAM_ID),
  );
}

export function computeDecayedWeight(
  curatorStakeAtSubmission: BN,
  submittedSlot: BN,
  currentSlot: BN,
  halfLifeSlots: BN = new BN(19_440_000),
): BN {
  const elapsed = currentSlot.sub(submittedSlot);
  if (elapsed.lte(new BN(0))) return curatorStakeAtSubmission;

  const halvings = elapsed.div(halfLifeSlots);
  if (halvings.gte(new BN(64))) return new BN(0);

  const weight = curatorStakeAtSubmission.shrn(halvings.toNumber());

  const remainder = elapsed.mod(halfLifeSlots);
  if (remainder.gt(new BN(0)) && weight.gt(new BN(0))) {
    const linearDecay = weight
      .mul(halfLifeSlots.sub(remainder))
      .div(halfLifeSlots);
    return linearDecay;
  }

  return weight;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProgram = any;

export class CurationClient {
  private program: AnyProgram;

  constructor(provider: AnchorProvider) {
    this.program = new Program(idl, provider);
  }

  get programId(): PublicKey {
    return this.program.programId;
  }

  async initCurator(params: InitCuratorParams): Promise<TransactionSignature> {
    const [curatorPda] = findCuratorPda(params.authority);
    return this.program.methods
      .initCurator(params.stakeAmount)
      .accounts({
        curator: curatorPda,
        authority: params.authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async initReputation(authority: PublicKey): Promise<TransactionSignature> {
    const [reputationPda] = findReputationPda(authority);
    return this.program.methods
      .initReputation()
      .accounts({
        reputation: reputationPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async submitRating(params: SubmitRatingParams): Promise<TransactionSignature> {
    const [ratingPda] = findRatingPda(params.curator, params.prompt);
    const [promptCurationPda] = findPromptCurationPda(params.prompt);
    return this.program.methods
      .submitRating(params.ratingValue, params.reviewUri)
      .accounts({
        curator: params.curator,
        rating: ratingPda,
        promptCuration: promptCurationPda,
        prompt: params.prompt,
        authority: params.authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async addStake(params: AddStakeParams): Promise<TransactionSignature> {
    const [curatorPda] = findCuratorPda(params.authority);
    return this.program.methods
      .addStake(params.additionalStake)
      .accounts({
        curator: curatorPda,
        authority: params.authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async withdrawStake(params: WithdrawStakeParams): Promise<TransactionSignature> {
    const [curatorPda] = findCuratorPda(params.authority);
    return this.program.methods
      .withdrawStake(params.withdrawAmount)
      .accounts({
        curator: curatorPda,
        authority: params.authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async resolveSlashing(params: ResolveSlashingParams): Promise<TransactionSignature> {
    return this.program.methods
      .resolveSlashing(params.ratingValue, params.consensusBp)
      .accounts({
        curator: params.curator,
        promptCuration: params.promptCuration,
        prompt: params.prompt,
        slashedAuthority: params.slashedAuthority,
        accurateCurator: params.accurateCurator,
        resolver: params.resolver,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async updateReputation(params: UpdateReputationParams): Promise<TransactionSignature> {
    const [reputationPda] = findReputationPda(params.authority);
    return this.program.methods
      .updateReputation(
        params.promptsPublished,
        params.totalRatingFromPromptsBp,
        params.curationsPerformed,
        params.curationAccuracyBp,
        params.consistencyBp,
      )
      .accounts({
        reputation: reputationPda,
        curator: params.curator,
        authority: params.authority,
      })
      .rpc();
  }

  async commitIndex(params: CommitIndexParams): Promise<TransactionSignature> {
    const [indexCommitmentPda] = findIndexCommitmentPda(params.epoch);
    return this.program.methods
      .commitIndex(params.epoch, params.merkleRoot, params.numDocuments)
      .accounts({
        indexCommitment: indexCommitmentPda,
        authority: params.authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async refreshCuration(prompt: PublicKey): Promise<TransactionSignature> {
    const [promptCurationPda] = findPromptCurationPda(prompt);
    return this.program.methods
      .refreshCuration()
      .accounts({
        promptCuration: promptCurationPda,
        prompt,
      })
      .rpc();
  }

  async fetchCurator(address: PublicKey): Promise<CuratorAccount> {
    return this.program.account.curator.fetch(address);
  }

  async fetchRating(address: PublicKey): Promise<RatingAccount> {
    return this.program.account.rating.fetch(address);
  }

  async fetchPromptCuration(address: PublicKey): Promise<PromptCurationAccount> {
    return this.program.account.promptCuration.fetch(address);
  }

  async fetchReputation(address: PublicKey): Promise<UserReputationAccount> {
    return this.program.account.userReputation.fetch(address);
  }

  async fetchIndexCommitment(address: PublicKey): Promise<IndexCommitmentAccount> {
    return this.program.account.indexCommitment.fetch(address);
  }

  async fetchRatingsByCurator(curator: PublicKey): Promise<Array<{ publicKey: PublicKey; account: RatingAccount }>> {
    const ratings = await this.program.account.rating.all([
      { memcmp: { offset: 8, bytes: curator.toBase58() } },
    ]);
    return ratings.map((r: { publicKey: PublicKey; account: RatingAccount }) => ({
      publicKey: r.publicKey,
      account: r.account,
    }));
  }

  async fetchRatingsByPrompt(prompt: PublicKey): Promise<Array<{ publicKey: PublicKey; account: RatingAccount }>> {
    const ratings = await this.program.account.rating.all([
      { memcmp: { offset: 40, bytes: prompt.toBase58() } },
    ]);
    return ratings.map((r: { publicKey: PublicKey; account: RatingAccount }) => ({
      publicKey: r.publicKey,
      account: r.account,
    }));
  }

  async fetchCuratorsByAuthority(authority: PublicKey): Promise<Array<{ publicKey: PublicKey; account: CuratorAccount }>> {
    const curators = await this.program.account.curator.all([
      { memcmp: { offset: 8, bytes: authority.toBase58() } },
    ]);
    return curators.map((c: { publicKey: PublicKey; account: CuratorAccount }) => ({
      publicKey: c.publicKey,
      account: c.account,
    }));
  }
}
