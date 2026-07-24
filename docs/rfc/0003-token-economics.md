# RFC-0003: Token Economics & $PROMPT Distribution

| Field | Value |
|-------|-------|
| Status | `Implemented` |
| Author | PromptChain Core |
| Created | 2026-03-01 |
| Last Updated | 2026-03-01 |

## Summary

Define the $PROMPT SPL token economics: mint, distribution, staking, vesting, and reward pools. Separate Anchor program with CPI calls to the SPL Token program.

## Motivation

The kernel and curation engine establish ownership and quality signals. Without a native token, there is no incentive alignment — no reward for creators, no stake for curators, no governance weight for participants. $PROMPT aligns all incentives:

- **Creators** earn rewards for high-quality prompts
- **Curators** stake to signal quality and earn rewards for accuracy
- **Token holders** govern the protocol via DAO voting
- **The protocol** accrues value through fees and emission control

## Design

### Token Distribution (Year 1)

```
Total supply cap: 1,000,000,000 $PROMPT
Year 1 emission:  100,000,000 $PROMPT (10%)

Allocation:
  Ecosystem fund:       40,000,000 (40%)  → DAO-controlled treasury
  Creator rewards:      25,000,000 (25%)  → Distributed to prompt creators
  Curator rewards:      15,000,000 (15%)  → Distributed to accurate curators
  Core contributors:    10,000,000 (10%)  → 4-year vesting, 1-year cliff
  Public sale / LP:     10,000,000 (10%)  → Initial liquidity
```

### Emission Schedule (Years 2–5)

```
Year 2-5: 50,000,000 $PROMPT/year (halving every 4 years after)
```

### Account Model

Four token pools (ATAs), a mint PDA, and per-user stake/vesting accounts:

```
TokenConfig (PDA: ["token_config"])
├── mint                    → $PROMPT SPL Mint
├── ecosystem_fund          → ATA (40% of Y1)
├── creator_reward_pool     → ATA (25%)
├── curator_reward_pool     → ATA (15%)
└── stake_vault             → ATA (holds staked tokens)

User Accounts (per wallet)
├── StakePosition           → PDA: ["stake_position", authority]
├── Vesting                 → PDA: ["vesting", beneficiary]
└── RewardClaim             → PDA: ["reward_claim_creator", authority]
                            → PDA: ["reward_claim_curator", authority]
```

### Instructions

#### init_token_config

Creates the $PROMPT mint with 9 decimals. Mints initial supply. Creates all pool ATAs. Authority is the deployer (transferred to DAO in year 2-3).

#### stake_tokens / withdraw_stake

Users deposit $PROMPT into the stake vault. Each user gets a `StakePosition` PDA. Withdrawals are permissionless — any time, any amount above minimum.

#### init_vesting / claim_vested

Linear vesting with optional cliff. `cliff_duration_secs` is the minimum wait before any tokens become claimable. After cliff, tokens vest linearly over `total_duration_secs`.

```
releasable = total * min(elapsed, total_duration) / total_duration - released
```

#### claim_creator_reward / claim_curator_reward

Creators and curators claim pro-rata rewards from their respective pools. Each address claims once. Claims are tracked in `RewardClaim` PDAs.

## Backward Compatibility

No kernel changes required. Token economics is a separate program.

## Security Considerations

- **Mint authority:** Transferred to PDA (`token_config`) after initialization. No human can mint more tokens without a governance proposal.
- **Vault signer:** The `token_config` PDA signs CPIs to transfer tokens. Only pre-authorized transfers (stake withdrawal, reward claims, vesting releases) are permitted.
- **No inflation after cap:** The `total_emitted` check prevents minting beyond 1B $PROMPT.
- **Vesting enforcement:** `releasable_amount()` is computed in-program using blockchain timestamps. No off-chain trust required.

## Drawbacks

- Token adds complexity vs SOL-only model
- Regulatory uncertainty around protocol tokens

## Open Questions

- How to handle unclaimed rewards after, e.g., 5 years? Currently they remain in the pool.
