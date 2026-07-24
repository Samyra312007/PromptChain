# API Reference

> Auto-generated from doc comments. Missing doc comment = CI failure.

## SDK Packages

| Package | Language | Docs | Source |
|---------|----------|------|--------|
| `@promptchain/client` | TypeScript | [TSDocs](./client/) | `sdk/packages/client/src/` |
| `@promptchain/schema` | TypeScript | [TSDocs](./schema/) | `sdk/packages/schema/src/` |
| `@promptchain/storage` | TypeScript | [TSDocs](./storage/) | `sdk/packages/storage/src/` |
| `@promptchain/curation` | TypeScript | [TSDocs](./curation/) | `sdk/packages/curation/src/` |
| `@promptchain/token-economics` | TypeScript | [TSDocs](./token-economics/) | `sdk/packages/token-economics/src/` |
| `@promptchain/governance` | TypeScript | [TSDocs](./governance/) | `sdk/packages/governance/src/` |
| `@promptchain/cache` | TypeScript | [TSDocs](./cache/) | `sdk/packages/cache/src/` |
| `@promptchain/network` | TypeScript | [TSDocs](./network/) | `sdk/packages/network/src/` |
| `@promptchain/monitoring` | TypeScript | [TSDocs](./monitoring/) | `sdk/packages/monitoring/src/` |
| `@promptchain/backup` | TypeScript | [TSDocs](./backup/) | `sdk/packages/backup/src/` |
| `@promptchain/testing` | TypeScript | [TSDocs](./testing/) | `sdk/packages/testing/src/` |
| `@promptchain/release` | TypeScript | [TSDocs](./release/) | `sdk/packages/release/src/` |
| `@promptchain/compiler` | TypeScript | [TSDocs](./compiler/) | `sdk/packages/compiler/src/` |
| `@promptchain/zk-proofs` | TypeScript | [TSDocs](./zk-proofs/) | `sdk/packages/zk-proofs/src/` |
| `@promptchain/rlhf` | TypeScript | [TSDocs](./rlhf/) | `sdk/packages/rlhf/src/` |
| `promptchain-rs` | Rust | [Rustdoc](../generated/rust/promptchain_rs/) | `sdk/packages/rust/src/` |
| `promptchain-py` | Python | [pydoc](../generated/python/) | `sdk/packages/python/src/` |

## On-Chain Programs

| Program | Docs | Source |
|---------|------|--------|
| Kernel (`promptchain`) | [Rustdoc](../generated/rust/promptchain/) | `program/programs/promptchain/src/` |
| Curation Engine (`curation`) | [Rustdoc](../generated/rust/promptchain_curation/) | `program/programs/curation/src/` |
| Token Economics (`token-economics`) | [Rustdoc](../generated/rust/promptchain_token_economics/) | `program/programs/token-economics/src/` |
| Governance (`governance`) | [Rustdoc](../generated/rust/promptchain_governance/) | `program/programs/governance/src/` |
| RLHF (`promptchain-rlhf`) | [Rustdoc](../generated/rust/promptchain_rlhf/) | `program/programs/promptchain-rlhf/src/` |

## Generating API Docs

Run the generation script:

```bash
make docs
```

This generates:
- **TSDoc:** HTML documentation for all TypeScript packages (via `typedoc`)
- **Rustdoc:** HTML documentation for all Rust programs (via `cargo doc`)
- **pydoc:** HTML documentation for the Python SDK (via `pydoc`)

Generated docs are written to `docs/generated/`.

## Doc Comment Policy

Every public API must have a doc comment:

- **TypeScript:** JSDoc-style `/** ... */` comments on all exported functions, classes, and interfaces
- **Rust:** `///` doc comments on all `pub` items, all `#[account]` structs, all instruction handlers
- **Python:** Docstrings on all public functions and classes

The CI check script (`docs/scripts/check-doc-comments.sh`) enforces this policy. Missing doc comments fail the build.
