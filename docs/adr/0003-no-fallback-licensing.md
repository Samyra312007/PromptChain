# ADR-0003: No Fallback Licensing — Every Prompt Must Explicitly Choose

| Field | Value |
|-------|-------|
| Status | `Accepted` |
| Author | PromptChain Core |
| Created | 2026-01-25 |
| Last Updated | 2026-01-25 |

## Context

When a prompt is published without an explicit license, what happens? Common approaches:
- **All rights reserved** (default- restrictive)
- **CC-BY 4.0** (default- permissive)
- **No default — license required** (hard requirement)

## Decision

No fallback license. If `Prompt.license` is `Pubkey::default()` (unset), the protocol treats it as **private/unlicensed**. The `use_prompt` instruction requires a license to be set, or the caller provides one at usage time.

## Rationale

1. **Legal clarity:** "All rights reserved" is a legal concept that varies by jurisdiction. "No license" is unambiguous — the protocol simply does not enforce any license terms. If the author wants to grant rights, they must set a license.

2. **Anti-feature principle:** The kernel is minimal. License enforcement is a feature. If we default to a license, we're making a legal decision on behalf of the user. The kernel doesn't do that.

3. **Future-proofing:** A future licensing standard (e.g., "PromptChain Open License v2") might not be backward-compatible with today's default. By requiring explicit licensing, we avoid legacy default obligations.

4. **Discoverability:** Users can query all unlicensed prompts and know they are in the public domain (morally, if not legally). No ambiguity about "did the author mean to release this?"

## Alternatives Considered

- **Default CC-BY 4.0:** Most permissive option. Rejected because it surprises authors who didn't intend to waive rights. A prompt is intellectual property; defaulting to open licensing is not our place.

- **Default "All Rights Reserved":** Most restrictive option. Rejected because it implies legal enforcement that the protocol cannot provide. The kernel is not a court.

- **Default to prompt author's preference in metadata:** Rejected because metadata is off-chain and mutable. The on-chain license field should be the single source of truth.

## Consequences

- **Positive:** Clear legal posture, no surprises for authors, protocol stays neutral
- **Negative:** Users must explicitly create a license PDA, adding one extra transaction to the publish flow
- **Mitigation:** The CLI and SDK provide helper commands (`promptchain license create`) and the publish flow suggests creating a license if the user hasn't
