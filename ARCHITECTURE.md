# Architecture

PromptChain is organized as a layered protocol. Each layer depends only on the
layers below it — you can replace the web app without touching the kernel.

## The Seven Layers

```
Layer 6: AI-Native Infrastructure   
  (Prompt compilers, ZK quality proofs, RLHF coordination)

Layer 5: End-User Applications       
  (Web app, Desktop, Mobile, Marketplace, Collab Suite)

Layer 4: Developer Ecosystem         
  (SDK in 7 langs, IDE plugins, CI/CD, Codama clients)

Layer 3: Economics & Governance      
  ($PROMPT token, staking, royalties, DAO treasury)

Layer 2: Quality & Discovery         
  (Curation engine, reputation, search, auto-tagging)

Layer 1: Storage & Access            
  (PromptFS virtual filesystem, P2P sync, IPFS layer)

Layer 0: THE KERNEL                  
  (~1500 lines of Anchor Rust, 5 instructions)
  ● Register prompt (CID → wallet)
  ● Version graph (DAG, like git)
  ● Transfer ownership
  ● Attach license
  ● Enforce royalty on use
```

## Layer 0 — The Kernel

The kernel is an Anchor program on Solana with three account types and five
instructions. It is deliberately minimal — no curation, no staking, no token
emissions. Those are separate subsystems that plug into the kernel's interfaces.

### Accounts

```
Prompt {
    authority: Pubkey,        // Current owner
    ipfs_cid: String,         // Content identifier (IPFS CID)
    metadata_uri: String,     // Off-chain metadata pointer
    license: Pubkey,          // Attached license (Pubkey::default() = none)
    total_versions: u32,      // Number of versions created
    total_uses: u64,          // Usage counter for royalty tracking
    bump: u8,                 // PDA bump seed
}

PromptVersion {
    parent: Pubkey,           // Parent prompt address
    version_number: u32,      // Sequential version ID
    author: Pubkey,           // Version author
    ipfs_cid: String,         // Content identifier for this version
    metadata_uri: String,     // Version metadata
    changelog_uri: String,    // Changelog/documentation
    bump: u8,
}

License {
    authority: Pubkey,        // License creator / royalty receiver
    name: String,             // Human-readable license name
    commercial_allowed: bool,
    attribution_required: bool,
    royalty_basis_points: u16, // Royalty rate (max 10,000 = 100%)
    bump: u8,
}
```

### Instructions

| Instruction | Accounts | Args | Description |
|---|---|---|---|
| `publish` | prompt (init), authority (signer), system_program | cid, metadata_uri, license (optional) | Register a new prompt |
| `create_version` | prompt (mut), version (init), authority (signer), system_program | cid, metadata_uri, changelog_uri | Fork a new version |
| `set_license` | license (init), authority (signer), system_program | name, commercial_allowed, attribution_required, royalty_bp | Create a license template |
| `transfer` | prompt (mut), current_authority (signer) | new_authority | Transfer prompt ownership |
| `use_prompt` | prompt (mut), license, payer (signer), license_authority, system_program | max_royalty_payment | Record use and pay royalty |

### PDA Derivation

```
Prompt:     seeds=["prompt", authority, cid]
Version:    seeds=["version", prompt_key, version_number]
License:    seeds=["license", authority, name]
```

### Anti-Features (explicitly NOT in the kernel)

- No curator staking
- No reputation scores
- No token mint/transfer
- No search index
- No NFT metadata extensions beyond CID

## Layer Boundaries

Higher layers communicate with lower layers through well-defined interfaces:

- **Layer 0 → Layer 1**: PromptFS reads Prompt/Version/License accounts via
  the Solana RPC and maps them to filesystem operations.
- **Layer 1 → Layer 2**: The curation engine reads kernel accounts (read-only CPI)
  and writes to its own `Curator` and `Reputation` PDAs.
- **Layer 2 → Layer 3**: Token economics uses the curation engine's ratings to
  distribute $PROMPT rewards.

No layer ever reads from a layer above it.

## Security Model

- All kernel accounts are PDAs — no one can withdraw SOL from them.
- Royalties are enforced via CPI to the System Program at usage time.
- Authority checks use the built-in Signer validation.
- Integer overflow is prevented with `checked_*` arithmetic.
- String lengths are bounded to prevent account size attacks.
