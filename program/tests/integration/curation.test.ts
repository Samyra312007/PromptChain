import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect, use } from "chai";
import { findCuratorPda, findRatingPda, findPromptCurationPda, findReputationPda, findIndexCommitmentPda } from "@promptchain/curation";

const CURATION_PROGRAM_ID = new PublicKey("2eWqZR6HriWjKJs5MozSZKERxP98JM7FEwn8FA7Hh1cK");

describe("Curation Engine", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.promptchain_curation as Program;
  const authority = provider.wallet.publicKey;

  it("init_curator: creates a curator with stake", async () => {
    const stakeAmount = new anchor.BN(LAMPORTS_PER_SOL * 5);
    const [curatorPda] = findCuratorPda(authority);

    await program.methods
      .initCurator(stakeAmount)
      .accounts({
        curator: curatorPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const curator = await program.account.curator.fetch(curatorPda);
    expect(curator.authority.toString()).to.equal(authority.toString());
    expect(curator.stakeAmount.eq(stakeAmount)).to.be.true;
    expect(curator.totalRatings.toNumber()).to.equal(0);
  });

  it("init_curator: fails with insufficient stake", async () => {
    const smallStake = new anchor.BN(LAMPORTS_PER_SOL / 2);
    const [curatorPda] = findCuratorPda(authority);

    try {
      await program.methods
        .initCurator(smallStake)
        .accounts({
          curator: curatorPda,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.message).to.include("InsufficientStake");
    }
  });

  it("init_reputation: creates a reputation account", async () => {
    const [reputationPda] = findReputationPda(authority);

    await program.methods
      .initReputation()
      .accounts({
        reputation: reputationPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const rep = await program.account.userReputation.fetch(reputationPda);
    expect(rep.authority.toString()).to.equal(authority.toString());
    expect(rep.promptsPublished.toNumber()).to.equal(0);
    expect(rep.overallScoreBp.toNumber()).to.equal(0);
  });

  it("add_stake: increases stake", async () => {
    const additionalStake = new anchor.BN(LAMPORTS_PER_SOL * 2);
    const [curatorPda] = findCuratorPda(authority);

    const before = await program.account.curator.fetch(curatorPda);
    const beforeStake = before.stakeAmount.toNumber();

    await program.methods
      .addStake(additionalStake)
      .accounts({
        curator: curatorPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const after = await program.account.curator.fetch(curatorPda);
    expect(after.stakeAmount.toNumber()).to.equal(beforeStake + LAMPORTS_PER_SOL * 2);
  });

  it("submit_rating: creates rating and updates prompt curation", async () => {
    const mintKeypair = Keypair.generate();
    const promptAddress = mintKeypair.publicKey;
    const [curatorPda] = findCuratorPda(authority);
    const [ratingPda] = findRatingPda(curatorPda, promptAddress);
    const [promptCurationPda] = findPromptCurationPda(promptAddress);

    await program.methods
      .submitRating(5, "")
      .accounts({
        curator: curatorPda,
        rating: ratingPda,
        promptCuration: promptCurationPda,
        prompt: promptAddress,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const rating = await program.account.rating.fetch(ratingPda);
    expect(rating.ratingValue).to.equal(5);
    expect(rating.curator.toString()).to.equal(curatorPda.toString());
    expect(rating.prompt.toString()).to.equal(promptAddress.toString());

    const curation = await program.account.promptCuration.fetch(promptCurationPda);
    expect(curation.totalRatings.toNumber()).to.equal(1);
    expect(curation.totalWeight.gt(new anchor.BN(0))).to.be.true;
    expect(curation.averageRatingBp.toNumber()).to.be.greaterThan(0);

    const curator = await program.account.curator.fetch(curatorPda);
    expect(curator.totalRatings.toNumber()).to.equal(1);
  });

  it("submit_rating: fails with invalid rating value", async () => {
    const mintKeypair = Keypair.generate();
    const promptAddress = mintKeypair.publicKey;
    const [curatorPda] = findCuratorPda(authority);
    const [ratingPda] = findRatingPda(curatorPda, promptAddress);
    const [promptCurationPda] = findPromptCurationPda(promptAddress);

    try {
      await program.methods
        .submitRating(6, "")
        .accounts({
          curator: curatorPda,
          rating: ratingPda,
          promptCuration: promptCurationPda,
          prompt: promptAddress,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.message).to.include("InvalidRatingValue");
    }
  });

  it("update_reputation: updates reputation scores", async () => {
    const [curatorPda] = findCuratorPda(authority);
    const [reputationPda] = findReputationPda(authority);

    await program.methods
      .updateReputation(
        new anchor.BN(5),
        new anchor.BN(25000),
        new anchor.BN(10),
        new anchor.BN(8000),
        new anchor.BN(7000),
      )
      .accounts({
        reputation: reputationPda,
        curator: curatorPda,
        authority,
      })
      .rpc();

    const rep = await program.account.userReputation.fetch(reputationPda);
    expect(rep.promptsPublished.toNumber()).to.equal(5);
    expect(rep.curationsPerformed.toNumber()).to.equal(10);
    expect(rep.overallScoreBp.toNumber()).to.be.greaterThan(0);
    expect(rep.overallScoreBp.toNumber()).to.be.lessThanOrEqual(10000);
  });

  it("withdraw_stake: reduces stake", async () => {
    const withdrawAmount = new anchor.BN(LAMPORTS_PER_SOL);
    const [curatorPda] = findCuratorPda(authority);

    const before = await program.account.curator.fetch(curatorPda);
    const beforeStake = before.stakeAmount.toNumber();

    await program.methods
      .withdrawStake(withdrawAmount)
      .accounts({
        curator: curatorPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const after = await program.account.curator.fetch(curatorPda);
    expect(after.stakeAmount.toNumber()).to.equal(beforeStake - LAMPORTS_PER_SOL);
  });

  it("refresh_curation: refreshes prompt curation", async () => {
    const mintKeypair = Keypair.generate();
    const promptAddress = mintKeypair.publicKey;
    const [promptCurationPda] = findPromptCurationPda(promptAddress);

    await program.methods
      .refreshCuration()
      .accounts({
        promptCuration: promptCurationPda,
        prompt: promptAddress,
      })
      .rpc();

    const curation = await program.account.promptCuration.fetch(promptCurationPda);
    expect(curation.averageRatingBp.toNumber()).to.be.greaterThanOrEqual(0);
  });

  it("commit_index: commits a merkle root", async () => {
    const epoch = new anchor.BN(1);
    const merkleRoot = Array(32).fill(0).map((_, i) => i);
    const numDocuments = new anchor.BN(42);
    const [indexPda] = findIndexCommitmentPda(epoch);

    await program.methods
      .commitIndex(epoch, merkleRoot, numDocuments)
      .accounts({
        indexCommitment: indexPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const commitment = await program.account.indexCommitment.fetch(indexPda);
    expect(commitment.epoch.toNumber()).to.equal(1);
    expect(commitment.numDocuments.toNumber()).to.equal(42);
  });

  it("complete curation flow: init → rate → refresh → info", async () => {
    const wallet = Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL * 10);
    await provider.connection.confirmTransaction(airdropSig);

    const newProvider = new AnchorProvider(
      provider.connection,
      new Wallet(wallet),
      { commitment: "confirmed" },
    );
    const newProgram = new Program(program.idl, newProvider) as Program;
    const newAuthority = wallet.publicKey;

    const stakeAmount = new anchor.BN(LAMPORTS_PER_SOL * 3);
    const [curatorPda] = findCuratorPda(newAuthority);

    // Init curator
    await newProgram.methods
      .initCurator(stakeAmount)
      .accounts({
        curator: curatorPda,
        authority: newAuthority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    let curator = await newProgram.account.curator.fetch(curatorPda);
    expect(curator.stakeAmount.eq(stakeAmount)).to.be.true;

    // Init reputation
    const [reputationPda] = findReputationPda(newAuthority);
    await newProgram.methods
      .initReputation()
      .accounts({
        reputation: reputationPda,
        authority: newAuthority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Rate a prompt
    const promptKeypair = Keypair.generate();
    const promptAddr = promptKeypair.publicKey;
    const [promptCurationPda] = findPromptCurationPda(promptAddr);

    for (let i = 0; i < 3; i++) {
      const [ratingPda] = findRatingPda(curatorPda, promptAddr);
      try {
        await newProgram.methods
          .submitRating(4 + (i % 2), "")
          .accounts({
            curator: curatorPda,
            rating: ratingPda,
            promptCuration: promptCurationPda,
            prompt: promptAddr,
            authority: newAuthority,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      } catch {
        // rating already exists, skip
      }
    }

    // Refresh curation
    await newProgram.methods
      .refreshCuration()
      .accounts({
        promptCuration: promptCurationPda,
        prompt: promptAddr,
      })
      .rpc();

    const curation = await newProgram.account.promptCuration.fetch(promptCurationPda);
    expect(curation.totalRatings.toNumber()).to.be.greaterThanOrEqual(1);
  });
});
