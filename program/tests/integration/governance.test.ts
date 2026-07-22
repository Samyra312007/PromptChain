import { describe, it } from "mocha";
import { expect } from "chai";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, BN, workspace } from "@coral-xyz/anchor";
import { GOVERNANCE_PROGRAM_ID, PDA_SEEDS, GOVERNANCE_CONSTANTS } from "@promptchain/schema";

describe("Governance Program", () => {
  const provider = AnchorProvider.env();

  function findDaoConfigPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.DAO_CONFIG],
      new PublicKey(GOVERNANCE_PROGRAM_ID),
    );
  }

  function findMemberPda(authority: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.MEMBER, authority.toBuffer()],
      new PublicKey(GOVERNANCE_PROGRAM_ID),
    );
  }

  function findProposalPda(daoConfig: PublicKey, proposalId: BN): [PublicKey, number] {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(proposalId.toString()));
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.PROPOSAL, daoConfig.toBuffer(), buf],
      new PublicKey(GOVERNANCE_PROGRAM_ID),
    );
  }

  function findVotePda(voter: PublicKey, proposal: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.VOTE, voter.toBuffer(), proposal.toBuffer()],
      new PublicKey(GOVERNANCE_PROGRAM_ID),
    );
  }

  it("can initialize DAO configuration", async () => {
    const [daoConfig] = findDaoConfigPda();
    const program = workspace.PromptchainGovernance;

    const votingPeriod = new BN(604_800);
    const minPower = new BN(1_000_000_000);
    const quorum = new BN(1000);
    const threshold = new BN(5000);

    await program.methods
      .initDao(votingPeriod, minPower, quorum, threshold)
      .accounts({
        daoConfig,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.daoConfig.fetch(daoConfig);
    expect(config.authority.toString()).to.equal(provider.wallet.publicKey.toString());
    expect(config.votingPeriodSecs.toNumber()).to.equal(604_800);
    expect(config.minVotingPowerTokens.toNumber()).to.equal(1_000_000_000);
    expect(config.quorumBp.toNumber()).to.equal(1000);
    expect(config.passThresholdBp.toNumber()).to.equal(5000);
    expect(config.proposalCount.toNumber()).to.equal(0);
  });

  it("can register as a DAO member", async () => {
    const [daoConfig] = findDaoConfigPda();
    const [member] = findMemberPda(provider.wallet.publicKey);
    const program = workspace.PromptchainGovernance;

    await program.methods
      .initMember(new BN(10_000_000_000), new BN(5000))
      .accounts({
        daoConfig,
        member,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const memberAccount = await program.account.member.fetch(member);
    expect(memberAccount.authority.toString()).to.equal(provider.wallet.publicKey.toString());
    expect(memberAccount.tokenBalance.toNumber()).to.equal(10_000_000_000);
    expect(memberAccount.reputationBp.toNumber()).to.equal(5000);
  });

  it("can create a proposal", async () => {
    const [daoConfig] = findDaoConfigPda();
    const [member] = findMemberPda(provider.wallet.publicKey);
    const program = workspace.PromptchainGovernance;

    const config = await program.account.daoConfig.fetch(daoConfig);
    const proposalId = config.proposalCount;
    const [proposal] = findProposalPda(daoConfig, proposalId);

    await program.methods
      .createProposal("Test proposal description", "https://example.com/proposal/1")
      .accounts({
        daoConfig,
        member,
        proposal,
        proposer: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const proposalAccount = await program.account.proposal.fetch(proposal);
    expect(proposalAccount.proposer.toString()).to.equal(provider.wallet.publicKey.toString());
    expect(proposalAccount.description).to.equal("Test proposal description");
    expect(Object.keys(proposalAccount.status)[0]).to.equal("voting");

    const updatedConfig = await program.account.daoConfig.fetch(daoConfig);
    expect(updatedConfig.proposalCount.toNumber()).to.equal(1);
  });

  it("rejects proposal with too-long description", async () => {
    const [daoConfig] = findDaoConfigPda();
    const [member] = findMemberPda(provider.wallet.publicKey);
    const program = workspace.PromptchainGovernance;

    const config = await program.account.daoConfig.fetch(daoConfig);
    const proposalId = config.proposalCount;
    const [proposal] = findProposalPda(daoConfig, proposalId);

    const longDesc = "x".repeat(501);

    try {
      await program.methods
        .createProposal(longDesc, "")
        .accounts({
          daoConfig,
          member,
          proposal,
          proposer: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.message).to.include("Description too long");
    }
  });

  it("can cast a vote on a proposal", async () => {
    const [daoConfig] = findDaoConfigPda();
    const [member] = findMemberPda(provider.wallet.publicKey);
    const program = workspace.PromptchainGovernance;

    const config = await program.account.daoConfig.fetch(daoConfig);
    const proposalId = new BN(config.proposalCount.toNumber() - 1);
    const [proposal] = findProposalPda(daoConfig, proposalId);
    const [vote] = findVotePda(provider.wallet.publicKey, proposal);

    await program.methods
      .castVote({ for: {} })
      .accounts({
        daoConfig,
        proposal,
        member,
        vote,
        voter: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const voteAccount = await program.account.vote.fetch(vote);
    expect(voteAccount.voter.toString()).to.equal(provider.wallet.publicKey.toString());

    const updatedProposal = await program.account.proposal.fetch(proposal);
    expect(updatedProposal.forVotes.toNumber()).to.be.greaterThan(0);
  });

  it("rejects duplicate votes", async () => {
    const [daoConfig] = findDaoConfigPda();
    const [member] = findMemberPda(provider.wallet.publicKey);
    const program = workspace.PromptchainGovernance;

    const config = await program.account.daoConfig.fetch(daoConfig);
    const proposalId = new BN(config.proposalCount.toNumber() - 1);
    const [proposal] = findProposalPda(daoConfig, proposalId);
    const [vote] = findVotePda(provider.wallet.publicKey, proposal);

    try {
      await program.methods
        .castVote({ against: {} })
        .accounts({
          daoConfig,
          proposal,
          member,
          vote,
          voter: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.message).to.include("already in use");
    }
  });

  it("cannot execute an active proposal", async () => {
    const [daoConfig] = findDaoConfigPda();
    const program = workspace.PromptchainGovernance;

    const config = await program.account.daoConfig.fetch(daoConfig);
    const proposalId = new BN(config.proposalCount.toNumber() - 1);
    const [proposal] = findProposalPda(daoConfig, proposalId);

    try {
      await program.methods
        .executeProposal()
        .accounts({
          daoConfig,
          proposal,
          executor: provider.wallet.publicKey,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.message).to.include("Voting period has not ended");
    }
  });
});
