import { PublicKey, SystemProgram, TransactionSignature } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { TOKEN_ECONOMICS_PROGRAM_ID, PDA_SEEDS, TOKEN_CONSTANTS } from "@promptchain/schema";

import idl from "./idl/promptchain_token_economics.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProgram = any;

export interface TokenConfigAccount {
  authority: PublicKey;
  mint: PublicKey;
  totalEmitted: BN;
  currentEmissionYear: BN;
  lastEmissionTs: BN;
  ecosystemFundTokenAccount: PublicKey;
  creatorRewardPoolTokenAccount: PublicKey;
  curatorRewardPoolTokenAccount: PublicKey;
  bump: number;
}

export interface StakePositionAccount {
  authority: PublicKey;
  amount: BN;
  bump: number;
}

export interface VestingAccount {
  beneficiary: PublicKey;
  totalAmount: BN;
  releasedAmount: BN;
  startTs: BN;
  cliffDurationSecs: BN;
  totalDurationSecs: BN;
  bump: number;
}

export interface RewardClaimAccount {
  claimant: PublicKey;
  totalClaimed: BN;
  lastClaimTs: BN;
  bump: number;
}

export type InitTokenConfigParams = {
  authority: PublicKey;
};

export type ClaimCreatorRewardParams = {
  authority: PublicKey;
  amount: BN;
};

export type ClaimCuratorRewardParams = {
  authority: PublicKey;
  amount: BN;
};

export type StakeTokensParams = {
  authority: PublicKey;
  amount: BN;
};

export type WithdrawStakeParams = {
  authority: PublicKey;
  amount: BN;
};

export type InitVestingParams = {
  authority: PublicKey;
  beneficiary: PublicKey;
  totalAmount: BN;
  startTs: BN;
  cliffDurationSecs: BN;
  totalDurationSecs: BN;
};

export function findTokenConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.TOKEN_CONFIG],
    new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
  );
}

export function findTokenMintPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.TOKEN_MINT],
    new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
  );
}

export function findEcosystemFundPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.ECOSYSTEM_FUND],
    new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
  );
}

export function findCreatorRewardPoolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.CREATOR_REWARD_POOL],
    new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
  );
}

export function findCuratorRewardPoolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.CURATOR_REWARD_POOL],
    new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
  );
}

export function findStakeVaultPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.STAKE_VAULT],
    new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
  );
}

export function findStakePositionPda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.STAKE_POSITION, authority.toBuffer()],
    new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
  );
}

export function findVestingPda(beneficiary: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.VESTING, beneficiary.toBuffer()],
    new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
  );
}

export function findCreatorRewardClaimPda(creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("reward_claim_creator"), creator.toBuffer()],
    new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
  );
}

export function findCuratorRewardClaimPda(curator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("reward_claim_curator"), curator.toBuffer()],
    new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
  );
}

export class TokenEconomicsClient {
  private program: AnyProgram;

  constructor(provider: AnchorProvider) {
    this.program = new Program(idl, provider);
  }

  get programId(): PublicKey {
    return this.program.programId;
  }

