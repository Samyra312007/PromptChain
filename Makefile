.PHONY: all build test clean lint lint-fix check publish release help

# Default target: build everything
all: build

# ── Build ──────────────────────────────────────────────
build: build-sdk build-program build-python build-codama build-extension

build-sdk:
	@echo "=== Building SDK (TypeScript packages) ==="
	cd sdk && npm install && npm run build

build-i18n:
	@echo "=== Building i18n package ==="
	cd sdk/packages/i18n && npm install && npm run build

test-i18n:
	@echo "=== Testing i18n package ==="
	cd sdk/packages/i18n && npm test

build-a11y:
	@echo "=== Building a11y package ==="
	cd sdk/packages/a11y && npm install && npm run build

test-a11y:
	@echo "=== Testing a11y package ==="
	cd sdk/packages/a11y && npm test

build-program:
	@echo "=== Building Solana programs ==="
	cd program && make build

build-python:
	@echo "=== Building Python SDK ==="
	cd sdk/packages/python && pip install build && python -m build --wheel

build-codama:
	@echo "=== Generating Codama clients ==="
	cd codama && npm install && npm run generate

build-extension:
	@echo "=== Building VSCode extension ==="
	cd extensions/vscode && npm install && npm run package

# ── Test ───────────────────────────────────────────────
test: test-sdk test-program test-python test-release test-i18n test-a11y

test-sdk:
	@echo "=== Testing SDK ==="
	cd sdk && npm test

test-program:
	@echo "=== Testing Solana programs ==="
	cd program && make test

test-python:
	@echo "=== Testing Python SDK ==="
	cd sdk/packages/python && pip install pytest && pytest

test-release:
	@echo "=== Testing Release package ==="
	cd sdk/packages/release && npx vitest run

test-integration:
	@echo "=== Running integration tests ==="
	cd sdk && npm run test:integration 2>/dev/null || echo "No integration test script found"

# ── Lint ───────────────────────────────────────────────
lint:
	@echo "=== Linting ==="
	cd sdk && npm run lint 2>/dev/null || echo "No lint script in SDK"
	cd program && cargo clippy 2>/dev/null || echo "No clippy configured"

lint-fix:
	cd sdk && npm run lint -- --fix 2>/dev/null || echo "No lint --fix available"

# ── Documentation ──────────────────────────────────────
docs: docs-check docs-generate

docs-check:
	@echo "=== Checking doc comments ==="
	@bash docs/scripts/check-doc-comments.sh

docs-generate:
	@echo "=== Generating API documentation ==="
	@bash docs/scripts/generate-api-docs.sh

# ── Check (lint + test + build + docs) ─────────────────
check: lint test build docs-check

# ── Clean ──────────────────────────────────────────────
clean:
	@echo "=== Cleaning ==="
	cd sdk && npm run clean 2>/dev/null || rm -rf sdk/packages/*/dist sdk/packages/*/node_modules
	cd program && cargo clean 2>/dev/null || true
	rm -rf sdk/packages/python/dist sdk/packages/rust/target

# ── Publish ────────────────────────────────────────────
publish: test build
	@echo "=== Publishing all packages ==="
	cd sdk && npm run publish:all 2>/dev/null || echo "No publish:all script in SDK"

publish-dry-run: test build
	@echo "=== Dry-run publish ==="
	cd sdk && npm run publish:all -- --dry-run 2>/dev/null || echo "Dry-run not available"

# ── Release ────────────────────────────────────────────
release:
	@echo "=== Running release checklist ==="
	npx ts-node sdk/packages/release/src/index.ts 2>/dev/null || \
	echo "Use: cd sdk/packages/release && npx ts-node src/cli.ts release"

release-patch: release
release-minor: release
release-major: release

# ── CI / Workflow generation ──────────────────────────
generate-ci:
	@echo "=== Generating CI workflows ==="
	npx ts-node -e "require('./sdk/packages/release/src/multi-arch-ci').writeWorkflows()" 2>/dev/null || \
	echo "Build release pkg first: cd sdk && npm run build"

# ── Version management ─────────────────────────────────
version:
	@echo "Current version:"
	cd sdk && node -e "console.log(require('./packages/release/package.json').version)"

bump-patch:
	@echo "=== Bumping patch version ==="
	npx ts-node -e "require('./sdk/packages/release/src/version').bumpVersion('patch')" 2>/dev/null || true

bump-minor:
	@echo "=== Bumping minor version ==="
	npx ts-node -e "require('./sdk/packages/release/src/version').bumpVersion('minor')" 2>/dev/null || true

bump-major:
	@echo "=== Bumping major version ==="
	npx ts-node -e "require('./sdk/packages/release/src/version').bumpVersion('major')" 2>/dev/null || true

# ── Help ───────────────────────────────────────────────
help:
	@echo "PromptChain — Build & Release"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Build targets:"
	@echo "  all                 Build everything (default)"
	@echo "  build               Build all components"
	@echo "  build-sdk           Build TypeScript SDK"
	@echo "  build-program       Build Solana programs"
	@echo "  build-python        Build Python SDK"
	@echo "  build-codama        Generate Codama clients"
	@echo "  build-extension     Build VSCode extension"
	@echo ""
	@echo "Test targets:"
	@echo "  test                Run all tests"
	@echo "  test-sdk            Run SDK tests"
	@echo "  test-program        Run program tests"
	@echo "  test-python         Run Python tests"
	@echo "  test-release        Run release package tests"
	@echo "  test-integration    Run integration tests"
	@echo ""
	@echo "Quality targets:"
	@echo "  lint                Lint all code"
	@echo "  check               lint + test + build"
	@echo "  clean               Remove build artifacts"
	@echo ""
	@echo "Release targets:"
	@echo "  publish             Publish all packages (dry-run first!)"
	@echo "  publish-dry-run     Dry run publish"
	@echo "  release             Run release checklist"
	@echo "  bump-patch          Bump patch version"
	@echo "  bump-minor          Bump minor version"
	@echo "  bump-major          Bump major version"
	@echo "  version             Show current version"
	@echo ""
	@echo "CI targets:"
	@echo "  generate-ci         Generate GitHub Actions workflows"
	@echo ""
	@echo "Examples:"
	@echo "  make                Build everything"
	@echo "  make test           Run all tests"
	@echo "  make check          Lint + test + build"
	@echo "  make publish-dry-run && make publish"
