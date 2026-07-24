# RFC-0000: [Title]

| Field | Value |
|-------|-------|
| Status | `Draft` / `Accepted` / `Rejected` / `Implemented` / `Superseded` |
| Author | [Name / Wallet Address] |
| Created | [YYYY-MM-DD] |
| Last Updated | [YYYY-MM-DD] |
| Superseded By | RFC-NNNN (if applicable) |
| Supersedes | RFC-NNNN (if applicable) |

## Summary

One paragraph — what does this RFC propose?

## Motivation

Why is this change necessary? What problem does it solve? What user-facing impact does it have?

## Design

### Interface Changes

What changes (if any) to the kernel interface, account layout, or instruction encoding?

```
Before:
  publish(cid, metadata_uri, license) → Prompt PDA

After:
  publish(cid, metadata_uri, license, nonce) → Prompt PDA
```

### Account Changes

New/Modified PDA structures:

```rust
#[account]
pub struct NewAccount {
    // fields
}
```

### Instruction Encoding

Exact transaction format:

| Field | Type | Description |
|-------|------|-------------|
| instruction_discriminator | u8[8] | Anchor discriminator |
| ... | ... | ... |

## Backward Compatibility

- Does this break existing accounts?
- Does this change instruction formats?
- Migration strategy?

## Security Considerations

- New attack surfaces?
- Economic attacks?
- Front-running risk?

## Drawbacks

- Complexity trade-offs
- Performance impact
- Alternatives considered and why rejected

## Open Questions

- Things not yet decided
- Need further research
- Community input requested

## Implementation Plan

- Estimated LOC
- Test plan
- Migration timeline (if applicable)