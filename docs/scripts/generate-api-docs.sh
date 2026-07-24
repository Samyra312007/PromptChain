#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# generate-api-docs.sh — Generate API documentation for all SDK packages.
#
# Generates:
#   TSDoc → docs/generated/ts/   (via Typedoc)
#   Rustdoc → docs/generated/rust/ (via cargo doc)
#   pydoc → docs/generated/python/ (via pydoc)
# ---------------------------------------------------------------------------

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DOCS_OUT="$ROOT_DIR/docs/generated"

echo "=== Generating API Documentation ==="
echo "Output: $DOCS_OUT"

mkdir -p "$DOCS_OUT"

# ── TypeScript (Typedoc) ────────────────────────────────────────────────────

echo ""
echo "[TypeScript] Generating TSDoc..."

if command -v npx &> /dev/null; then
  for pkg in "$ROOT_DIR"/sdk/packages/*/; do
    pkg_name=$(basename "$pkg")
    if [ -f "$pkg/tsconfig.json" ]; then
      echo "  Generating docs for @promptchain/$pkg_name..."
      mkdir -p "$DOCS_OUT/ts/$pkg_name"
      npx typedoc \
        --out "$DOCS_OUT/ts/$pkg_name" \
        --tsconfig "$pkg/tsconfig.json" \
        --entryPoints "$pkg/src/index.ts" \
        --name "@promptchain/$pkg_name" \
        --hideGenerator \
        --includeVersion \
        --disableSources \
        2>/dev/null || echo "  Warning: typedoc failed for $pkg_name" >&2
    fi
  done
else
  echo "  Warning: npx not found, skipping TSDoc generation"
fi

# ── Rust (cargo doc) ────────────────────────────────────────────────────────

echo ""
echo "[Rust] Generating Rustdoc..."

if command -v cargo &> /dev/null; then
  for prog in "$ROOT_DIR"/program/programs/*/; do
    prog_name=$(basename "$prog")
    echo "  Generating docs for $prog_name..."
    (cd "$prog" && cargo doc --no-deps --target-dir "$DOCS_OUT/rust/$prog_name" 2>/dev/null) || \
      echo "  Warning: cargo doc failed for $prog_name" >&2
  done

  # Rust SDK
  if [ -f "$ROOT_DIR/sdk/packages/rust/Cargo.toml" ]; then
    echo "  Generating docs for promptchain-rs..."
    (cd "$ROOT_DIR/sdk/packages/rust" && cargo doc --no-deps --target-dir "$DOCS_OUT/rust/promptchain_rs" 2>/dev/null) || \
      echo "  Warning: cargo doc failed for promptchain-rs" >&2
  fi
else
  echo "  Warning: cargo not found, skipping Rustdoc generation"
fi

# ── Python (pydoc) ──────────────────────────────────────────────────────────

echo ""
echo "[Python] Generating pydoc..."

if command -v python3 &> /dev/null; then
  python_src="$ROOT_DIR/sdk/packages/python/src"
  if [ -d "$python_src" ]; then
    echo "  Generating docs for promptchain-py..."
    mkdir -p "$DOCS_OUT/python"
    python3 -m pydoc -w "$python_src" 2>/dev/null && \
      mv "$ROOT_DIR"/*.html "$DOCS_OUT/python/" 2>/dev/null || \
      echo "  Warning: pydoc generation encountered issues" >&2
  fi
else
  echo "  Warning: python3 not found, skipping pydoc generation"
fi

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "=== API Documentation Generated ==="
echo "  TSDoc:   $DOCS_OUT/ts/"
echo "  Rustdoc: $DOCS_OUT/rust/"
echo "  pydoc:   $DOCS_OUT/python/"
echo ""
echo "Open in browser:"
echo "  file://$DOCS_OUT/ts/client/index.html"
echo "  file://$DOCS_OUT/rust/promptchain/doc/promptchain/index.html"
