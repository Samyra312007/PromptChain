# ADR-0004: SMT-Based Cache Invalidation

| Field | Value |
|-------|-------|
| Status | `Accepted` |
| Author | PromptChain Core |
| Created | 2026-02-05 |
| Last Updated | 2026-02-05 |

## Context

The caching layer (Layer 8) keeps deserialized prompts in memory (L1) and SQLite (L2). Cache invalidation is the hardest problem in cache engineering. Without it, users see stale data. With naive invalidation (flush all on any write), cache hit ratios collapse.

The curation engine commits a Sparse Merkle Tree (SMT) root of the search index to a PDA every epoch. We realized this SMT can also serve as a cache invalidation oracle.

## Decision

Use the on-chain SMT root as the authoritative cache invalidation signal. The cache maintains a local SMT of its entries. When the on-chain SMT root changes, the cache computes the diff and invalidates only the changed entries.

## Rationale

1. **Fine-grained invalidation:** If 1 prompt out of 10,000 changes, we invalidate exactly 1 cache entry. No flush storms.

2. **Verifiable:** The SMT root is on-chain. Anyone can verify that a cache entry is current by checking the Merkle proof against the committed root. This enables trustless cache serving.

3. **Unifies index and cache:** The same SMT that serves the search index (Layer 2) also drives cache invalidation. One data structure, two uses.

4. **No polling:** The cache subscribes to slot notifications and checks the SMT root on each slot. If unchanged, skip. No periodic "revalidate all" scans.

## How It Works

```
Cache state:
  Local SMT: { prompt_cid → slot_modified }
  On-chain SMT: committed merkle_root + num_documents + epoch

Invalidation flow:
1. On each slot, fetch IndexCommitment PDA
2. If merkle_root changed → compute diff from local SMT
3. For each entry whose slot_modified < committed slot: invalidate
4. Update local SMT root
```

## Alternatives Considered

- **TTL-based expiry:** Simple but imprecise. Stale data lives until TTL expires. TTL too short → cache miss storm. TTL too long → stale data.

- **Event subscription:** Subscribe to program events via WebSocket. Rejected because Solana event subscriptions are unreliable under load (missed events, reconnects).

- **Full flush on any write:** Works for small datasets. Rejected because cache holds 10K+ entries; flushing on every `submit_rating` would destroy hit ratios.

## Consequences

- **Positive:** Precise invalidation, no poll storms, unified with search index
- **Negative:** Every cache miss requires an SMT proof verification (~10μs in JS, negligible)
- **Trade-off:** Cache must maintain a local SMT (configurable, default 10K entries)
