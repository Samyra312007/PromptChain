# Protocol Developer — Build a Custom Client in 2 Hours

> **Time:** ~2 hours
> **Prerequisites:** Completed [Prompt Engineer](02-prompt-engineer.md), familiarity with TypeScript and Solana

## Overview

In this tutorial, you'll build a custom PromptChain client from scratch that:
- Publishes prompts and versions
- Integrates the caching layer
- Monitors prompt usage
- Handles errors gracefully

You'll understand how all the layers fit together.

## Part 1: Raw RPC Calls (30 min)

### Understanding the Transaction Flow

Every PromptChain instruction follows this pattern:

1. Derive PDAs from seeds
2. Build the instruction data (8-byte discriminator + Borsh args)
3. Build the account list (with writable/signer flags)
4. Sign and send the transaction
5. Confirm and decode the result

### Manual publish example

```typescript
import {
  Connection, Keypair, PublicKey,
  Transaction, SystemProgram, SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { sha256 } from '@noble/hashes/sha256';
import * as borsh from 'borsh';

const PROGRAM_ID = new PublicKey('D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F');

// 1. Compute CID
const promptText = 'Write a Rust function that...';
const cid = Buffer.from(sha256(promptText)).toString('hex');

// 2. Derive Prompt PDA
const promptSeed = Buffer.concat([
  Buffer.from('prompt'),
  Buffer.from(sha256(cid)),
]);
const [promptPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('prompt'), sha256(cid)],
  PROGRAM_ID
);

// 3. Build instruction data
// Discriminator: sha256("global:publish")[..8]
// Args: cid (String), metadata_uri (String), license (Option<Pubkey>)
```

### Using the SDK (much easier)

```typescript
import { PromptChainClient } from '@promptchain/client';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair } from '@solana/web3.js';

// Set up provider
const connection = new Connection('https://api.devnet.solana.com');
const wallet = new Wallet(Keypair.fromSecretKey(...));
const provider = new AnchorProvider(connection, wallet, {});

// Create client
const client = new PromptChainClient(provider);

// Publish
const { prompt, cid } = await client.publish(
  'Write a Rust function...',
  'https://metadata.url/prompt.json'
);

// Fetch
const account = await client.fetchPrompt(prompt);
console.log('Authority:', account.authority.toString());
console.log('Versions:', account.total_versions);
```

## Part 2: Integrating the Cache Layer (30 min)

### Why caching matters

Every `fetchPrompt` call hits the RPC. At 1000 reads/second, that's 1000 RPC calls. The cache layer reduces this to ~1 RPC call per 10K reads.

### Add caching to your client

```typescript
import { CacheManager } from '@promptchain/cache';

const cache = new CacheManager({
  l1Size: 10000,       // Keep 10K prompts in memory
  l2Path: './cache.db',  // SQLite file cache
  l3Gateway: 'https://ipfs.io/ipfs/',  // IPFS gateway
  rpcUrl: 'https://api.devnet.solana.com',
});

// Cache-first fetch
async function cachedFetchPrompt(pda: PublicKey) {
  const key = pda.toBase58();
  let data = await cache.get(key);
  if (!data) {
    // L4: actual RPC call
    data = await client.fetchPrompt(pda);
    await cache.set(key, data);
  }
  return data;
}
```

## Part 3: Monitoring & Observability (30 min)

### Add metrics to your client

```typescript
import { MetricsRegistry, metricsRegistry } from '@promptchain/monitoring';
import { KernelMetricsCollector } from '@promptchain/monitoring';

const kernelMetrics = new KernelMetricsCollector();

// Track instruction performance
const timer = kernelMetrics.startTimer('publish');
try {
  const result = await client.publish(text, metadataUri);
  timer.end({ status: 'success' });
} catch (e) {
  timer.end({ status: 'error' });
  throw e;
}

// Export metrics to console
setInterval(() => {
  const report = metricsRegistry.snapshot();
  console.log('Cache hit ratio:', report.cacheHitRatio);
  console.log('Avg publish latency:', report.avgPublishLatencyMs);
  console.log('RPC calls/min:', report.rpcCallsPerMinute);
}, 60000);
```

