# Auto-Tagging ML Pipeline (Ongoing Research)

## Overview

The auto-tagging pipeline reads prompt text and generates structured metadata
tags. All tags are **suggested** — human curators verify them and earn reputation
for accurate verification.

## Tag Types

| Tag Type | Values | Example |
|----------|--------|---------|
| Category | code, writing, reasoning, creative, analysis, instruction | `code` |
| Difficulty | 1-10 (inferred from complexity heuristics) | `7` |
| Model Compatibility | gpt-4o, claude-3, llama-3, mistral, gemini | `["gpt-4o", "claude-3"]` |
| Task Type | generation, classification, extraction, transformation,问答 | `generation` |
| Language | rust, python, typescript, natural-language | `rust` |
| Similar Prompts | Top-5 CID recommendations via embedding similarity | `["Qm...", "Qm..."]` |

## Architecture (Design)

```
prompt text
    │
    ▼
┌─────────────────────┐
│  Embedding Model    │  (sentence-transformers or similar)
│  (768-dim vector)   │
└─────────┬───────────┘
          │ vector
          ▼
┌─────────────────────┐
│  Classifier Head    │  (lightweight ONNX model, runs in-browser or edge)
│  category/difficulty│
└─────────┬───────────┘
          │ tags
          ▼
┌─────────────────────┐
│  Similarity Index   │  (cosine similarity to indexed prompt vectors)
│  (FAISS or HNSW)    │
└─────────┬───────────┘
          │ recommendations
          ▼
┌─────────────────────┐
│  Format & Submit    │  → Suggested tags stored in metadata_uri
└─────────────────────┘
```

## Implementation Approach

### Phase 1 (Current): Rule-based
- Category detection via keyword matching against prompt text
- Language detection via common keyword sets (fn → Rust, def → Python)
- Difficulty based on word count, code-to-text ratio, and instruction complexity

### Phase 2 (Next): Embedding-based
- Fine-tune a small LLM (e.g., DistilBERT or MiniLM) on labeled prompt data
- Generate embeddings at publish time via an off-chain indexer service
- Store embeddings in the prompt's metadata_uri for similarity search

### Phase 3 (Future): On-chain verification
- Curators stake on tag accuracy
- ZK proofs for model inference integrity
- Decentralized inference network

## Verification Loop

1. ML pipeline suggests tags → stored as `suggested_tags` in metadata
2. Curators review suggested tags and either approve or correct
3. Correcting tags earns reputation (more than initial curation)
4. If 5+ curators agree on a tag, it becomes "verified"
5. Verified tags boost the prompt's search ranking

## Integration Points

- **Indexer service**: Calls auto-tagger on new prompt events
- **CLI**: `promptchain suggest-tags <prompt-file>` for local testing
- **Curation Engine**: Tags are stored as structured fields in metadata_uri
- **Search Index**: Tagged prompts are indexed for category/tag filtering
