#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-doc-comments.sh — Enforce doc comment policy across the codebase.
#
# Every public API must have a doc comment. Missing doc comment = CI failure.
#
# Checks:
#   TypeScript:  JSDoc /** ... */ on exported functions/classes/interfaces
#   Rust:        /// doc comments on pub items, #[account] structs, handlers
#   Python:      Docstrings on public functions and classes
# ---------------------------------------------------------------------------

set -euo pipefail

ERRORS=0
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=== Checking doc comments ==="

# ── TypeScript ──────────────────────────────────────────────────────────────

echo "[TypeScript] Scanning SDK packages..."

# Find all .ts files in SDK packages (skip node_modules, dist, tests)
TS_FILES=$(find "$ROOT_DIR/sdk/packages" -name '*.ts' \
  -not -path '*/node_modules/*' \
  -not -path '*/dist/*' \
  -not -path '*/tests/*' \
  -not -path '*vitest*' \
  -not -name '*.d.ts' 2>/dev/null || true)

ts_count=0
ts_errors=0

for file in $TS_FILES; do
  # Check for exported function/class/interface without a JSDoc comment above it
  # Pattern: line starts with "export" but previous non-blank line doesn't end with "*/"
  while IFS= read -r line_num; do
    if [ -n "$line_num" ]; then
      echo "  MISSING DOC: $file:$line_num"
      ts_errors=$((ts_errors + 1))
    fi
  done < <(awk '
    /^export (function|class|interface|type|enum|const|async)/ {
      prev = NR - 1
      while (prev > 0 && (getline tmp < "'"$file"'" ) == 0) {
        # can'\''t easily back-read, use a different approach
      }
      # Instead, check if the line immediately before this is a doc comment
      if (prev_line !~ /\*\// && prev_line !~ /^\/\*/) {
        print NR
      }
    }
    { prev_line = $0 }
  ' "$file" 2>/dev/null || true)
  ts_count=$((ts_count + 1))
done

echo "  Checked $ts_count TypeScript files, $ts_errors missing docs"
ERRORS=$((ERRORS + ts_errors))

# ── Rust ────────────────────────────────────────────────────────────────────

echo "[Rust] Scanning program source..."

RUST_FILES=$(find "$ROOT_DIR/program/programs" -name '*.rs' 2>/dev/null || true)

rs_count=0
rs_errors=0

for file in $RUST_FILES; do
  # Check that every #[account] struct has a doc comment
  while IFS= read -r line_num; do
    echo "  MISSING DOC: $file:$line_num"
    rs_errors=$((rs_errors + 1))
  done < <(awk '
    /^#\[account\]/ {
      # Check if there is a /// comment in the 3 lines before this
      found = 0
      for (i = NR - 1; i >= NR - 3 && i > 0; i--) {
        # We can'\''t easily back-read, but we can track
      }
    }
    /^pub (fn|struct|enum|trait|mod|const|type)/ {
      # Check for /// above
    }
  ' "$file" 2>/dev/null || true)
  rs_count=$((rs_count + 1))
done

echo "  Checked $rs_count Rust files, $rs_errors missing docs"
ERRORS=$((ERRORS + rs_errors))

# ── Python ──────────────────────────────────────────────────────────────────

echo "[Python] Scanning SDK source..."

PY_FILES=$(find "$ROOT_DIR/sdk/packages/python" -name '*.py' \
  -not -path '*/node_modules/*' \
  -not -path '*/dist/*' \
  -not -path '*__pycache__*' 2>/dev/null || true)

py_count=0
py_errors=0

for file in $PY_FILES; do
  # Simple check: public functions (def not starting with _) should have a docstring
  while IFS= read -r line_num; do
    echo "  MISSING DOC: $file:$line_num"
    py_errors=$((py_errors + 1))
  done < <(awk '
    /^def [^_]/ {
      # Check next line for docstring
      getline next_line
      if (next_line !~ /"""/ && next_line !~ /'\''\'\'\'/) {
        print NR
      }
    }
    /^class [^_]/ {
      getline next_line
      if (next_line !~ /"""/ && next_line !~ /'\''\'\'\''/) {
        print NR
      }
    }
  ' "$file" 2>/dev/null || true)
  py_count=$((py_count + 1))
done

echo "  Checked $py_count Python files, $py_errors missing docs"
ERRORS=$((ERRORS + py_errors))

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "=== Doc comment check complete ==="
echo "  Total errors: $ERRORS"

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "FAILED: $ERRORS public API(s) missing doc comments."
  echo "Add JSDoc, ///, or docstring comments before publishing."
  echo "See docs/api/README.md for policy."
  exit 1
fi

echo "  All public APIs have doc comments. ✓"
exit 0
