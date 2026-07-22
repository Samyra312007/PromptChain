# PromptChain Git Hooks

## Setup

```bash
git config core.hooksPath .githooks
chmod +x .githooks/*
```

## Available Hooks

- **pre-commit**: Validates prompt files before committing (checks for empty files, validates metadata)
- **post-commit**: Detects committed prompt files and reminds you to publish
- **prepare-commit-msg**: Appends prompt file references to commit messages

## Customization

Edit the hooks directly or modify `.promptchainrc` to toggle features.
