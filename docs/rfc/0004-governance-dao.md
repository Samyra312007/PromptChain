# RFC-0004: DAO Governance

| Field | Value |
|-------|-------|
| Status | `Implemented` |
| Author | PromptChain Core |
| Created | 2026-03-15 |
| Last Updated | 2026-03-15 |
| Supersedes | — |

## Summary

On-chain DAO governance for PromptChain: proposal creation, reputation-weighted voting, quorum enforcement, and execution. Separate Anchor program.

## Motivation

As PromptChain moves from benevolent dictatorship to community governance (years 2-5+), we need an on-chain governance system that:
- **Prevents capture** — voting weight is a blend of token holdings and earned reputation
- **Enables delegation** — vote with your reputation without transferring tokens
- **Enforces deliberation** — minimum discussion periods, timelocks on execution
- **Scales** — from 10 core contributors to 10,000 DAO members

## Design

### Governance Model Evolution

| Year | Model | Voting Weight | Decision Maker |
|------|-------|---------------|----------------|
| 1 | Benevolent Dictator | n/a | Project lead |
| 2-3 | Meritocracy | Reputation-weighted | Core contributors |
| 4-5 | Technical Committee | Token + Reputation | Elected committee |
| 5+ | Full DAO | Token + Reputation | All members |

### Account Model

```
DaoConfig (PDA: ["dao_config"])
├── voting_period_secs       → 604,800 (7 days)
├── min_voting_power_tokens   → 1 $PROMPT equivalent
├── quorum_bp                → 1000 (10%)
└── pass_threshold_bp        → 5000 (50%)

Member (PDA: ["member", authority])
├── token_balance            → $PROMPT held (snapshot at registration)
├── reputation_bp            → From curation engine
└── registered_ts

Proposal (PDA: ["proposal", dao_config, proposal_count])
├── status                   → Voting | Passed | Executed | Cancelled | Expired
├── for_votes / against_votes / abstain_votes
├── created_ts / voting_end_ts
└── description (max 500 bytes) + uri (max 200 bytes)

Vote (PDA: ["vote", voter, proposal])
├── vote_type                → For | Against | Abstain
├── voting_power             → token_balance + (token_balance * reputation_bp / 10000)
└── token_weight / reputation_weight
```

### Voting Power Formula

```
voting_power = token_balance + (token_balance * reputation_bp / 10000)
```

A member with 1000 $PROMPT and 5000 reputation bp (50%) gets:
`1000 + (1000 * 5000 / 10000) = 1000 + 500 = 1500 voting power`

This means reputation can amplify voting power up to 2x (at 10,000 bp = 100%).

### Instruction Flow

```
1. init_dao              → Deploy DAO config
2. init_member           → Register as member (anyone)
3. create_proposal       → Submit a proposal (member only)
4. cast_vote             → Vote For/Against/Abstain (member only)
5. execute_proposal      → Execute passed proposal (anyone, after period ends)
```

### Execution

`execute_proposal` does NOT execute arbitrary code. It marks the proposal as `Executed`. The actual execution (program upgrade, treasury transfer, etc.) is handled by a separate executor program that reads the proposal status. This separation allows the executor to have additional security checks.

## Backward Compatibility

No changes to kernel or other programs. Governance is a separate subsystem.

## Security Considerations

- **Minimum voting period:** 7 days prevents flash-loan governance attacks
- **Quorum:** 10% minimum participation prevents minority rule
- **Pass threshold:** 50% + 1 prevents gridlock
- **Reputation amplification:** Capped at 2x to prevent reputation whales from dominating
- **No arbitrary execution:** Proposals are signals; execution requires separate authorized programs
- **Timelock:** (Future) treasury transactions will have 7-day timelock with community veto

## Drawbacks

- Reputation is currently earned on-chain but seeded from curation engine data. Cross-program dependency adds latency.
- Token balance is a snapshot at registration, not live. Stale balances could misrepresent voting power.

## Open Questions

- Should voting power use live token balance (via CPI to Token program) instead of registration snapshot?
- How should delegation work? Vote with someone else's reputation?
- What happens when a member's reputation changes during an active vote?
