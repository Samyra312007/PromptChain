import { PublicKey, SystemProgram, TransactionSignature } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { GOVERNANCE_PROGRAM_ID, PDA_SEEDS, GOVERNANCE_CONSTANTS } from "@promptchain/schema";

import idl from "./idl/promptchain_governance.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProgram = any;

export enum VoteType {
  For = "for",
  Against = "against",
  Abstain = "abstain",
}

export enum ProposalStatus {
  Voting = "voting",
  Passed = "passed",
  Executed = "executed",
  Cancelled = "cancelled",
  Expired = "expired",
}

export interface DaoConfigAccount {
  authority: PublicKey;
  votingPeriodSecs: BN;
  minVotingPowerTokens: BN;
  quorumBp: BN;
  passThresholdBp: BN;
  proposalCount: BN;
  bump: number;
}

export interface ProposalAccount {
  proposer: PublicKey;
  daoConfig: PublicKey;
  proposalId: BN;
  description: string;
  uri: string;
  status: object;
  forVotes: BN;
  againstVotes: BN;
  abstainVotes: BN;
  createdTs: BN;
  votingEndTs: BN;
  executedTs: BN;
  bump: number;
}

export interface VoteAccount {
  voter: PublicKey;
  proposal: PublicKey;
  voteType: object;
  votingPower: BN;
  tokenWeight: BN;
  reputationWeight: BN;
  bump: number;
}

export interface MemberAccount {
  authority: PublicKey;
  tokenBalance: BN;
  reputationBp: BN;
  registeredTs: BN;
  bump: number;
}

export type InitDaoParams = {
  authority: PublicKey;
  votingPeriodSecs?: BN;
  minVotingPowerTokens?: BN;
  quorumBp?: BN;
  passThresholdBp?: BN;
};

export type CreateProposalParams = {
  proposer: PublicKey;
  description: string;
  uri: string;
};

export type CastVoteParams = {
  voter: PublicKey;
  proposal: PublicKey;
  voteType: VoteType;
};

export type InitMemberParams = {
  authority: PublicKey;
  tokenBalance: BN;
  reputationBp: BN;
};

export function findDaoConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.DAO_CONFIG],
    new PublicKey(GOVERNANCE_PROGRAM_ID),
  );
}

export function findMemberPda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.MEMBER, authority.toBuffer()],
    new PublicKey(GOVERNANCE_PROGRAM_ID),
  );
}

export function findProposalPda(daoConfig: PublicKey, proposalId: BN): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(proposalId.toString()));
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.PROPOSAL, daoConfig.toBuffer(), buf],
    new PublicKey(GOVERNANCE_PROGRAM_ID),
  );
}

export function findVotePda(voter: PublicKey, proposal: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.VOTE, voter.toBuffer(), proposal.toBuffer()],
    new PublicKey(GOVERNANCE_PROGRAM_ID),
  );
}

export class GovernanceClient {
  private program: AnyProgram;

  constructor(provider: AnchorProvider) {
    this.program = new Program(idl, provider);
  }

  get programId(): PublicKey {
    return this.program.programId;
  }

  async initDao(params: InitDaoParams): Promise<TransactionSignature> {
    const [daoConfig] = findDaoConfigPda();
    return this.program.methods
      .initDao(
        params.votingPeriodSecs ?? new BN(GOVERNANCE_CONSTANTS.DEFAULT_VOTING_PERIOD_SECS),
        params.minVotingPowerTokens ?? new BN(GOVERNANCE_CONSTANTS.DEFAULT_MIN_VOTING_POWER_TOKENS),
        params.quorumBp ?? new BN(GOVERNANCE_CONSTANTS.DEFAULT_QUORUM_BP),
        params.passThresholdBp ?? new BN(GOVERNANCE_CONSTANTS.DEFAULT_PASS_THRESHOLD_BP),
      )
      .accounts({
        daoConfig,
        authority: params.authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async initMember(params: InitMemberParams): Promise<TransactionSignature> {
    const [daoConfig] = findDaoConfigPda();
    const [member] = findMemberPda(params.authority);
    return this.program.methods
      .initMember(params.tokenBalance, params.reputationBp)
      .accounts({
        daoConfig,
        member,
        authority: params.authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async createProposal(params: CreateProposalParams): Promise<TransactionSignature> {
    const [daoConfig] = findDaoConfigPda();
    const [member] = findMemberPda(params.proposer);
    const daoConfigAccount = await this.fetchDaoConfig();
    const [proposal] = findProposalPda(daoConfig, daoConfigAccount.proposalCount);
    return this.program.methods
      .createProposal(params.description, params.uri)
      .accounts({
        daoConfig,
        member,
        proposal,
        proposer: params.proposer,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async castVote(params: CastVoteParams): Promise<TransactionSignature> {
    const [daoConfig] = findDaoConfigPda();
    const [member] = findMemberPda(params.voter);
    const [vote] = findVotePda(params.voter, params.proposal);
    return this.program.methods
      .castVote({ [params.voteType]: {} })
      .accounts({
        daoConfig,
        proposal: params.proposal,
        member,
        vote,
        voter: params.voter,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async executeProposal(executor: PublicKey, proposal: PublicKey): Promise<TransactionSignature> {
    const [daoConfig] = findDaoConfigPda();
    return this.program.methods
      .executeProposal()
      .accounts({
        daoConfig,
        proposal,
        executor,
      })
      .rpc();
  }

  async fetchDaoConfig(): Promise<DaoConfigAccount> {
    const [address] = findDaoConfigPda();
    return this.program.account.daoConfig.fetch(address);
  }

  async fetchMember(authority: PublicKey): Promise<MemberAccount> {
    const [address] = findMemberPda(authority);
    return this.program.account.member.fetch(address);
  }

  async fetchProposal(daoConfig: PublicKey, proposalId: BN): Promise<ProposalAccount> {
    const [address] = findProposalPda(daoConfig, proposalId);
    return this.program.account.proposal.fetch(address);
  }

  async fetchVote(voter: PublicKey, proposal: PublicKey): Promise<VoteAccount> {
    const [address] = findVotePda(voter, proposal);
    return this.program.account.vote.fetch(address);
  }
}