  async initTokenConfig(params: InitTokenConfigParams): Promise<TransactionSignature> {
    const [tokenConfig] = findTokenConfigPda();
    const [mint] = findTokenMintPda();
    const [ecosystemFund] = findEcosystemFundPda();
    const [creatorRewardPool] = findCreatorRewardPoolPda();
    const [curatorRewardPool] = findCuratorRewardPoolPda();
    const [stakeVault] = findStakeVaultPda();
    return this.program.methods
      .initTokenConfig()
      .accounts({
        tokenConfig,
        mint,
        ecosystemFund,
        creatorRewardPool,
        curatorRewardPool,
        stakeVault,
        authority: params.authority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async claimCreatorReward(params: ClaimCreatorRewardParams): Promise<TransactionSignature> {
    const [tokenConfig] = findTokenConfigPda();
    const [creatorRewardPool] = findCreatorRewardPoolPda();
    const [rewardClaim] = findCreatorRewardClaimPda(params.authority);
    const [mint] = findTokenMintPda();

    const creatorTokenAccount = await this.findOrCreateAssociatedTokenAccount(
      params.authority,
      mint,
    );

    return this.program.methods
      .claimCreatorReward(params.amount)
      .accounts({
        tokenConfig,
        creatorRewardPool,
        rewardClaim,
        creatorTokenAccount,
        creator: params.authority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async claimCuratorReward(params: ClaimCuratorRewardParams): Promise<TransactionSignature> {
    const [tokenConfig] = findTokenConfigPda();
    const [curatorRewardPool] = findCuratorRewardPoolPda();
    const [rewardClaim] = findCuratorRewardClaimPda(params.authority);
    const [mint] = findTokenMintPda();

    const curatorTokenAccount = await this.findOrCreateAssociatedTokenAccount(
      params.authority,
      mint,
    );

    return this.program.methods
      .claimCuratorReward(params.amount)
      .accounts({
        tokenConfig,
        curatorRewardPool,
        rewardClaim,
        curatorTokenAccount,
        curator: params.authority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async stakeTokens(params: StakeTokensParams): Promise<TransactionSignature> {
    const [stakePosition] = findStakePositionPda(params.authority);
    const [stakeVault] = findStakeVaultPda();
    const [mint] = findTokenMintPda();

    const userTokenAccount = await this.findOrCreateAssociatedTokenAccount(
      params.authority,
      mint,
    );

    return this.program.methods
      .stakeTokens(params.amount)
      .accounts({
        stakePosition,
        stakeVault,
        userTokenAccount,
        authority: params.authority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async withdrawStake(params: WithdrawStakeParams): Promise<TransactionSignature> {
    const [stakePosition] = findStakePositionPda(params.authority);
    const [stakeVault] = findStakeVaultPda();
    const [tokenConfig] = findTokenConfigPda();
    const [mint] = findTokenMintPda();

    const userTokenAccount = await this.findOrCreateAssociatedTokenAccount(
      params.authority,
      mint,
    );

    return this.program.methods
      .withdrawStake(params.amount)
      .accounts({
        stakePosition,
        stakeVault,
        tokenConfig,
        userTokenAccount,
        authority: params.authority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  async initVesting(params: InitVestingParams): Promise<TransactionSignature> {
    const [vesting] = findVestingPda(params.beneficiary);
    return this.program.methods
      .initVesting(
        params.totalAmount,
        params.startTs,
        params.cliffDurationSecs,
        params.totalDurationSecs,
      )
      .accounts({
        vesting,
        beneficiary: params.beneficiary,
        authority: params.authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async claimVested(authority: PublicKey): Promise<TransactionSignature> {
    const [vesting] = findVestingPda(authority);
    const [tokenConfig] = findTokenConfigPda();
    const [stakeVault] = findStakeVaultPda();
    const [mint] = findTokenMintPda();

    const beneficiaryTokenAccount = await this.findOrCreateAssociatedTokenAccount(
      authority,
      mint,
    );

    return this.program.methods
      .claimVested()
      .accounts({
        vesting,
        tokenConfig,
        stakeVault,
        beneficiaryTokenAccount,
        beneficiary: authority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  async fetchTokenConfig(): Promise<TokenConfigAccount> {
    const [address] = findTokenConfigPda();
    return this.program.account.tokenConfig.fetch(address);
  }

  async fetchStakePosition(authority: PublicKey): Promise<StakePositionAccount> {
    const [address] = findStakePositionPda(authority);
    return this.program.account.stakePosition.fetch(address);
  }

  async fetchVesting(beneficiary: PublicKey): Promise<VestingAccount> {
    const [address] = findVestingPda(beneficiary);
    return this.program.account.vesting.fetch(address);
  }

  async fetchRewardClaim(type: "creator" | "curator", authority: PublicKey): Promise<RewardClaimAccount> {
    const pdaFn = type === "creator" ? findCreatorRewardClaimPda : findCuratorRewardClaimPda;
    const [address] = pdaFn(authority);
    return this.program.account.rewardClaim.fetch(address);
  }

  private async findOrCreateAssociatedTokenAccount(
    owner: PublicKey,
    mint: PublicKey,
  ): Promise<PublicKey> {
    const { getOrCreateAssociatedTokenAccount } = await import(
      "@solana/spl-token"
    );
    const account = await getOrCreateAssociatedTokenAccount(
      this.program.provider.connection,
      // We need a payer here; in practice the SDK user's wallet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.program.provider as any).wallet,
      mint,
      owner,
    );
    return account.address;
  }
}

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
