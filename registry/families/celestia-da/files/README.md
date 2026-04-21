# {{serviceName}}

Celestia data-availability starter. Runs a **light node** against the `{{celestiaNetwork}}` testnet via docker-compose, plus a Go client that submits and retrieves blobs through the node's JSON-RPC interface.

## What Celestia gives you

A blob is arbitrary bytes committed under a 29-byte **namespace**. Once included in a Celestia block, any observer can retrieve it by `(height, namespace, commitment)` — that's the DA guarantee. Rollups use this as their DA layer instead of posting calldata to Ethereum L1.

## Architecture

```
┌─────────────────┐    JSON-RPC     ┌──────────────────────┐     P2P     ┌────────────────┐
│ client/main.go  │  ─────────────> │ celestia-node:light  │  <────────> │  Celestia net  │
│  - Submit blob  │   (port {{rpcPort}})  │  (docker-compose)    │             │   ({{celestiaNetwork}})      │
│  - Retrieve blob│                 │                      │             │                │
└─────────────────┘                 └──────────────────────┘             └────────────────┘
```

## Prereqs

- Docker (for the light node)
- Go 1.22+ (for the client)

## Quick start

```bash
# 1. Start the light node (first run syncs headers — takes a minute or two)
docker compose up -d
docker compose logs -f node   # watch sync progress; stop with Ctrl+C

# 2. Grab the auth token from inside the container (needed by the RPC)
export CELESTIA_NODE_AUTH_TOKEN=$(docker compose exec node celestia light auth admin --p2p.network {{celestiaNetwork}})

# 3. Submit a blob and retrieve it back in one round-trip
go run ./client
```

Or use the shell script for a CLI-only round-trip:

```bash
bash submit-blob.sh "hello celestia"
```

## Namespace

This starter uses namespace `{{namespaceHex}}`. In production you pick a unique 10-byte namespace per application (the first 19 bytes are reserved/zero, the last 10 are yours).

## Notes

- **Light-node mode** verifies data-availability via DAS (data-availability sampling) — it does NOT download full blocks. Great for clients, wrong for indexers.
- **Namespaced Merkle proofs** are how you prove a blob is in a block without needing the full block. The `blob.Get` RPC returns the proof.
- **Finality**: a blob is "available" once its block has enough signatures. For Mocha testnet this is ~12 seconds.
- **Pay-for-blob**: submitting a blob spends TIA. Fund your light node's address with the faucet before submitting: https://faucet.celestia-mocha.com/
