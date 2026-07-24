# Hello, Prompt — Publish Your First Prompt in 5 Minutes

> **Time:** ~5 minutes
> **Prerequisites:** Node.js 20+, a Solana wallet with devnet SOL

## Step 1: Install the CLI

```bash
npm install -g @promptchain/cli
```

Verify it works:

```bash
promptchain --version
# → 0.1.0
```

## Step 2: Fund Your Wallet

The CLI uses `~/.config/solana/id.json` by default. If you don't have one:

```bash
solana-keygen new --outfile ~/.config/solana/id.json
```

Get devnet SOL:

```bash
solana airdrop 2
```

## Step 3: Create a Prompt File

Create a file called `hello-world.prompt`:

```
Write a friendly greeting in Rust that prints "Hello, PromptChain!" to the console. Include a unit test.
```

Create a metadata file called `hello-world.meta.json`:

```json
{
  "name": "Hello World Rust Greeting",
  "description": "A simple prompt that generates a Rust hello world program",
  "prompt_text": "Write a friendly greeting in Rust that prints \"Hello, PromptChain!\" to the console. Include a unit test.",
  "category": "code",
  "tags": ["rust", "hello-world", "beginner"],
  "task_description": "Generate a Rust hello world program",
  "language": "en",
  "created_at": "2026-07-24T00:00:00Z",
  "updated_at": "2026-07-24T00:00:00Z"
}
```

## Step 4: Publish

```bash
promptchain publish hello-world.prompt --metadata hello-world.meta.json
```

You'll see output like:

```
Published! CID: QmX8...Yz9K
Prompt PDA: 4aBc...DeF1
View at: https://explorer.solana.com/address/4aBc...DeF1?cluster=devnet
```

## Step 5: Verify

List your prompts:

```bash
promptchain list
```

Get the prompt you just published:

```bash
promptchain get QmX8...Yz9K
```

## What Just Happened?

1. The CLI computed the IPFS CID of your prompt text
2. It called the kernel's `publish` instruction, creating a `Prompt` PDA
3. The PDA stores: your wallet as authority, the CID, and the metadata URI
4. Your prompt is now registered on Solana — verifiable, ownable, and licensable

## Next Steps

- [Add a license to your prompt](02-prompt-engineer.md#step-3-create-a-license)
- [Create a new version](02-prompt-engineer.md#step-4-fork-a-version)
- [Explore the protocol specification](../protocol-spec.md)
