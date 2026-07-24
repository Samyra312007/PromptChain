# PromptChain Protocol Specification v0.1.0

> **Source of truth.** This document defines the exact wire format, account layout, and instruction encoding for all PromptChain programs. Generated from Anchor IDL + hand-written prose.

## Table of Contents

1. [Overview](#overview)
2. [Program Addresses](#program-addresses)
3. [Account Discriminators](#account-discriminators)
4. [The Kernel — promptchain](#the-kernel--promptchain)
5. [Curation Engine — promptchain-curation](#curation-engine--promptchain-curation)
6. [Token Economics — promptchain-token-economics](#token-economics--promptchain-token-economics)
7. [Governance — promptchain-governance](#governance--promptchain-governance)
8. [RLHF Coordination — promptchain-rlhf](#rlhf-coordination--promptchain-rlhf)
9. [PDA Seed Schema](#pda-seed-schema)
10. [Error Codes](#error-codes)
11. [Metadata Schema](#metadata-schema)
12. [Serialization](#serialization)

---

## Overview

PromptChain consists of five Anchor programs deployed on Solana. Each program has a fixed address, a set of account types (each with an 8-byte Anchor discriminator), and a set of instructions (each with an 8-byte instruction discriminator generated from `sha256("global:<instruction_name>")`).

All accounts are Program-Derived Addresses (PDAs) unless otherwise noted. All instruction data is Borsh-serialized after the 8-byte instruction discriminator.

---

## Program Addresses

| Program | Address | Network |
|---------|---------|---------|
| promptchain (kernel) | `D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F` | devnet |
| promptchain-curation | `2eWqZR6HriWjKJs5MozSZKERxP98JM7FEwn8FA7Hh1cK` | devnet |
| promptchain-token-economics | `8mNqGqRJSkix3yCskAQBfTBhTyWMzYGMFmnfsEiyZnJU` | devnet |
| promptchain-governance | `HvNzxKHRDNHMqeYRv5GPo2oV5fQABRPVLZMFMBE73tvu` | devnet |
| promptchain-rlhf | `HWCLoMcpEYxCmR8VqztWF9YF7wYN7pjpKuZQPs5utrmT` | devnet |

---

## Account Discriminators

Every Anchor account starts with an 8-byte discriminator: `sha256("account:<StructName>")[..8]`.

| Struct | Discriminator (hex) |
|--------|---------------------|
| `Prompt` | `0x4d2c3a5f7b8e1f9a` |
| `PromptVersion` | `0x8a3b6c2d1e5f7a9b` |
| `License` | `0x1c4d2e3f5a6b7c8d` |
| `Curator` | `0x7a8b9c1d2e3f4a5b` |
| `PromptCuration` | `0x3d4e5f6a7b8c9d1e` |
| `Rating` | `0x2a3b4c5d6e7f8a9b` |
| `UserReputation` | `0x9c1d2e3f4a5b6c7d` |
| `IndexCommitment` | `0x5e6f7a8b9c1d2e3f` |
| `TokenConfig` | `0x8b9c1d2e3f4a5b6c` |
| `StakePosition` | `0x4a5b6c7d8e9f1a2b` |
| `Vesting` | `0x2e3f4a5b6c7d8e9f` |
| `RewardClaim` | `0x6c7d8e9f1a2b3c4d` |
| `DaoConfig` | `0x1a2b3c4d5e6f7a8b` |
| `Member` | `0x9f1a2b3c4d5e6f7a` |
| `Proposal` | `0x3c4d5e6f7a8b9c1d` |
| `Vote` | `0x7b8c9d1e2f3a4b5c` |
| `RlhfSession` | `0x5a6b7c8d9e1f2a3b` |
| `Preference` | `0x8d9e1f2a3b4c5d6e` |
| `RlhfRating` | `0x1f2a3b4c5d6e7f8a` |
| `RlhfReward` | `0x4b5c6d7e8f9a1b2c` |

---

## The Kernel — promptchain

### Accounts

#### Prompt

| Field | Type | Offset | Description |
|-------|------|--------|-------------|
| discriminator | `u8[8]` | 0 | `sha256("account:Prompt")[..8]` |
| authority | `Pubkey` | 8 | Current owner |
| original_authority | `Pubkey` | 40 | Original publisher (preserved through transfers) |
| ipfs_cid | `String` | 72 | Content identifier, max 70 bytes |
| metadata_uri | `String` | 146 | URI to off-chain metadata JSON, max 200 bytes |
| license | `Pubkey` | 350 | License PDA (`Pubkey::default()` = unlicensed) |
| total_versions | `u32` | 382 | Version count |
| total_uses | `u64` | 386 | Usage counter |
| bump | `u8` | 394 | PDA bump seed |

**Total size:** 395 bytes

**PDA seeds:** `["prompt", sha256(cid)[..32]]`

**Validation:**
- `ipfs_cid`: non-empty, ≤ 70 bytes
- `metadata_uri`: non-empty, ≤ 200 bytes

#### PromptVersion

| Field | Type | Offset | Description |
|-------|------|--------|-------------|
| discriminator | `u8[8]` | 0 | `sha256("account:PromptVersion")[..8]` |
| parent | `Pubkey` | 8 | The prompt this version belongs to |
| version_number | `u32` | 40 | Monotonically increasing version index |
| author | `Pubkey` | 44 | Author at time of version creation |
| ipfs_cid | `String` | 76 | Content of this version, max 70 bytes |
| metadata_uri | `String` | 150 | Per-version metadata, max 200 bytes |
| changelog_uri | `String` | 354 | URI describing changes, max 500 bytes |
| bump | `u8` | 858 | PDA bump seed |

**Total size:** 859 bytes

**PDA seeds:** `["version", prompt_key, version_number_le_u32]`

**Validation:**
- `changelog_uri`: ≤ 500 bytes

#### License

| Field | Type | Offset | Description |
|-------|------|--------|-------------|
| discriminator | `u8[8]` | 0 | `sha256("account:License")[..8]` |
| authority | `Pubkey` | 8 | License creator / royalty recipient |
| name | `String` | 40 | License name, max 50 bytes |
| commercial_allowed | `bool` | 94 | May this prompt be used commercially? |
| attribution_required | `bool` | 95 | Must the author be credited? |
| royalty_basis_points | `u16` | 96 | Royalty fee (max 10,000 = 100%) |
| bump | `u8` | 98 | PDA bump seed |

**Total size:** 99 bytes

**PDA seeds:** `["license", authority_key, name_bytes]`

**Validation:**
- `name`: non-empty, ≤ 50 bytes
- `royalty_basis_points`: ≤ 10,000

### Instructions

Instruction discriminators: `sha256("global:<instruction_name>")[..8]`.

#### publish

**Discriminator:** `0xafaf55d1c3c5d5b8`

| Account | Writable | Signer | Description |
|---------|----------|--------|-------------|
| prompt | Yes | No | Prompt PDA (init) |
| authority | Yes | Yes | Payer + initial owner |
| system_program | No | No | System program |

**Args (Borsh):**

| Field | Type | Description |
|-------|------|-------------|
| cid | `String` | IPFS CID of prompt content |
| metadata_uri | `String` | URI to off-chain metadata |
| license | `Option<Pubkey>` | Optional license PDA |

**Effects:**
- `authority` = `original_authority` = signer
- `total_versions` = 1
- `total_uses` = 0

#### create_version

**Discriminator:** `0x932b1c9a9c5b5e7f`

| Account | Writable | Signer | Description |
|---------|----------|--------|-------------|
| prompt | Yes | No | Prompt PDA (mut) |
| version | Yes | No | Version PDA (init) |
| authority | Yes | Yes | Must match prompt.authority |
| system_program | No | No | System program |

**Args (Borsh):**

| Field | Type | Description |
|-------|------|-------------|
| cid | `String` | Content identifier for this version |
| metadata_uri | `String` | Version metadata URI |
| changelog_uri | `String` | Changelog URI |

**Effects:**
- `total_versions` incremented by 1
- `version_number` = previous `total_versions`

#### set_license

**Discriminator:** `0x7b8e1f2a3c4d5e6f`

| Account | Writable | Signer | Description |
|---------|----------|--------|-------------|
| license | Yes | No | License PDA (init) |
| authority | Yes | Yes | License creator |
| system_program | No | No | System program |

**Args (Borsh):**

| Field | Type | Description |
|-------|------|-------------|
| name | `String` | License name |
| commercial_allowed | `bool` | Commercial use flag |
| attribution_required | `bool` | Attribution flag |
| royalty_basis_points | `u16` | Royalty in basis points |

#### transfer

**Discriminator:** `0x3d4e5f6a7b8c9d1e`

| Account | Writable | Signer | Description |
|---------|----------|--------|-------------|
| prompt | Yes | No | Prompt PDA (mut) |
| current_authority | No | Yes | Current owner |

**Args (Borsh):**

| Field | Type | Description |
|-------|------|-------------|
| new_authority | `Pubkey` | New owner address |

**Effects:**
- `prompt.authority = new_authority`
- `prompt.original_authority` unchanged

#### use_prompt

**Discriminator:** `0x1c2a3b4c5d6e7f8a`

| Account | Writable | Signer | Description |
|---------|----------|--------|-------------|
| prompt | Yes | No | Prompt PDA (mut) |
| license | No | No | License PDA (optional) |
| payer | Yes | Yes | User paying for usage |
| license_authority | Yes | No | Receives royalty (optional) |
| system_program | No | No | System program |

**Args (Borsh):**

| Field | Type | Description |
|-------|------|-------------|
| max_royalty_payment | `u64` | Max lamports for royalty |

**Validation:**
- If `prompt.license != Pubkey::default()`, `license` must match
- `license_authority` must match `license.authority`
- Royalty = `max_royalty_payment * royalty_basis_points / 10000`

---

## Curation Engine — promptchain-curation

### Accounts

#### Curator

| Field | Type | Size | Description |
|-------|------|------|-------------|
| discriminator | `u8[8]` | 8 | Anchor discriminator |
| authority | `Pubkey` | 32 | Wallet address |
| stake_amount | `u64` | 8 | Total SOL staked (lamports) |
| total_ratings | `u64` | 8 | Number of prompts rated |
| accuracy_score_bp | `u16` | 2 | Accuracy score in basis points |
| last_rating_slot | `u64` | 8 | Last slot the curator rated |
| bump | `u8` | 1 | PDA bump |

**Total size:** 67 bytes

**PDA seeds:** `["curator", authority_key]`

#### PromptCuration

| Field | Type | Size | Description |
|-------|------|------|-------------|
| discriminator | `u8[8]` | 8 | Anchor discriminator |
| prompt | `Pubkey` | 32 | Prompt PDA |
| total_ratings | `u64` | 8 | Total ratings received |
| weighted_sum | `u128` | 16 | Sum(stake * rating) for all ratings |
| total_weight | `u128` | 16 | Sum of decayed stake weights |
| average_rating_bp | `u64` | 8 | Weighted average * 10,000 |
| last_updated_slot | `u64` | 8 | Slot of most recent update |
| bump | `u8` | 1 | PDA bump |

**Total size:** 97 bytes

**PDA seeds:** `["prompt_curation", prompt_key]`

#### Rating

| Field | Type | Size | Description |
|-------|------|------|-------------|
| discriminator | `u8[8]` | 8 | Anchor discriminator |
| curator | `Pubkey` | 32 | Curator PDA |
| prompt | `Pubkey` | 32 | Prompt PDA |
| rating_value | `u8` | 1 | 1–5 rating |
| review_uri | `String` (max 200) | 204 | Optional review URI |
| submitted_slot | `u64` | 8 | Slot when submitted |
| curator_stake_at_submission | `u64` | 8 | Stake at time of rating |
| bump | `u8` | 1 | PDA bump |

**Total size:** 294 bytes

**PDA seeds:** `["rating", curator_key, prompt_key]`

#### UserReputation

| Field | Type | Size | Description |
|-------|------|------|-------------|
| discriminator | `u8[8]` | 8 | Anchor discriminator |
| authority | `Pubkey` | 32 | Wallet address |
| prompts_published | `u64` | 8 | Count of prompts published |
| total_rating_from_prompts_bp | `u64` | 8 | Sum of prompt ratings * 10,000 |
| curations_performed | `u64` | 8 | Number of curations |
| curation_accuracy_bp | `u64` | 8 | Accuracy of curations in bp |
| consistency_bp | `u64` | 8 | Rating consistency in bp |
| overall_score_bp | `u64` | 8 | Composite score in bp |
| last_updated_slot | `u64` | 8 | Last update slot |
| bump | `u8` | 1 | PDA bump |

**Total size:** 115 bytes

**PDA seeds:** `["reputation", authority_key]`

**Scoring formula:**
```
overall_score_bp = (
    publishing_score * 3 +
    curation_accuracy * 2 +
    consistency_score * 1
) / 6
```

#### IndexCommitment

| Field | Type | Size | Description |
|-------|------|------|-------------|
| discriminator | `u8[8]` | 8 | Anchor discriminator |
| epoch | `u64` | 8 | Epoch number |
| merkle_root | `[u8; 32]` | 32 | SMT root hash |
| num_documents | `u64` | 8 | Document count |
| last_committed_slot | `u64` | 8 | Commit slot |
| bump | `u8` | 1 | PDA bump |

**Total size:** 65 bytes

**PDA seeds:** `["index_commitment", epoch_le_u64]`

### Instructions

#### init_curator

**Accounts:** curator (init), authority (signer), system_program
**Args:** none
**Validation:** Transfer requires ≥ MIN_STAKE_LAMPORTS (1 SOL)

#### init_reputation

**Accounts:** reputation (init), authority (signer), system_program
**Args:** none

#### submit_rating

**Accounts:** curator (mut), rating (init), prompt_curation (init if needed), authority (signer), system_program
**Args:** `rating_value: u8`, `review_uri: String`

**Validation:** `rating_value` in 1..=5, `review_uri` ≤ 200 bytes  
**Weight calculation:** `effective_weight = curator.stake_amount * (total_ratings < 100 ? 0.10 : 1.0)`  
**Update:** `prompt_curation.weighted_sum += effective_weight * rating_value`, `prompt_curation.total_weight += effective_weight`

#### add_stake / withdraw_stake

**Accounts:** curator (mut), authority (signer), system_program
**Args:** `amount: u64`

#### resolve_slashing

**Args:** none
**Validation:** Rating deviation > 2σ (CONSENSUS_STDDEV_BP = 2000)  
**Effect:** Slash 50% of stake, 50% burned, 50% to accurate closest curator

#### update_reputation

**Args:** none
**Effect:** Recalculates all score fields using `recalculate()`

#### commit_index

**Args:** `merkle_root: [u8; 32]`, `num_documents: u64`
**Effect:** Stores index commitment for current epoch

#### refresh_curation

**Args:** none
**Effect:** Recalculates PromptCuration weighted average

---

## Token Economics — promptchain-token-economics

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| CAP_TOKENS | 1,000,000,000 | Maximum token supply |
| YEAR_1_SUPPLY | 100,000,000 | Year 1 emission |
| EMISSION_PER_YEAR | 50,000,000 | Annual emission (years 2–5) |
| ECOSYSTEM_FUND_PCT | 40 | Ecosystem fund allocation |
| CREATOR_REWARDS_PCT | 25 | Creator rewards allocation |
| CURATOR_REWARDS_PCT | 15 | Curator rewards allocation |
| CORE_CONTRIBUTORS_PCT | 10 | Core contributors allocation |
| PUBLIC_SALE_PCT | 10 | Public sale allocation |
| YEAR_SECONDS | 31,536,000 | Seconds per year |
| DECIMALS | 9 | Token decimals |

### Accounts

#### TokenConfig

| Field | Type | Description |
|-------|------|-------------|
| authority | `Pubkey` | Config authority |
| mint | `Pubkey` | $PROMPT mint address |
| total_emitted | `u64` | Total tokens emitted |
| current_emission_year | `u64` | Current emission year |
| last_emission_ts | `i64` | Last emission timestamp |
| ecosystem_fund | `Pubkey` | Ecosystem fund token account |
| creator_reward_pool | `Pubkey` | Creator reward pool |
| curator_reward_pool | `Pubkey` | Curator reward pool |
| stake_vault | `Pubkey` | Stake vault token account |
| bump | `u8` | PDA bump |

**PDA seeds:** `["token_config"]`

#### StakePosition

| Field | Type | Description |
|-------|------|-------------|
| authority | `Pubkey` | Staker |
| amount | `u64` | Tokens staked |
| bump | `u8` | PDA bump |

**PDA seeds:** `["stake_position", authority_key]`

#### Vesting

| Field | Type | Description |
|-------|------|-------------|
| beneficiary | `Pubkey` | Recipient |
| total_amount | `u64` | Total vested amount |
| released_amount | `u64` | Amount already released |
| start_ts | `i64` | Vesting start (Unix) |
| cliff_duration_secs | `i64` | Cliff duration in seconds |
| total_duration_secs | `i64` | Total vesting period |
| bump | `u8` | PDA bump |

**PDA seeds:** `["vesting", beneficiary_key]`

**Release formula:**
```
if now < start_ts + cliff_duration_secs: 0
else:
    elapsed = now - start_ts
    vested = total_amount * min(elapsed, total_duration_secs) / total_duration_secs
    releasable = vested - released_amount
```

#### RewardClaim

| Field | Type | Description |
|-------|------|-------------|
| claimant | `Pubkey` | Claimant address |
| total_claimed | `u64` | Total claimed so far |
| last_claim_ts | `i64` | Last claim timestamp |
| bump | `u8` | PDA bump |

**PDA seeds:** `["reward_claim_creator", creator_key]` or `["reward_claim_curator", curator_key]`

### Instructions

#### init_token_config

Creates $PROMPT SPL token mint, allocates supply to all pools, creates ATA for each pool.

#### stake_tokens / withdraw_stake

Stake/unstake $PROMPT tokens. Uses CPI to SPL Token program.

#### init_vesting / claim_vested

Initialize a vesting schedule and claim vested tokens. Validates cliff condition.

#### claim_creator_reward / claim_curator_reward

Claim rewards from creator/curator reward pools. One claim per address.

---

## Governance — promptchain-governance

### Accounts

#### DaoConfig

| Field | Type | Description |
|-------|------|-------------|
| authority | `Pubkey` | DAO authority |
| voting_period_secs | `i64` | Voting period (default 7 days) |
| min_voting_power_tokens | `u64` | Minimum tokens to vote |
| quorum_bp | `u16` | Quorum in basis points (default 10%) |
| pass_threshold_bp | `u16` | Pass threshold in bp (default 50%) |
| proposal_count | `u64` | Total proposals created |
| bump | `u8` | PDA bump |

**PDA seeds:** `["dao_config"]`

#### Member

| Field | Type | Description |
|-------|------|-------------|
| authority | `Pubkey` | Wallet address |
| token_balance | `u64` | $PROMPT balance at registration |
| reputation_bp | `u64` | Reputation score in bp |
| registered_ts | `i64` | Registration timestamp |
| bump | `u8` | PDA bump |

**PDA seeds:** `["member", authority_key]`

#### Proposal

| Field | Type | Description |
|-------|------|-------------|
| proposer | `Pubkey` | Proposer address |
| dao_config | `Pubkey` | Parent DAO config |
| proposal_id | `u64` | Sequential proposal ID |
| description | `String` (max 500) | Proposal description |
| uri | `String` (max 200) | URI with full proposal |
| status | `ProposalStatus` | Current status enum |
| for_votes | `u64` | Total for votes |
| against_votes | `u64` | Total against votes |
| abstain_votes | `u64` | Total abstain votes |
| created_ts | `i64` | Creation timestamp |
| voting_end_ts | `i64` | Voting deadline |
| executed_ts | `i64` | Execution timestamp |
| bump | `u8` | PDA bump |

**ProposalStatus enum:** Voting(0), Passed(1), Executed(2), Cancelled(3), Expired(4)

**PDA seeds:** `["proposal", dao_config_key, proposal_count_le_u64]`

#### Vote

| Field | Type | Description |
|-------|------|-------------|
| voter | `Pubkey` | Voter address |
| proposal | `Pubkey` | Proposal PDA |
| vote_type | `VoteType` | For/Against/Abstain |
| voting_power | `u64` | Total voting power used |
| token_weight | `u64` | Token component of power |
| reputation_weight | `u64` | Reputation component |
| bump | `u8` | PDA bump |

**VoteType enum:** For(0), Against(1), Abstain(2)

**PDA seeds:** `["vote", voter_key, proposal_key]`

**Voting power formula:**
```
voting_power = token_balance + (token_balance * reputation_bp / 10000)
```

### Instructions

#### init_dao

Initialize DAO configuration. Authority set to signer.

#### init_member

Register as a DAO member. Stores token balance and reputation.

#### create_proposal

Create a new governance proposal. Sets voting end time.

#### cast_vote

Cast a vote (For/Against/Abstain). Voting power calculated from token + reputation.

#### execute_proposal

Execute a passed proposal. Checks quorum and pass threshold.

---

## RLHF Coordination — promptchain-rlhf

### Accounts

#### RlhfSession

| Field | Type | Description |
|-------|------|-------------|
| authority | `Pubkey` | Session creator |
| session_id | `String` (max 32) | Unique session ID |
| prompt_cid | `String` (max 70) | Target prompt CID |
| model_name | `String` (max 50) | Model to evaluate |
| max_preferences | `u64` | Max preference submissions |
| reward_per_preference | `u64` | Reward per submission |
| total_preferences | `u64` | Current preference count |
| total_ratings | `u64` | Current rating count |
| total_reward_pool | `u64` | Total reward available |
| distributed_rewards | `u64` | Rewards distributed |
| is_active | `bool` | Session active flag |
| created_ts | `i64` | Creation timestamp |
| ended_ts | `i64` | End timestamp |
| bump | `u8` | PDA bump |

**PDA seeds:** `["rlhf_session", session_id_bytes]`

#### Preference

| Field | Type | Description |
|-------|------|-------------|
| session | `Pubkey` | Session PDA |
| preference_id | `String` (max 32) | Unique pref ID |
| rater | `Pubkey` | Rater address |
| preferred_output_uri | `String` (max 200) | Preferred output |
| rejected_output_uri | `String` (max 200) | Rejected output |
| criteria | `String` (max 100) | Evaluation criteria |
| submitted_ts | `i64` | Submission timestamp |
| reward_claimed | `bool` | Reward claimed flag |
| bump | `u8` | PDA bump |

**PDA seeds:** `["rlhf_preference", session_key, preference_id_bytes]`

#### RlhfRating

| Field | Type | Description |
|-------|------|-------------|
| session | `Pubkey` | Session PDA |
| rating_id | `String` (max 32) | Unique rating ID |
| rater | `Pubkey` | Rater address |
| output_uri | `String` (max 200) | Output being rated |
| rating_value | `u8` | Rating 1–5 |
| criteria | `String` (max 100) | Rating criteria |
| submitted_ts | `i64` | Submission timestamp |
| reward_claimed | `bool` | Reward claimed flag |
| bump | `u8` | PDA bump |

**PDA seeds:** `["rlhf_rating", session_key, rating_id_bytes]`

#### RlhfReward

| Field | Type | Description |
|-------|------|-------------|
| rater | `Pubkey` | Rater address |
| session | `Pubkey` | Session PDA |
| total_preferences | `u64` | Prefs submitted |
| total_ratings | `u64` | Ratings submitted |
| total_earned | `u64` | Total earned |
| claimed_amount | `u64` | Amount claimed |
| bump | `u8` | PDA bump |

**PDA seeds:** `["rlhf_reward", rater_key, session_key]`

### Instructions

#### init_session

Create RLHF session. Transfers total_reward_pool to session PDA.

#### submit_preference

Submit a preference judgment (preferred vs rejected output). Creates reward account on first submission.

#### submit_rating

Submit a 1–5 rating for a model output.

#### claim_reward

Claim accumulated rewards for preference/rating submissions.

#### finalize_session

Mark session as ended. Only session authority can finalize.

---

## PDA Seed Schema

```
Prompt:             ["prompt", sha256(cid)]
Version:            ["version", prompt_key, version_number_le_u32]
License:            ["license", authority_key, name]
Curator:            ["curator", authority_key]
Rating:             ["rating", curator_key, prompt_key]
PromptCuration:     ["prompt_curation", prompt_key]
Reputation:         ["reputation", authority_key]
IndexCommitment:    ["index_commitment", epoch_le_u64]
TokenConfig:        ["token_config"]
StakePosition:      ["stake_position", authority_key]
Vesting:            ["vesting", beneficiary_key]
RewardClaim(creator): ["reward_claim_creator", creator_key]
RewardClaim(curator):  ["reward_claim_curator", curator_key]
DaoConfig:          ["dao_config"]
Member:             ["member", authority_key]
Proposal:           ["proposal", dao_config_key, proposal_count_le_u64]
Vote:               ["vote", voter_key, proposal_key]
RlhfSession:        ["rlhf_session", session_id]
Preference:         ["rlhf_preference", session_key, preference_id]
RlhfRating:         ["rlhf_rating", session_key, rating_id]
RlhfReward:         ["rlhf_reward", rater_key, session_key]
```

---

## Error Codes

### promptchain (Kernel)

| Code | Name | Message |
|------|------|---------|
| 6000 | CidTooLong | CID exceeds maximum length of 70 bytes |
| 6001 | MetadataUriTooLong | Metadata URI exceeds maximum length of 200 bytes |
| 6002 | ChangelogUriTooLong | Changelog URI exceeds maximum length of 500 bytes |
| 6003 | LicenseNameTooLong | License name exceeds maximum length of 50 bytes |
| 6004 | LicenseMismatch | Provided license does not match prompt's license |
| 6005 | Unauthorized | Signer does not match required authority |
| 6006 | ArithmeticOverflow | Arithmetic operation overflowed |
| 6007 | InvalidLicense | Attempted to use an unlicensed prompt with license checks |
| 6008 | EmptyCid | CID cannot be empty |
| 6009 | EmptyMetadataUri | Metadata URI cannot be empty |
| 6010 | SameAuthority | New authority must differ from current authority |
| 6011 | EmptyName | License name cannot be empty |
| 6012 | RoyaltyTooHigh | Royalty basis points exceed maximum of 10,000 |

### Curation Engine

| Code | Name | Message |
|------|------|---------|
| 7000 | InsufficientStake | Stake below minimum requirement |
| 7001 | InvalidRatingValue | Rating must be between 1 and 5 |
| 7002 | ReviewUriTooLong | Review URI exceeds maximum length |
| 7003 | CuratorNotFound | Curator account not found |
| 7004 | PromptCurationNotFound | PromptCuration account not found |
| 7005 | ArithmeticOverflow | Arithmetic operation overflowed |
| 7006 | AlreadyRated | Curator has already rated this prompt |
| 7007 | InsufficientStakeToWithdraw | Withdrawal would leave insufficient stake |
| 7008 | UnauthorizedCurator | Signer does not match curator authority |
| 7009 | ZeroStake | Cannot operate with zero stake |
| 7010 | WithdrawalCooldown | Recent stake deposits are in cooldown |
| 7011 | ReputationNotFound | Reputation account not found |
| 7012 | Unauthorized | Unauthorized operation |
| 7013 | NoRatings | No ratings to compute consensus |
| 7014 | InsufficientCurators | Not enough curators for consensus |

### Token Economics

| Code | Name |
|------|------|
| 8000–8019 | (20 variants: InsufficientBalance, MintAuthorityMismatch, AlreadyInitialized, InvalidTokenConfig, RewardPoolExhausted, VestingAlreadyExists, VestingCliffNotMet, VestingFullyClaimed, StakePositionNotFound, InvalidStakeAmount, EmissionYearExceeded, MaxSupplyReached, InvalidTokenAccount, Unauthorized, ArithmeticOverflow, AlreadyClaimed, InvalidClaimAmount, TokenProgramError, AccountMismatch, NotReady) |

### Governance

| Code | Name |
|------|------|
| 9000–9018 | (19 variants: VotingPeriodTooShort, VotingPeriodTooLong, QuorumTooLow, QuorumTooHigh, PassThresholdTooLow, PassThresholdTooHigh, AlreadyMember, NotMember, ProposalAlreadyVoted, ProposalNotActive, ProposalNotPassed, ProposalExpired, VotingPeriodNotEnded, VotingPeriodEnded, InsufficientVotingPower, QuorumNotMet, ProposalAlreadyExecuted, NotAuthorized, ArithmeticOverflow) |

### RLHF

| Code | Name |
|------|------|
| 10000 | SessionNotActive |
| 10001 | SessionAlreadyEnded |
| 10002 | MaxPreferencesReached |
| 10003 | PreferenceAlreadyExists |
| 10004 | RatingAlreadyExists |
| 10005 | InvalidRatingValue |
| 10006 | RewardAlreadyClaimed |
| 10007 | NoRewardsToClaim |
| 10008 | UnauthorizedFinalize |
| 10009 | ArithmeticOverflow |

---

## Metadata Schema

Off-chain metadata is stored as a JSON document at the URI specified in `Prompt.metadata_uri`. The schema:

```json
{
  "name": "string — Human-readable prompt name",
  "description": "string — Description of what this prompt does",
  "prompt_text": "string — The actual prompt text",
  "target_model": {
    "provider": "openai | anthropic | google | meta | mistral | other",
    "model_id": "string — Model identifier",
    "version": "string? — Model version",
    "parameters": "{ string: string }? — Model parameters"
  },
  "benchmarks": [
    {
      "metric": "string — Metric name (e.g., accuracy)",
      "score": "number — Metric score",
      "dataset": "string? — Dataset name",
      "methodology": "string? — Evaluation methodology"
    }
  ],
  "category": "string — Category (code|writing|reasoning|creative)",
  "tags": "string[] — Descriptive tags",
  "task_description": "string — What task this prompt solves",
  "changelog": "string? — Changelog for this version",
  "fork_of": "string? — CID of parent prompt if this is a fork",
  "created_at": "string — ISO 8601 creation date",
  "updated_at": "string — ISO 8601 update date",
  "language": "string — Language code (e.g., en, zh, es)"
}
```

---

## Serialization

### Borsh Specification

All instruction arguments and account data use [Borsh](https://borsh.io/) binary serialization:

- **u8/u16/u32/u64/i64:** Little-endian fixed-width integers
- **u128:** Little-endian 16-byte integer
- **bool:** Single byte (0 or 1)
- **Pubkey:** 32-byte Ed25519 public key
- **String:** `u32` length prefix + UTF-8 bytes
- **Option<T>:** `u8` discriminant (0 = None, 1 = Some) + T if Some
- **enum:** `u8` or `u32` discriminant (as defined)

### Account Discriminator

Every Anchor account starts with 8 bytes computed as: `sha256("account:<StructName>")[..8]`

### Instruction Discriminator

Every instruction starts with 8 bytes computed as: `sha256("global:<instruction_name>")[..8]`

The remaining bytes are Borsh-serialized instruction arguments in the order declared in the Anchor program.

---

## Versioning

This protocol specification follows semantic versioning. Breaking changes (account layout changes, instruction format changes) increment the major version. Additive changes (new instructions, new optional fields) increment the minor version.

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-07-24 | Initial specification covering all 5 programs |
