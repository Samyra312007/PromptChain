import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getProvider } from "../index";

export async function tokenInitCommand(
  _args: string[],
  options: { keypair?: string; rpcUrl: string },
) {
  const provider = await getProvider(options.keypair, options.rpcUrl);
  const { TokenEconomicsClient } = await import("@promptchain/token-economics");
  const client = new TokenEconomicsClient(provider);
  const authority = provider.wallet.publicKey;

  console.log(`Initializing $PROMPT token configuration...`);
  console.log(`Authority: ${authority.toBase58()}`);

  const sig = await client.initTokenConfig({ authority });
  console.log(`Token config initialized. Signature: ${sig}`);

  const config = await client.fetchTokenConfig();
  console.log(`\nToken Config:`);
  console.log(`  Mint: ${config.mint.toBase58()}`);
  console.log(`  Total Emitted: ${config.totalEmitted.toString()}`);
  console.log(`  Current Year: ${config.currentEmissionYear.toString()}`);
  process.exit(0);
}

export async function tokenStakeCommand(
  action: string,
  amountTokens: string,
  options: { keypair?: string; rpcUrl: string },
) {
  const provider = await getProvider(options.keypair, options.rpcUrl);
  const { TokenEconomicsClient } = await import("@promptchain/token-economics");
  const client = new TokenEconomicsClient(provider);
  const authority = provider.wallet.publicKey;

  const amount = new BN(parseFloat(amountTokens) * 1e9);

  if (action === "add") {
    console.log(`Staking ${amountTokens} $PROMPT tokens...`);
    const sig = await client.stakeTokens({ authority, amount });
    console.log(`Staked successfully. Signature: ${sig}`);
  } else if (action === "withdraw") {
    console.log(`Withdrawing ${amountTokens} $PROMPT tokens...`);
    const sig = await client.withdrawStake({ authority, amount });
    console.log(`Withdrawn successfully. Signature: ${sig}`);
  }

  const stake = await client.fetchStakePosition(authority);
  console.log(`\nStake Position:`);
  console.log(`  Amount: ${stake.amount.toString()} (${(stake.amount.toNumber() / 1e9).toFixed(4)} $PROMPT)`);
  process.exit(0);
}

export async function tokenVestingCommand(
  action: string,
  options: {
    keypair?: string;
    rpcUrl: string;
    beneficiary?: string;
    amount?: string;
    cliff?: string;
    duration?: string;
  },
) {
  const provider = await getProvider(options.keypair, options.rpcUrl);
  const { TokenEconomicsClient } = await import("@promptchain/token-economics");
  const client = new TokenEconomicsClient(provider);
  const authority = provider.wallet.publicKey;

  if (action === "init" && options.beneficiary && options.amount) {
    const beneficiary = new PublicKey(options.beneficiary);
    const totalAmount = new BN(parseFloat(options.amount) * 1e9);
    const cliffSecs = new BN(parseInt(options.cliff || "31536000"));
    const durationSecs = new BN(parseInt(options.duration || "126144000"));

    console.log(`Initializing vesting for ${options.beneficiary}...`);
    const sig = await client.initVesting({
      authority,
      beneficiary,
      totalAmount,
      startTs: new BN(Math.floor(Date.now() / 1000)),
      cliffDurationSecs: cliffSecs,
      totalDurationSecs: durationSecs,
    });
    console.log(`Vesting initialized. Signature: ${sig}`);
  } else if (action === "claim") {
    console.log(`Claiming vested tokens...`);
    const sig = await client.claimVested(authority);
    console.log(`Claimed successfully. Signature: ${sig}`);
  }

  if (authority) {
    try {
      const vesting = await client.fetchVesting(authority);
      console.log(`\nVesting Schedule:`);
      console.log(`  Total: ${vesting.totalAmount.toString()}`);
      console.log(`  Released: ${vesting.releasedAmount.toString()}`);
    } catch {
      console.log("No vesting schedule found for this wallet.");
    }
  }
  process.exit(0);
}

export async function tokenRewardCommand(
  role: string,
  amountTokens: string,
  options: { keypair?: string; rpcUrl: string },
) {
  const provider = await getProvider(options.keypair, options.rpcUrl);
  const { TokenEconomicsClient } = await import("@promptchain/token-economics");
  const client = new TokenEconomicsClient(provider);
  const authority = provider.wallet.publicKey;

  const amount = new BN(parseFloat(amountTokens) * 1e9);
  console.log(`Claiming ${amountTokens} $PROMPT as ${role} reward...`);

  const sig = role === "creator"
    ? await client.claimCreatorReward({ authority, amount })
    : await client.claimCuratorReward({ authority, amount });

  console.log(`Claimed successfully. Signature: ${sig}`);
  process.exit(0);
}

export async function tokenInfoCommand(
  options: { keypair?: string; rpcUrl: string },
) {
  const provider = await getProvider(options.keypair, options.rpcUrl);
  const { TokenEconomicsClient } = await import("@promptchain/token-economics");
  const client = new TokenEconomicsClient(provider);

  const config = await client.fetchTokenConfig();
  console.log(`$PROMPT Token Configuration:`);
  console.log(`  Mint: ${config.mint.toBase58()}`);
  console.log(`  Authority: ${config.authority.toBase58()}`);
  console.log(`  Total Emitted: ${config.totalEmitted.toString()}`);
  console.log(`  Current Year: ${config.currentEmissionYear.toString()}`);
  console.log(`  Ecosystem Fund: ${config.ecosystemFundTokenAccount.toBase58()}`);
  console.log(`  Creator Reward Pool: ${config.creatorRewardPoolTokenAccount.toBase58()}`);
  console.log(`  Curator Reward Pool: ${config.curatorRewardPoolTokenAccount.toBase58()}`);
  process.exit(0);
}
