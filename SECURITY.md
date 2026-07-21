# Security

PromptChain is a blockchain protocol that will eventually manage real economic
value. Security is our highest priority.

## Scope

The following components are in scope for security reports:

- The Anchor program (`program/programs/promptchain/`)
- The TypeScript SDK (`sdk/packages/*/`)
- Any on-chain account validation logic
- CPI calls and royalty enforcement

Out of scope: the planning document, example code, documentation typos.

## Reporting a Vulnerability

**Do not file a public GitHub issue for security vulnerabilities.**

Send details to the maintainers via encrypted message. If PGP is available,
it will be listed here.

### What to include

- Type of vulnerability (re-entrancy, integer overflow, replay attack, etc.)
- Full reproduction steps or a proof-of-concept
- Affected component and version
- Suggested fix (if known)

### Response timeline

| Timeframe | Action |
|---|---|
| 24 hours | Acknowledgment of receipt |
| 7 days | Initial triage and severity assessment |
| 30 days | Patch or mitigation plan |
| 90 days | Public disclosure (coordinated) |

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| CID collision / spoofing | Verify CID length and format on-chain |
| Sybil attacks | Minimum SOL stake + economic slashing for outliers |
| Re-entrancy on royalties | Check-effects-interactions pattern |
| Metadata manipulation | Validate `metadata_uri` format; reject unparseable URIs |
| Front-running | PDA-based addressing; commit-reveal for curation |
| Governance capture | Reputation-weighted voting + timelock on treasury |

## Bug Bounty

A formal bug bounty program will be established at mainnet launch.