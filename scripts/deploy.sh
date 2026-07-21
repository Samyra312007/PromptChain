#!/usr/bin/env bash
set -euo pipefail

NETWORK="${1:-localnet}"

case "$NETWORK" in
  localnet)
    CLUSTER="localnet"
    ;;
  devnet)
    CLUSTER="devnet"
    ;;
  mainnet)
    CLUSTER="mainnet-beta"
    ;;
  *)
    echo "Usage: $0 [localnet|devnet|mainnet]"
    exit 1
    ;;
esac

echo "=== Building program ==="
cd "$(dirname "$0")/../program"
anchor build

echo "=== Deploying to $CLUSTER ==="
case "$CLUSTER" in
  localnet)
    solana-test-validator --reset &
    VALIDATOR_PID=$!
    sleep 3
    anchor deploy --provider.cluster localnet
    kill $VALIDATOR_PID 2>/dev/null || true
    ;;
  *)
    anchor deploy --provider.cluster "$CLUSTER"
    ;;
esac

echo "=== Building SDK ==="
cd "$(dirname "$0")/../sdk"
npm install
npm run build

echo "=== Done ==="
echo "Program deployed to $CLUSTER"
echo "Program ID: $(grep declare_id ../program/programs/promptchain/src/lib.rs | head -1 | cut -d\" -f2)"
