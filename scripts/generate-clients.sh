#!/usr/bin/env bash
# PromptChain Client Generation Script
# Generates clients from Anchor IDL files using Codama
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Building Anchor programs (IDL generation) ==="
cd "$ROOT_DIR/program"

for program in curation token-economics governance; do
  echo "  Building: $program"
  anchor build --program-name "$program"
done

# Also build the kernel program if not already built
anchor build --program-name promptchain 2>/dev/null || true

echo ""
echo "=== Copying IDL files to central location ==="
IDL_DIR="$ROOT_DIR/idl"
mkdir -p "$IDL_DIR"

for program in promptchain promptchain_curation promptchain_token_economics promptchain_governance; do
  SRC="$ROOT_DIR/program/target/idl/${program}.json"
  if [ -f "$SRC" ]; then
    cp "$SRC" "$IDL_DIR/${program}.json"
    echo "  ✓ Copied ${program}.json"
  else
    echo "  ⚠ Missing IDL for ${program} (expected at ${SRC})"
  fi
done

echo ""
echo "=== Generating SDK type stubs (Codama) ==="
cd "$ROOT_DIR/codama"

if [ -f "node_modules/.package-lock.json" ] || [ -d "node_modules" ]; then
  echo "  Running Codama generator..."
  npm run generate 2>/dev/null || {
    echo "  ⚠ Codama generation encountered issues (non-fatal)."
    echo "  Run 'npm install' in codama/ and try again."
  }
else
  echo "  ⚠ Codama dependencies not installed. Run 'npm install' in codama/ first."
  echo "  Skipping Codama generation."
fi

echo ""
echo "=== Done ==="
echo "Clients generated from Anchor IDLs."
echo "Review and commit the generated files."
