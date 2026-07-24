# PromptChain Documentation

> "Read the source" is not documentation. But neither is a 500-page spec nobody reads.

## Contents

| Section | Description |
|---------|-------------|
| [Protocol Specification](protocol-spec.md) | Wire format, account layout, instruction encoding. Single source of truth. |
| [RFC Process](rfc/0000-template.md) | Proposal-driven design. Every significant change starts as an RFC. |
| [Architecture Decision Records](adr/) | Why we made every non-trivial engineering decision. |
| [Tutorials](tutorials/) | Three tiers: 5-min Hello Prompt, 30-min Prompt Engineer, 2-hr Protocol Developer. |
| [API Reference](api/) | Auto-generated from doc comments. Rustdoc, TSDoc, pydoc. |

## Reading Order

1. **New user:** Start with [Hello, Prompt](tutorials/01-hello-prompt.md) (5 minutes)
2. **Prompt engineer:** Take the [Prompt Engineer](tutorials/02-prompt-engineer.md) tutorial (30 minutes)
3. **Integration developer:** Read the [Protocol Specification](protocol-spec.md) (15 minutes)
4. **Protocol developer:** Complete the [Protocol Developer](tutorials/03-protocol-developer.md) tutorial (2 hours)
5. **Contributor:** Read active [RFCs](rfc/) and [ADRs](adr/) to understand design rationale

## RFC Index

| # | Title | Status |
|---|-------|--------|
| 0001 | [Prompt Asset Interface](rfc/0001-prompt-asset-interface.md) | `Implemented` |
| 0002 | [Curation Engine](rfc/0002-curation-engine.md) | `Implemented` |
| 0003 | [Token Economics](rfc/0003-token-economics.md) | `Implemented` |
| 0004 | [DAO Governance](rfc/0004-governance-dao.md) | `Implemented` |
| 0005 | [RLHF Coordination](rfc/0005-rlhf-coordination.md) | `Implemented` |

## ADR Index

| # | Title | Status |
|---|-------|--------|
| 0001 | [Use Anchor Framework](adr/0001-use-anchor-framework.md) | `Accepted` |
| 0002 | [libp2p Over gRPC](adr/0002-libp2p-over-grpc.md) | `Accepted` |
| 0003 | [No Fallback Licensing](adr/0003-no-fallback-licensing.md) | `Accepted` |
| 0004 | [SMT-Based Cache Invalidation](adr/0004-smt-cache-invalidation.md) | `Accepted` |
| 0005 | [Reputation Scoring Formula](adr/0005-reputation-scoring-formula.md) | `Accepted` |
| 0006 | [Single-Command Build](adr/0006-single-command-build.md) | `Accepted` |

## Doc Comment Policy

Every public API must have a doc comment. Missing doc comment = CI failure. The check script at `docs/scripts/check-doc-comments.sh` enforces this.

## Creating New RFCs

1. Copy `rfc/0000-template.md` to `rfc/NNNN-my-title.md`
2. Fill in the template — summary, motivation, design, backward compatibility, security
3. Submit as a pull request with status `Draft`
4. After discussion and approval, update status to `Accepted`
5. After implementation, update status to `Implemented`

## Creating New ADRs

1. Copy an existing ADR or use the template from `rfc/0000-template.md`
2. Write in the Context → Decision → Rationale → Alternatives → Consequences format
3. Number sequentially (e.g., `0007-my-decision.md`)
4. ADRs are immutable once written — if a decision is reversed, write a new ADR superseding the old one

## Contributing to Documentation

- **Protocol specification:** Edit `protocol-spec.md` directly. Keep it in sync with the Anchor IDL.
- **Tutorials:** Test every command before committing. Tutorials must work end-to-end on devnet.
- **API reference:** Add doc comments to source code, then run `make docs` to regenerate.
- **RFCs/ADRs:** Use the templates. If it's not worth an RFC, it's not worth doing.