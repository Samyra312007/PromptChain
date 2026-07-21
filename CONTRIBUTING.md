# Contributing

PromptChain is an open, community-driven protocol. Contributions of all kinds
are welcome.

## Principles

- **Do not break userspace** — backward compatibility for kernel interfaces is
  non-negotiable.
- **Trust but verify** — anyone can submit code; reviewed by 2+ core contributors.
- **Rough consensus and running code** — RFC process documented, but shipping
  matters more.
- **Linus's Law** — with enough eyeballs, all bugs are shallow. Open everything.

## Getting Started

1. Fork the repository.
2. Install prerequisites: Rust, Solana CLI, Anchor 0.32.x, Node.js 20+.
3. Run `cd program && anchor build` to verify the kernel compiles.
4. Run `cd sdk && npm install && npm run build` to verify the TypeScript SDK.

## Development Workflow

### Kernel (Anchor Program)

```bash
cd program
anchor build        # compiles the BPF program
anchor test         # runs integration tests (requires local validator)
```

### TypeScript SDK

```bash
cd sdk
npm install
npm run build       # compiles all packages
```

## Pull Request Process

1. Open an issue describing the change before writing code (unless it's a trivial fix).
2. Write tests for new functionality.
3. Ensure the kernel builds without warnings.
4. Update the TypeScript client if you change the program interface.
5. Request review from at least 2 core contributors.

## Code Style

- **Rust**: Follow standard Rust conventions. Use `cargo fmt` and `cargo clippy`.
- **TypeScript**: Use the existing patterns in the SDK. Prefer explicit types over `any`.
- **No commenting style wars**: Match the surrounding code.

## Layer Architecture

Each layer depends only on layers below it. When contributing:

- **Layer 0** changes affect everything — they get the most scrutiny.
- **Layers 1+** should never require kernel changes. If they do, reconsider the design.

## Security

Report security vulnerabilities privately to the maintainers. Do not file public
issues for critical security bugs.
