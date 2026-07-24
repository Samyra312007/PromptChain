# RFC-0005: RLHF Coordination Layer

| Field | Value |
|-------|-------|
| Status | `Implemented` |
| Author | PromptChain Core |
| Created | 2026-04-01 |
| Last Updated | 2026-04-01 |

## Summary

Distributed human feedback collection for prompt optimization with on-chain reward distribution. Enables prompt authors to collect preference judgments and quality ratings from a global workforce, with automatic reward payout.

## Motivation

Prompt optimization requires human feedback. Current solutions are centralized (Scale AI, Surge) or fragmented (Discord polls, Google Forms). PromptChain needs a native feedback layer that:

- **Coordinates raters** — matches prompt authors with human raters
- **Records preferences** — "which output is better?" pairwise judgments
- **Distributes rewards** — automatic payment for completed ratings
- **Anonymizes data** — preference data as a public good (opt-in)

## Design

### Sessions

An RLHF session is created by a prompt author who wants feedback on their prompt's outputs against a specific model. The author funds a reward pool at session creation time.

```
Session Lifecycle:
1. Author creates session, deposits reward pool
2. Raters submit preferences (output A vs output B)
3. Raters submit 1-5 ratings for individual outputs
4. Author finalizes session
5. Raters claim rewards
```

### Account Model

```
RlhfSession (PDA: ["rlhf_session", session_id])
├── authority             → Session creator (prompt author)
├── prompt_cid            → The prompt being evaluated
├── model_name            → Model being tested (e.g., "gpt-4o-2026-03-01")
├── max_preferences       → Cap on preference submissions
├── reward_per_preference → $PROMPT reward per submission
├── total_reward_pool     → max_preferences * reward_per_preference
├── distributed_rewards   → Running total of rewards paid out
└── is_active             → Whether session is accepting submissions

Preference (PDA: ["rlhf_preference", session, preference_id])
├── rater                 → Rater wallet
├── preferred_output_uri  → URI of preferred output
├── rejected_output_uri   → URI of rejected output
├── criteria              → Evaluation criteria text
└── reward_claimed        → Whether reward has been claimed

RlhfRating (PDA: ["rlhf_rating", session, rating_id])
├── rater                 → Rater wallet
├── output_uri            → URI of output being rated
├── rating_value          → 1-5 rating
├── criteria              → Rating criteria
└── reward_claimed

RlhfReward (PDA: ["rlhf_reward", rater, session])
├── total_preferences     → Count of preferences submitted
├── total_ratings         → Count of ratings submitted
├── total_earned          → Total rewards earned
└── claimed_amount        → Amount claimed so far
```

### Instructions

#### init_session

Creates a new RLHF session. Transfers `total_reward_pool` from the author to the session PDA (held in escrow).

**Args:** `session_id: String`, `prompt_cid: String`, `model_name: String`, `max_preferences: u64`, `reward_per_preference: u64`

#### submit_preference

Rater submits a pairwise preference judgment. Creates a `Preference` PDA and a `RlhfReward` PDA (if first submission).

**Args:** `preference_id: String`, `preferred_output_uri: String`, `rejected_output_uri: String`, `criteria: String`

#### submit_rating

Rater submits a 1-5 rating for a single output.

**Args:** `rating_id: String`, `output_uri: String`, `rating_value: u8`, `criteria: String`

#### claim_reward

Rater claims accumulated rewards. Transfers `total_earned - claimed_amount` from session PDA to rater's wallet via system program CPI.

#### finalize_session

Session creator marks the session as ended. No more submissions accepted after finalization.

## Backward Compatibility

Does not affect any existing programs. RLHF is a standalone subsystem.

## Security Considerations

- **Sybil resistance:** Each rater wallet = 1 vote. No stake requirement (reputation from Layer 2 can be required in future).
- **Escrow:** Session funds are held in a PDA. Only raters who actually submit can claim.
- **Double-claim prevention:** `RlhfReward.claimed_amount` ensures no double-spend.
- **Session finalization:** Only the session authority can finalize, preventing premature closure by malicious parties.

## Drawbacks

- No dispute resolution for unfair ratings
- Reward pool must be funded upfront — creates friction for session creation

## Open Questions

- Should preference data be publicly accessible (as a public good)?
- How to handle raters who submit low-quality preferences (spam)?
- Should there be an appeals mechanism for rejected preferences?
