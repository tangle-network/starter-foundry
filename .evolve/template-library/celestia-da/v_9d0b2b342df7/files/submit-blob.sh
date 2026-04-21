#!/usr/bin/env bash
# Submit a blob to Celestia and retrieve it in one round-trip via the node RPC.
#
# Usage:  bash submit-blob.sh "some message"
# Env:    CELESTIA_NODE_AUTH_TOKEN (required) — grab with:
#           docker compose exec node celestia light auth admin --p2p.network mocha-4
set -euo pipefail

: "${CELESTIA_NODE_AUTH_TOKEN:?set CELESTIA_NODE_AUTH_TOKEN first}"

RPC="http://127.0.0.1:26658"
NAMESPACE="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGE="
PAYLOAD="${1:-hello celestia}"

# Base64-encode the payload (RPC expects base64 for blob.data)
DATA_B64=$(printf '%s' "$PAYLOAD" | base64 | tr -d '\n')

echo "==> submitting blob to namespace $NAMESPACE"
SUBMIT_RESP=$(curl -fsS -X POST "$RPC" \
  -H "Authorization: Bearer $CELESTIA_NODE_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"blob.Submit\",
    \"params\": [
      [{
        \"namespace\": \"$NAMESPACE\",
        \"data\": \"$DATA_B64\",
        \"share_version\": 0
      }],
      { \"gas_price\": 0.002 }
    ]
  }")

HEIGHT=$(printf '%s' "$SUBMIT_RESP" | grep -oE '"result":[0-9]+' | grep -oE '[0-9]+' || true)
if [ -z "$HEIGHT" ]; then
  echo "submit failed: $SUBMIT_RESP" >&2
  exit 1
fi

echo "==> included at height $HEIGHT"
echo "==> retrieving..."

curl -fsS -X POST "$RPC" \
  -H "Authorization: Bearer $CELESTIA_NODE_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 2,
    \"method\": \"blob.GetAll\",
    \"params\": [$HEIGHT, [\"$NAMESPACE\"]]
  }"
echo
