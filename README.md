# PromptChain

> A Decentralized Protocol for AI Prompts as First-Class Digital Assets

PromptChain is a protocol on Solana that turns AI prompts into verifiable,
transferable, license-enforced digital assets. Think `git` for prompts — boring
infrastructure that everyone uses and nobody thinks about.

## The Kernel (Layer 0)

The kernel does exactly **five things**:

| Instruction | Description |
|---|---|
| `publish` | Register a prompt (CID → wallet) |
| `create_version` | Fork a prompt into a new version (DAG, like git) |
| `transfer` | Transfer prompt ownership |
| `set_license` | Create a license with royalty terms |
| `use_prompt` | Record usage, enforce royalty via CPI |

Everything else — curation, reputation, search, tokens, marketplaces — is a
separate subsystem that plugs into these five interfaces.

## Repository Structure

```
promptchain/
├── program/                  # Anchor program (the kernel)
│   ├── programs/promptchain/
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── errors.rs
│   │       ├── state/        # Prompt, PromptVersion, License
│   │       └── instructions/ # publish, create_version, set_license, transfer, use_prompt
│   ├── Anchor.toml
│   └── Cargo.toml
├── sdk/
│   ├── packages/
│   │   ├── @promptchain/client  # TypeScript SDK wrapping the kernel
│   │   └── @promptchain/schema  # Metadata schemas and constants
│   └── package.json
├── clients/                  # Language clients (future)
├── idl/                      # Anchor IDL snapshots
└── scripts/                  # Dev scripts
```

## Quick Start

```bash
# Build the Anchor program
cd program
anchor build

# Install SDK deps
cd ../sdk
npm install
```

## Design Philosophy

PromptChain follows the **Linus Principle**: do one thing well (a content-addressed
prompt registry with cryptographic ownership) and design interfaces that let
everything else attach.

- **Immutable CID → content mapping**
- **Verifiable ownership chain**
- **Version DAG with parent pointers**
- **License attachment with on-chain royalty enforcement**

## License

MIT — see [LICENSE](./LICENSE).
