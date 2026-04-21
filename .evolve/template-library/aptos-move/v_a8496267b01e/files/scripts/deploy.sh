#!/usr/bin/env bash
set -euo pipefail

# Deploy {{PROJECT_NAME}} to Aptos devnet.
# Run `aptos init --network devnet` once before using this script.

NAMED_ADDR="module_addr=default"

echo "==> Compiling..."
aptos move compile --named-addresses "$NAMED_ADDR"

echo "==> Running tests..."
aptos move test --named-addresses "$NAMED_ADDR"

echo "==> Funding account..."
aptos account fund-with-faucet --account default

echo "==> Publishing..."
aptos move publish --named-addresses "$NAMED_ADDR"

echo "Done. Module published as default::{{MODULE_NAME}}"
