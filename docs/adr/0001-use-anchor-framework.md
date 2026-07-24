# ADR-0001: Use Anchor Framework for Solana Programs

| Field | Value |
|-------|-------|
| Status | `Accepted` |
| Author | PromptChain Core |
| Created | 2026-01-10 |
| Last Updated | 2026-01-10 |

## Context

PromptChain needs to deploy 5+ Solana programs with complex account management, PDA derivation, CPI calls, and cross-program integration. We need a framework that handles:
- Account validation and deserialization
- PDA seed derivation
- Discriminator generation
- Cross-program invocation safety
- IDL generation for client SDKs

## Decision

Use [Anchor](https://www.anchor-lang.com/) v0.32.1 for all on-chain programs.

## Rationale

1. **PDA management** — Anchor's `#[derive(Accounts)]` and `seeds`/`bump` constraints handle 99% of PDA boilerplate. Without Anchor, each instruction would need ~50 lines of manual PDA verification.

2. **Discriminator safety** — Anchor's 8-byte instruction and account discriminators prevent accidental collision. Native Solana programs use manual discriminator checks that are easy to get wrong.

3. **IDL generation** — `anchor build` produces a JSON IDL that Codama and `@coral-xyz/anchor` consume directly. Manual IDL maintenance is error-prone and falls out of sync.

4. **CPI safety** — Anchor's `CpiContext` enforces account validation at compile time for CPI calls. The `promptchain-token-economics` program makes 6+ CPI calls to the SPL Token program; manual CPI would be ~3x more code.

5. **Test harness** — `anchor test` provides a local validator with account snapshotting. The alternative (solana-test-validator + manual keypair management) adds significant CI complexity.

6. **Ecosystem** — `@coral-xyz/anchor` is the standard TypeScript SDK for Solana. Using Anchor means the SDK is generated, not hand-written.

## Alternatives Considered

- **Native Solana (no framework):** More control, less magic. Rejected because the account validation boilerplate would make each instruction ~100-150 lines instead of ~40-60. The risk of PDA seed bugs (which have caused $100M+ exploits in production) outweighs the control benefit.

- **Seahorse (Python framework):** Higher-level but less mature. No Codama integration. Rejected because the Solana Python ecosystem is not production-ready for complex programs.

- **Pinocchio:** Lighter than Anchor but lacks the IDL generation that makes our SDK multiverse (TypeScript + Rust + Python + Codama) feasible.

## Consequences

- **Positive:** Rapid development, strong safety guarantees, auto-generated IDLs, full TypeScript SDK generated
- **Negative:** Anchor version lock-in — upgrading Anchor requires coordinated changes across 5 programs
- **Trade-off:** Anchor adds ~50KB to binary size (negligible on Solana)

Anchor's 0.32.1 version was chosen for `init-if-needed` support and the latest `#[derive(InitSpace)]` macro for RLHF accounts.
