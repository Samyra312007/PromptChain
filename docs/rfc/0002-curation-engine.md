# RFC-0002: Curation Engine

| Field | Value |
|-------|-------|
| Status | `Implemented` |
| Author | PromptChain Core |
| Created | 2026-02-10 |
| Last Updated | 2026-02-10 |

## Summary

A separate Anchor program that reads the kernel read-only and implements stake-weighted curation with sybil resistance, consensus slashing, and decay-based scoring.

## Motivation

The kernel provides ownership and licensing. It does NOT provide quality signals. Without curation, users cannot distinguish high-quality prompts from noise. The Curation Engine adds decentralized, sybil-resistant quality scoring as a plug-in subsystem.

## Design

### Account Types

#### Curator

| Field | Type | Description |
|-------|------|-------------|
| authority | Pubkey | Wallet address |
| total_stake | u64 | Total SOL staked (lamports) |
| total_ratings | u64 | Number of prompts rated |
| accurate_ratings | u64 | Count of ratings within 1σ of consensus |
| reputation_bp | u16 | Reputation score in basis points (max 10,000) |
| last_active_slot | u64 | Last slot the curator performed an action |
| bump | u8 | PDA bump |

#### PromptCuration

| Field | Type | Description |
|-------|------|-------------|
| prompt | Pubkey | Prompt PDA |
| weighted_score | u64 | Current weighted average * 1000 |
| total_weight | u64 | Sum of stake weights contributing to score |
| last_updated_slot | u64 | Slot of most recent rating |
| rating_count | u64 | Total ratings received |
| bump | u8 | PDA bump |

#### Rating

| Field | Type | Description |
|-------|------|-------------|
| curator | Pubkey | Curator PDA |
| prompt_curation | Pubkey | PromptCuration PDA |
| score | u8 | 1-5 rating |
| weight | u64 | Stake at time of rating |
| review_uri | String (max 200) | Optional review URI |
| slot | u64 | Slot when submitted |
| bump | u8 | PDA bump |

### Instructions

1. **init_curator** — Register as a curator, deposit minimum stake
2. **submit_rating** — Rate a prompt (1-5) with optional review URI. Score is weighted by curator's current stake.
3. **update_stake** — Add or remove stake. Ratings adjust weight retroactively for decay.
4. **resolve_slashing** — If a rating deviates >2σ from the weighted consensus, the curator's stake is slashed. 50% burned, 50% distributed to accurate raters.
5. **update_reputation** — Recompute reputation based on accuracy history

## Backward Compatibility

No kernel changes required. The curation program calls kernel PDAs as read-only.

## Security Considerations

- Sybil resistance: new curators have 10x weight penalty for first 100 ratings
- Economic slashing: ratings >2σ from consensus lose stake
- Decay prevents old ratings from dominating

## Open Questions

None.