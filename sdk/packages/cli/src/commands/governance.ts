import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getProvider } from "../index";

export async function daoInitCommand(
  options: {
    keypair?: string;
    rpcUrl: string;
    votingPeriod?: string;
    minPower?: string;
    quorum?: string;
    threshold?: string;
  },
) {
  const provider = await getProvider(options.keypair, options.rpcUrl);
  const { GovernanceClient } = await import("@promptchain/governance");
  const client = new GovernanceClient(provider);
  const authority = provider.wallet.publicKey;

  console.log(`Initializing DAO configuration...`);
  const sig = await client.initDao({
    authority,
    votingPeriodSecs: options.votingPeriod ? new BN(parseInt(options.votingPeriod)) : undefined,
    minVotingPowerTokens: options.minPower ? new BN(parseFloat(options.minPower) * 1e9) : undefined,
    quorumBp: options.quorum ? new BN(parseInt(options.quorum)) : undefined,
    passThresholdBp: options.threshold ? new BN(parseInt(options.threshold)) : undefined,
  });
  console.log(`DAO initialized. Signature: ${sig}`);

  const config = await client.fetchDaoConfig();
  console.log(`\nDAO Config:`);
  console.log(`  Authority: ${config.authority.toBase58()}`);
  console.log(`  Voting Period: ${config.votingPeriodSecs.toString()} seconds`);
  console.log(`  Min Voting Power: ${config.minVotingPowerTokens.toString()}`);
  console.log(`  Quorum: ${(config.quorumBp.toNumber() / 100).toFixed(2)}%`);
  console.log(`  Threshold: ${(config.passThresholdBp.toNumber() / 100).toFixed(2)}%`);
  process.exit(0);
}

export async function daoJoinCommand(
  tokenBalance: string,
  reputationBp: string,
  options: { keypair?: string; rpcUrl: string },
) {
  const provider = await getProvider(options.keypair, options.rpcUrl);
  const { GovernanceClient } = await import("@promptchain/governance");
  const client = new GovernanceClient(provider);
  const authority = provider.wallet.publicKey;

  console.log(`Registering as DAO member...`);
  const sig = await client.initMember({
    authority,
    tokenBalance: new BN(parseFloat(tokenBalance) * 1e9),
    reputationBp: new BN(parseInt(reputationBp)),
  });
  console.log(`Member registered. Signature: ${sig}`);
  process.exit(0);
}

export async function daoProposeCommand(
  description: string,
  options: { keypair?: string; rpcUrl: string; uri?: string },
) {
  const provider = await getProvider(options.keypair, options.rpcUrl);
  const { GovernanceClient } = await import("@promptchain/governance");
  const client = new GovernanceClient(provider);
  const proposer = provider.wallet.publicKey;

  console.log(`Creating proposal: "${description.substring(0, 60)}..."`);
  const sig = await client.createProposal({
    proposer,
    description,
    uri: options.uri || "",
  });
  console.log(`Proposal created. Signature: ${sig}`);
  process.exit(0);
}

export async function daoVoteCommand(
  proposalAddress: string,
  voteType: string,
  options: { keypair?: string; rpcUrl: string },
) {
  const provider = await getProvider(options.keypair, options.rpcUrl);
  const { GovernanceClient, VoteType } = await import("@promptchain/governance");
  const client = new GovernanceClient(provider);
  const voter = provider.wallet.publicKey;

  const normalized = voteType.toLowerCase();
  const type = normalized === "for" ? VoteType.For
    : normalized === "against" ? VoteType.Against
    : VoteType.Abstain;

  console.log(`Casting ${normalized} vote on proposal ${proposalAddress}...`);
  const sig = await client.castVote({
    voter,
    proposal: new PublicKey(proposalAddress),
    voteType: type,
  });
  console.log(`Vote cast. Signature: ${sig}`);
  process.exit(0);
}

export async function daoExecuteCommand(
  proposalAddress: string,
  options: { keypair?: string; rpcUrl: string },
) {
  const provider = await getProvider(options.keypair, options.rpcUrl);
  const { GovernanceClient } = await import("@promptchain/governance");
  const client = new GovernanceClient(provider);
  const executor = provider.wallet.publicKey;

  console.log(`Executing proposal ${proposalAddress}...`);
  const sig = await client.executeProposal(executor, new PublicKey(proposalAddress));
  console.log(`Proposal executed. Signature: ${sig}`);
  process.exit(0);
}

export async function daoInfoCommand(
  options: { keypair?: string; rpcUrl: string },
) {
  const provider = await getProvider(options.keypair, options.rpcUrl);
  const { GovernanceClient } = await import("@promptchain/governance");
  const client = new GovernanceClient(provider);
  const authority = provider.wallet.publicKey;

  const config = await client.fetchDaoConfig();
  console.log(`DAO Configuration:`);
  console.log(`  Authority: ${config.authority.toBase58()}`);
  console.log(`  Voting Period: ${config.votingPeriodSecs.toString()} seconds`);
  console.log(`  Min Voting Power: ${config.minVotingPowerTokens.toString()}`);
  console.log(`  Quorum: ${(config.quorumBp.toNumber() / 100).toFixed(2)}%`);
  console.log(`  Threshold: ${(config.passThresholdBp.toNumber() / 100).toFixed(2)}%`);
  console.log(`  Proposals Created: ${config.proposalCount.toString()}`);

  try {
    const member = await client.fetchMember(authority);
    console.log(`\nYour Membership:`);
    console.log(`  Token Balance: ${member.tokenBalance.toString()}`);
    console.log(`  Reputation: ${member.reputationBp.toString()} bp`);
    console.log(`  Registered: ${new Date(member.registeredTs.toNumber() * 1000).toISOString()}`);
  } catch {
    console.log("\nYou are not a registered DAO member.");
  }
  process.exit(0);
}
