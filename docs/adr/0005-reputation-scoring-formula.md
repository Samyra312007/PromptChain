# ADR-0005: Reputation Scoring Formula

| Field | Value |
|-------|-------|
| Status | `Accepted` |
| Author | PromptChain Core |
| Created | 2026-02-10 |
| Last Updated | 2026-02-10 |

## Context

PromptChain needs a unified reputation score that reflects a user's contribution to the protocol. The score must be:
- **On-chain computable** — no off-chain ML models or oracles
- **Sybil-resistant** — cannot be gamed by creating multiple wallets
- **Non-transferable** — earned, not bought
- **Simple to understand** — "my score is X / 10,000"

## Decision

Use a weighted linear formula with three components:

```
overall_score_bp = (
    publishing_score * 3 +
    curation_accuracy * 2 +
    consistency_score * 1
) / 6
```

Where each component is scored 0–10,000 basis points, and the weights encode importance.

## Rationale

### Component breakdown

**Publishing score (weight 3):** Derived from the average rating of prompts the user has published. A user whose prompts average 4.5/5 has a publishing score of 9000 bp (4.5/5 * 10000). Weight 3 because publishing is the primary value generation in the protocol.

**Curation accuracy (weight 2):** Percentage of curator's ratings that fall within 1σ of the consensus score. If a curator rated 100 prompts and 85 were within consensus, score = 8500 bp. Weight 2 because accurate curation is valuable but depends on publishers creating content.

**Consistency score (weight 1):** Inverse variance of the user's prompt ratings. Lower variance = more consistent quality. A user whose prompts consistently score 4-5 has a higher consistency score than one who alternates between 1 and 5. Weight 1 because consistency is a signal of reliability but less important than raw quality.

### Why linear, not multiplicative?

Multiplicative formulas (e.g., `P * C * S`) mean that a zero in any component zeroes the score. A new user starts with zero curation accuracy — they shouldn't have zero reputation. Linear interpolation with weights gives a floor of zero but allows partial scores to contribute.

### Why not include token holdings?

Token holdings are a separate dimension (economic stake). Mixing economic power with earned reputation corrupts the reputation signal. Reputation is **earned, not bought**. Token weight is added separately in governance voting power.

### Why u32 (basis points)?

No floating point in the protocol. Basis points (1/10000 of a percent) provide 0.01% granularity, which is sufficient for ranking. Using `u64` for intermediate calculations prevents overflow: `10000 * 3 = 30000` fits easily, and eventual division by 6 keeps values within `u16` range (0-10000).

## Alternatives Considered

- **Simple average of all ratings:** Easy to game — create 100 prompts, get 100 average scores.
- **Bayesian average:** Statistically sound but requires knowing global averages, which change over time. Hard to compute on-chain.
- **PageRank-like algorithm:** Too complex for on-chain computation. Requires iterative graph traversal.
- **No composite score — expose raw metrics:** Purest approach but terrible UX. Users want "is this person reputable?" not a dashboard of 7 metrics.

## Consequences

- **Positive:** Simple, on-chain computable, resistant to gaming, composable with governance voting power
- **Negative:** Linear weighted average is less sophisticated than Bayesian or ML-based alternatives
- **Trade-off:** We optimize for on-chain verifiability and simplicity over statistical precision