### Health check endpoint

```typescript
import { healthEndpoint } from '@promptchain/monitoring';

// Express-compatible health endpoint
app.get('/health', (req, res) => {
  const status = healthEndpoint();
  res.json(status);
  // → { status: 'ok', subsystems: { rpc: 'ok', cache: 'degraded', ... } }
});
```

## Part 4: Cross-Layer Integration (30 min)

### Full publish pipeline

Here's a complete pipeline that uses all layers:

```typescript
import { PromptChainClient } from '@promptchain/client';
import { CacheManager } from '@promptchain/cache';
import { MetricsRegistry } from '@promptchain/monitoring';

async function publishWithObservability(
  client: PromptChainClient,
  cache: CacheManager,
  text: string,
  metadataUri: string
) {
  // 1. Check cache for existing CID
  const cid = computeCid(text);
  const existing = await cache.get(cid);
  if (existing) {
    console.log('Already published, skipping');
    return existing;
  }

  // 2. Publish with metrics
  const timer = kernelMetrics.startTimer('publish');
  const result = await client.publish(text, metadataUri);

  // 3. Warm cache
  await cache.set(cid, result);
  await cache.set(result.prompt.toBase58(), result.account);

  // 4. Record metric
  timer.end({ status: 'success' });

  // 5. Return with full context
  return {
    ...result,
    cid,
    confirmed: true,
    slot: result.slot,
  };
}
```

### Error handling matrix

| Error | Cause | Handling |
|-------|-------|----------|
| `CidTooLong` | CID > 70 bytes | Pre-validate CID before submit |
| `Unauthorized` | Wrong signer | Check `authority` matches signer |
| `ArithmeticOverflow` | Royalty math overflow | Cap royalty at u64::MAX |
| `InsufficientStake` | < 1 SOL staked | Check stake before `submit_rating` |
| `AlreadyRated` | Duplicate curation | Check existing `Rating` PDA |
| `Cache miss` | Entry not cached | Fall through to RPC |
| `RPC timeout` | Network issue | Retry with exponential backoff (3 attempts) |

## Part 5: Testing Your Client (30 min)

### Unit tests

```typescript
import { PromptChainClient } from '@promptchain/client';

// Mock the Anchor provider
const mockProvider = {
  connection: { getAccountInfo: jest.fn() },
  wallet: { publicKey: Keypair.generate().publicKey },
};

describe('PromptChainClient', () => {
  it('computes PDA correctly', () => {
    const client = new PromptChainClient(mockProvider as any);
    const [pda] = client.findPromptPda(cid);
    expect(pda).toBeTruthy();
  });
});
```

### Integration test with local validator

```bash
# Start local Solana validator with program deployed
anchor localnet --test
```

## Reference: SDK Package Map

| Package | Purpose | Key Class |
|---------|---------|-----------|
| `@promptchain/client` | Kernel interactions | `PromptChainClient` |
| `@promptchain/schema` | Constants, types, PDA seeds | — |
| `@promptchain/storage` | IPFS, PromptFS filesystem | `PromptFS` |
| `@promptchain/curation` | Curation engine | `CurationClient` |
| `@promptchain/cache` | L1-L4 cache hierarchy | `CacheManager` |
| `@promptchain/monitoring` | Metrics, tracing, health | `MetricsRegistry` |
| `@promptchain/network` | P2P node | `P2PNode` |
| `@promptchain/backup` | Export/import/archive | `PromptBackupExporter` |
| `@promptchain/testing` | Test harness | `StateMachine` |
| `@promptchain/release` | Build/release tooling | `ReleaseChecklist` |

## Next Steps

- Read the [Protocol Specification](../protocol-spec.md) for exact wire format
- Review active [RFCs](../rfc/) for upcoming changes
- Check [ADRs](../adr/) for engineering rationale
- Contribute: open a PR or start an RFC discussion
