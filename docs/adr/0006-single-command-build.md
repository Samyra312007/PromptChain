# ADR-0006: Single-Command Build with Makefile

| Field | Value |
|-------|-------|
| Status | `Accepted` |
| Author | PromptChain Core |
| Created | 2026-02-20 |
| Last Updated | 2026-02-20 |

## Context

PromptChain has 5 Anchor programs, an npm workspace with 12+ packages, a Python SDK, a Rust SDK, a Codama code generator, a VS Code extension, and a GitHub Action. Building any individual component requires knowing the right incantation: `cd X && npm install && npm run build && cd ../Y && cargo build`.

This fails the "one command" test. New contributors give up before they start.

## Decision

Use a top-level `Makefile` with `make all` as the single entry point. Each build target delegates to the component's native build system.

## Rationale

1. **Universal interface** — `make` is available on every platform we target (Linux, macOS, Windows via WSL). No assumption about npm, cargo, or pip being the "primary" build tool.

2. **Layered targets** — `make all` builds everything. `make build-sdk` builds just the TypeScript SDK. Developers working on one component don't need to rebuild everything.

3. **Fail-fast** — Make fails the entire build if any component fails. No silent failures. Combined with `make -j` for parallel builds.

4. **Release entry point** — `make release` runs the release checklist (version bump, IDL regeneration, tests, build, signing, publish). One command for a 10-step process.

5. **CI integration** — GitHub Actions call `make build` and `make test`. No inline shell scripts in workflow files. Local builds match CI builds exactly.

## Alternatives Considered

- **npm scripts only:** Fails because Rust/Cargo, Python/pip, and Solana/Anchor are not npm-managed. We'd need `shell: scripts` in npm anyway.

- **Just (command runner):** Rust-based, faster than Make, but requires `cargo install just`. One more barrier for new contributors.

- **Taskfile:** Similar to Just but for Go. Same adoption problem.

- **Shell scripts:** Tested. They grow organically into unreadable messes with inconsistent error handling. Make at least forces target structure.

## Consequences

- **Positive:** One-command build (`make`), clear target hierarchy, CI matches local, no magic
- **Negative:** Make's tab-based syntax is archaic and error-prone (spaces instead of tab = cryptic error)
- **Mitigation:** `.editorconfig` enforces tab indentation for Makefile. CI catches syntax errors.
