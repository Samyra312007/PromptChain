# RFC-0001: Prompt Asset Interface

| Field | Value |
|-------|-------|
| Status | `Implemented` |
| Author | PromptChain Core |
| Created | 2026-01-15 |
| Last Updated | 2026-01-15 |

## Summary

Define the minimal kernel interface for prompts as first-class digital assets on Solana. Five instructions. Three account types. No more.

## Motivation

Prompts are currently treated as throwaway text. To make them tradeable, verifiable, and licensable digital assets, we need a minimal on-chain registry that provides:

- **Immutable content addressing** — a prompt's identity is its CID, not a database row
- **Verifiable ownership** — a prompt always has exactly one authority
- **Version DAG** — forks form a directed acyclic graph, like git
- **License attachment** — every prompt can carry a license with royalty terms

These are the absolute minimum primitives. Everything else (curation, tokens, reputation) builds on top.

## Design

### Account Types

Three PDAs, each initialized with an Anchor 8-byte discriminator.

#### Prompt

| Field | Type | Description |
|-------|------|-------------|
| authority | `Pubkey` | Current owner |
| original_authority | `Pubkey` | Original publisher (preserved through transfers) |
| ipfs_cid | `String` (max 70 bytes) | Content-addressed identifier |
| metadata_uri | `String` (max 200 bytes) | URI to off-chain metadata JSON |
| license | `Pubkey` | License PDA (Pubkey::default() = unlicensed) |
| total_versions | `u32` | Version count (also used as seed for next version) |
| total_uses | `u64` | Usage counter |
| bump | `u8` | PDA bump |

**Seed:** `["prompt", sha256(cid)]`

**Space:** `8 + 32 + 32 + (4 + 70) + (4 + 200) + 32 + 4 + 8 + 1 = 395 bytes`

#### PromptVersion

| Field | Type | Description |
|-------|------|-------------|
| parent | `Pubkey` | The prompt this version belongs to |
| version_number | `u32` | Monotonically increasing version index |
| author | `Pubkey` | Author at time of version creation |
| ipfs_cid | `String` (max 70 bytes) | Content of this version |
| metadata_uri | `String` (max 200 bytes) | Per-version metadata |
| changelog_uri | `String` (max 500 bytes) | URI describing changes |
| bump | `u8` | PDA bump |

**Seed:** `["version", prompt_key, version_number_le_u32]`

**Space:** `8 + 32 + 4 + 32 + (4 + 70) + (4 + 200) + (4 + 500) + 1 = 859 bytes`

#### License

| Field | Type | Description |
|-------|------|-------------|
| authority | `Pubkey` | License creator / royalty recipient |
| name | `String` (max 50 bytes) | License name |
| commercial_allowed | `bool` | May this prompt be used commercially? |
| attribution_required | `bool` | Must the author be credited? |
| royalty_basis_points | `u16` | Royalty fee (max 10,000 = 100%) |
| bump | `u8` | PDA bump |

**Seed:** `["license", authority_key, name_bytes]`

**Space:** `8 + 32 + (4 + 50) + 1 + 1 + 2 + 1 = 99 bytes`

### Instructions

#### 1. `publish`

Create a new `Prompt` PDA.

| Account | Writable | Signer | Description |
|---------|----------|--------|-------------|
| prompt | Yes | No | Prompt PDA (PDA, init) |
| authority | Yes | Yes | Payer + initial owner |
| system_program | No | No | System program |

**Args:** `cid: String`, `metadata_uri: String`, `license: Option<Pubkey>`

**Validation:**
- `cid` must be non-empty and ≤ 70 bytes
- `metadata_uri` must be non-empty and ≤ 200 bytes

**Effects:**
- `authority` = `original_authority` = signer
- `total_versions` = 1
- `total_uses` = 0

#### 2. `create_version`

Add a new version to an existing prompt.

| Account | Writable | Signer | Description |
|---------|----------|--------|-------------|
| prompt | Yes | No | Prompt PDA (mut) |
| version | Yes | No | Version PDA (init) |
| authority | Yes | Yes | Must match prompt.authority |
| system_program | No | No | System program |

**Args:** `cid: String`, `metadata_uri: String`, `changelog_uri: String`

**Validation:**
- `authority` must equal `prompt.authority`
- `cid` non-empty, ≤ 70 bytes
- `metadata_uri` non-empty, ≤ 200 bytes
- `changelog_uri` ≤ 500 bytes

**Effects:**
- `total_versions` incremented by 1

#### 3. `set_license`

Register a new `License` PDA.

| Account | Writable | Signer | Description |
|---------|----------|--------|-------------|
| license | Yes | No | License PDA (init) |
| authority | Yes | Yes | License creator |
| system_program | No | No | System program |

**Args:** `name: String`, `commercial_allowed: bool`, `attribution_required: bool`, `royalty_basis_points: u16`

**Validation:**
- `name` non-empty, ≤ 50 bytes
- `royalty_basis_points` ≤ 10,000

#### 4. `transfer`

Transfer prompt ownership to a new authority.

| Account | Writable | Signer | Description |
|---------|----------|--------|-------------|
| prompt | Yes | No | Prompt PDA (mut) |
| current_authority | No | Yes | Current owner |

**Args:** `new_authority: Pubkey`

**Validation:**
- `current_authority` must match `prompt.authority`
- `new_authority` must differ from current

**Effects:**
- `prompt.authority = new_authority`
- `prompt.original_authority` unchanged

#### 5. `use_prompt`

Record usage and enforce royalty payment.

| Account | Writable | Signer | Description |
|---------|----------|--------|-------------|
| prompt | Yes | No | Prompt PDA (mut) |
| license | No | No | License PDA (optional) |
| payer | Yes | Yes | User paying for usage |
| license_authority | Yes | No | Receives royalty (optional) |
| system_program | No | No | System program |

**Args:** `max_royalty_payment: u64`

**Validation:**
- If `prompt.license` is set, `license` must match
- `license_authority` must match `license.authority`
- Royalty = `max_royalty_payment * royalty_basis_points / 10000`

**Effects:**
- Royalty transferred via system CPI if > 0
- `total_uses` incremented

## Backward Compatibility

N/A — this is the initial interface.

## Security Considerations

- **Check-effects-interactions:** Royalty CPI happens after all validation, before state mutation
- **Arithmetic safety:** All math uses `checked_mul` / `checked_div` to prevent overflow
- **PDA validation:** All PDAs verified via `seeds` and `bump` constraints
- **No arbitrary CPI:** Only system_program::transfer is called

## Open Questions

None — all resolved during implementation.