import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, BN, workspace } from "@coral-xyz/anchor";
import {
  TOKEN_ECONOMICS_PROGRAM_ID,
  PDA_SEEDS,
} from "@promptchain/schema";

describe("Token Economics Program", () => {
  const provider = AnchorProvider.env();
  const program = workspace.PromptchainTokenEconomics;

  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

  function findTokenConfigPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.TOKEN_CONFIG],
      new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
    );
  }

  function findTokenMintPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.TOKEN_MINT],
      new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
    );
  }

  function findEcosystemFundPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.ECOSYSTEM_FUND],
      new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
    );
  }

  function findCreatorRewardPoolPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.CREATOR_REWARD_POOL],
      new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
    );
  }

  function findCuratorRewardPoolPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.CURATOR_REWARD_POOL],
      new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
    );
  }

  function findStakeVaultPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.STAKE_VAULT],
      new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
    );
  }

  function findStakePositionPda(authority: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.STAKE_POSITION, authority.toBuffer()],
      new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
    );
  }

  function findVestingPda(beneficiary: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.VESTING, beneficiary.toBuffer()],
      new PublicKey(TOKEN_ECONOMICS_PROGRAM_ID),
    );
  }

  it("can initialize token config", async () => {
    const [tokenConfig] = findTokenConfigPda();
    const [mint] = findTokenMintPda();
    const [ecosystemFund] = findEcosystemFundPda();
    const [creatorRewardPool] = findCreatorRewardPoolPda();
    const [curatorRewardPool] = findCuratorRewardPoolPda();
    const [stakeVault] = findStakeVaultPda();

    await program.methods
      .initTokenConfig()
      .accounts({
        tokenConfig,
        mint,
        ecosystemFund,
        creatorRewardPool,
        curatorRewardPool,
        stakeVault,
        authority: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.tokenConfig.fetch(tokenConfig);
    expect(config.authority.toString()).to.equal(provider.wallet.publicKey.toString());
    expect(config.mint.toString()).to.equal(mint.toString());
    expect(config.totalEmitted.toNumber()).to.be.greaterThan(0);
    expect(config.currentEmissionYear.toNumber()).to.equal(1);
  });

  it("stores token config with correct PDAs", async () => {
    const [tokenConfig] = findTokenConfigPda();
    const [ecosystemFund] = findEcosystemFundPda();
    const [creatorRewardPool] = findCreatorRewardPoolPda();
    const [curatorRewardPool] = findCuratorRewardPoolPda();

    const config = await program.account.tokenConfig.fetch(tokenConfig);
    expect(config.ecosystemFundTokenAccount.toString()).to.equal(ecosystemFund.toString());
    expect(config.creatorRewardPoolTokenAccount.toString()).to.equal(creatorRewardPool.toString());
    expect(config.curatorRewardPoolTokenAccount.toString()).to.equal(curatorRewardPool.toString());
  });

  it("can initialize vesting schedule", async () => {
    const beneficiary = PublicKey.unique();
    const [vesting] = findVestingPda(beneficiary);
    const totalAmount = new BN(100_000_000_000);
    const startTs = new BN(Math.floor(Date.now() / 1000));
    const cliffDuration = new BN(31_536_000);
    const totalDuration = new BN(126_144_000);

    await program.methods
      .initVesting(totalAmount, startTs, cliffDuration, totalDuration)
      .accounts({
        vesting,
        beneficiary,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const vestingAccount = await program.account.vesting.fetch(vesting);
    expect(vestingAccount.beneficiary.toString()).to.equal(beneficiary.toString());
    expect(vestingAccount.totalAmount.toNumber()).to.equal(totalAmount.toNumber());
    expect(vestingAccount.releasedAmount.toNumber()).to.equal(0);
  });

  it("rejects zero-amount vesting", async () => {
    const beneficiary = PublicKey.unique();
    const [vesting] = findVestingPda(beneficiary);

    try {
      await program.methods
        .initVesting(new BN(0), new BN(0), new BN(31_536_000), new BN(126_144_000))
        .accounts({
          vesting,
          beneficiary,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.message).to.include("Amount must be positive");
    }
  });

  it("can stake tokens", async () => {
    const [stakePosition] = findStakePositionPda(provider.wallet.publicKey);
    const [stakeVault] = findStakeVaultPda();
    const [mint] = findTokenMintPda();

    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      mint,
      provider.wallet.publicKey,
    );

    await program.methods
      .stakeTokens(new BN(1_000_000_000))
      .accounts({
        stakePosition,
        stakeVault,
        userTokenAccount: userTokenAccount.address,
        authority: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const position = await program.account.stakePosition.fetch(stakePosition);
    expect(position.authority.toString()).to.equal(provider.wallet.publicKey.toString());
    expect(position.amount.toNumber()).to.be.greaterThan(0);
  });

  it("rejects zero-amount stake", async () => {
    const [stakePosition] = findStakePositionPda(provider.wallet.publicKey);
    const [stakeVault] = findStakeVaultPda();
    const [mint] = findTokenMintPda();

    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      mint,
      provider.wallet.publicKey,
    );

    try {
      await program.methods
        .stakeTokens(new BN(0))
        .accounts({
          stakePosition,
          stakeVault,
          userTokenAccount: userTokenAccount.address,
          authority: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.message).to.include("Amount must be positive");
    }
  });
});

// Helper to get or create ATA
async function getOrCreateAssociatedTokenAccount(
  connection: any,
  payer: any,
  mint: PublicKey,
  owner: PublicKey,
) {
  const { getOrCreateAssociatedTokenAccount } = await import("@solana/spl-token");
  return getOrCreateAssociatedTokenAccount(connection, payer, mint, owner);
}
