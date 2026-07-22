import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { CurationClient, findCuratorPda, findPromptCurationPda, findReputationPda } from "@promptchain/curation";
import { CURATION_CONSTANTS } from "@promptchain/schema";
import { getProvider } from "../index";

export async function initCuratorCommand(
  stakeSol: string,
  options: { keypair?: string; rpcUrl: string },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const client = new CurationClient(provider);
    const authority = provider.wallet.publicKey;

    const stakeLamports = parseFloat(stakeSol) * 1_000_000_000;
    if (stakeLamports < CURATION_CONSTANTS.MIN_STAKE_LAMPORTS) {
      console.error(`Minimum stake is ${CURATION_CONSTANTS.MIN_STAKE_LAMPORTS / 1_000_000_000} SOL`);
      process.exit(1);
    }

    const sig = await client.initCurator({
      authority,
      stakeAmount: new BN(stakeLamports),
    });

    const [curatorPda] = findCuratorPda(authority);
    console.log("Curator initialized!");
    console.log("  Curator PDA:", curatorPda.toBase58());
    console.log("  Stake:", stakeSol, "SOL");
    console.log("  Signature:", sig);
  } catch (err) {
    console.error("Failed to initialize curator:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function rateCommand(
  promptAddress: string,
  ratingStr: string,
  options: { keypair?: string; rpcUrl: string; review?: string },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const client = new CurationClient(provider);
    const authority = provider.wallet.publicKey;

    const ratingValue = parseInt(ratingStr);
    if (ratingValue < CURATION_CONSTANTS.MIN_RATING || ratingValue > CURATION_CONSTANTS.MAX_RATING) {
      console.error(`Rating must be between ${CURATION_CONSTANTS.MIN_RATING} and ${CURATION_CONSTANTS.MAX_RATING}`);
      process.exit(1);
    }

    const prompt = new PublicKey(promptAddress);
    const [curatorPda] = findCuratorPda(authority);

    const sig = await client.submitRating({
      authority,
      curator: curatorPda,
      prompt,
      ratingValue,
      reviewUri: options.review || "",
    });

    const [promptCurationPda] = findPromptCurationPda(prompt);
    console.log("Rating submitted!");
    console.log("  Prompt:", promptAddress);
    console.log("  Rating:", ratingValue, "/ 5");
    console.log("  Prompt Curation:", promptCurationPda.toBase58());
    console.log("  Signature:", sig);
  } catch (err) {
    console.error("Failed to submit rating:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function curatorStakeCommand(
  action: string,
  amountSol: string,
  options: { keypair?: string; rpcUrl: string },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const client = new CurationClient(provider);
    const authority = provider.wallet.publicKey;

    const amountLamports = parseFloat(amountSol) * 1_000_000_000;

    if (action === "add") {
      const sig = await client.addStake({
        authority,
        additionalStake: new BN(amountLamports),
      });
      console.log(`Added ${amountSol} SOL to stake`);
      console.log("  Signature:", sig);
    } else if (action === "withdraw") {
      const sig = await client.withdrawStake({
        authority,
        withdrawAmount: new BN(amountLamports),
      });
      console.log(`Withdrew ${amountSol} SOL from stake`);
      console.log("  Signature:", sig);
    } else {
      console.error("Usage: promptchain curator stake <add|withdraw> <amount>");
      process.exit(1);
    }
  } catch (err) {
    console.error("Failed to update stake:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function curatorInfoCommand(
  options: { keypair?: string; rpcUrl: string },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const client = new CurationClient(provider);
    const authority = provider.wallet.publicKey;

    const curators = await client.fetchCuratorsByAuthority(authority);
    if (curators.length === 0) {
      console.log("No curator account found. Use `promptchain curator init` to create one.");
      return;
    }

    for (const c of curators) {
      const stakeSol = c.account.stakeAmount.toNumber() / 1_000_000_000;
      console.log("Curator:", c.publicKey.toBase58());
      console.log("  Stake:", stakeSol, "SOL");
      console.log("  Total Ratings:", c.account.totalRatings.toString());
      console.log("  Accuracy:", (c.account.accuracyScoreBp.toNumber() / 100).toFixed(2), "%");
      console.log("  Last Rating Slot:", c.account.lastRatingSlot.toString());
    }

    const [reputationPda] = findReputationPda(authority);
    try {
      const rep = await client.fetchReputation(reputationPda);
      console.log("\nReputation:", reputationPda.toBase58());
      console.log("  Overall Score:", (rep.overallScoreBp.toNumber() / 100).toFixed(2), "%");
      console.log("  Prompts Published:", rep.promptsPublished.toString());
      console.log("  Curations Performed:", rep.curationsPerformed.toString());
      console.log("  Curation Accuracy:", (rep.curationAccuracyBp.toNumber() / 100).toFixed(2), "%");
    } catch {
      console.log("\nNo reputation account found. Initialize with `promptchain curator init-rep`");
    }
  } catch (err) {
    console.error("Failed to fetch curator info:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function initReputationCommand(
  options: { keypair?: string; rpcUrl: string },
): Promise<void> {
  try {
    const provider = await getProvider(options.keypair, options.rpcUrl);
    const client = new CurationClient(provider);
    const authority = provider.wallet.publicKey;

    const sig = await client.initReputation(authority);
    const [reputationPda] = findReputationPda(authority);
    console.log("Reputation account initialized!");
    console.log("  Reputation PDA:", reputationPda.toBase58());
    console.log("  Signature:", sig);
  } catch (err) {
    console.error("Failed to initialize reputation:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export async function promptCurationCommand(
  promptAddress: string,
  options: { rpcUrl: string },
): Promise<void> {
  try {
    const rpcUrl = options.rpcUrl || "http://127.0.0.1:8899";
    const connection = new (await import("@solana/web3.js")).Connection(rpcUrl);
    const provider = new (await import("@coral-xyz/anchor")).AnchorProvider(
      connection,
      {} as never,
      { commitment: "confirmed" },
    );
    const client = new CurationClient(provider);

    const prompt = new PublicKey(promptAddress);
    const [promptCurationPda] = findPromptCurationPda(prompt);

    try {
      const curation = await client.fetchPromptCuration(promptCurationPda);
      const avgRating = curation.averageRatingBp.toNumber() / 100;
      console.log("Prompt Curation:", promptCurationPda.toBase58());
      console.log("  Prompt:", promptAddress);
      console.log("  Total Ratings:", curation.totalRatings.toString());
      console.log("  Average Rating:", avgRating.toFixed(2), "%");
      console.log("  Weighted Sum:", curation.weightedSum.toString());
      console.log("  Total Weight:", curation.totalWeight.toString());
    } catch {
      console.log("No curation data for this prompt yet.");
    }
  } catch (err) {
    console.error("Failed to fetch curation:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
