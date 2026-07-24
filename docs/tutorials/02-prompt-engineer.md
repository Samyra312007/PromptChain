# Prompt Engineer — Fork, Version & Curate in 30 Minutes

> **Time:** ~30 minutes
> **Prerequisites:** Completed [Hello, Prompt](01-hello-prompt.md), devnet SOL

## Step 1: Find a Prompt to Fork

List prompts by a known author or search by tag:

```bash
promptchain list --author <wallet-address>
promptchain search --tag rust
```

Pick a prompt and note its CID. For this tutorial, we'll use `QmX8...Yz9K` from the previous tutorial.

## Step 2: Get the Prompt Details

```bash
promptchain get QmX8...Yz9K --verbose
```

This shows:
- Authority (current owner)
- CID and metadata URI
- License (if set)
- Version count and usage count
- Version history

## Step 3: Create a License

Prompts need licenses to be used by others. Create one:

```bash
promptchain license create \
  --name "MIT-Prompt" \
  --commercial \
  --attribution \
  --royalty 500
```

This creates a `License` PDA with:
- Commercial use: allowed
- Attribution: required
- Royalty: 5% (500 basis points)

Note the license address: `8xYz...AbC1`

Now attach it to your prompt using the promptchain client SDK:

```typescript
import { PromptChainClient } from '@promptchain/client';

const client = new PromptChainClient(provider);
await client.setLicense(promptAddress, licenseAddress);
```

## Step 4: Fork a Version

Improve the prompt and create a new version:

```bash
# Create a new version of the prompt text
echo "Write an optimized Rust greeting that uses format! macro..." > v2.prompt
```

```bash
promptchain publish v2.prompt --fork QmX8...Yz9K --changelog "v2: Use format! macro, add error handling"
```

Or using the SDK:

```typescript
const version = await client.createVersion(
  promptAddress,
  cid,         // CID of v2.prompt
  metadataUri, // URI to v2 metadata JSON
  changelogUri // URI to changelog
);
```

## Step 5: Rate a Prompt (Curate)

Become a curator by staking SOL:

```bash
promptchain curator init --stake 1.5
```

Rate the prompt:

```bash
promptchain curator rate QmX8...Yz9K --score 4 --review "Good starter prompt, could use more detail"
```

Each rating is weighted by your stake. If you have 1.5 SOL staked and rate 4/5, the weighted contribution is `1.5 * 4 = 6.0` toward the prompt's weighted average.

## Step 6: Check Curation Stats

```bash
promptchain curation info QmX8...Yz9K
```

Shows:
- Weighted average score (0-10000 bp)
- Total ratings
- Total weight
- Last updated slot

## Step 7: Check Your Reputation

```bash
promptchain curator info
```

Shows your:
- Total stake
- Number of ratings
- Accuracy score (how close your ratings are to consensus)
- Overall reputation score

## What You Learned

- **Creating licenses** — setting terms for prompt usage
- **Forking versions** — creating a DAG of prompt improvements
- **Curating** — staking SOL to signal quality
- **Reputation** — building a track record of accurate curation

## Next Steps

- [Build a custom client](03-protocol-developer.md)
- [Explore the DAO governance system] (TODO)
- [Run a P2P node](https://docs.promptchain.dev/networking)
