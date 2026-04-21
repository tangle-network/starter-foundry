# Celestia DA Layer — Agent Quick Start

## Architecture

This scaffold runs a Celestia **light node** via docker-compose and provides a Go
client that submits and retrieves blobs over the light node's JSON-RPC interface.

```
docker compose up -d   # start light node (may take a few minutes to sync)
go run ./client        # submit a blob and retrieve it back
```

## Prerequisites

**1. Fund the node wallet.**  
The light node creates a key on first start. Get the address:

```bash
docker compose exec node celestia light keys show my_celes_key --p2p.network mocha-4
```

Fund it from the Mocha faucet: https://faucet.celestia-mocha.com  
Submitting blobs costs TIA gas — the node will error `insufficient funds` without it.

**2. Export the auth token** (every RPC call needs it):

```bash
export CELESTIA_NODE_AUTH_TOKEN=$(docker compose exec node celestia light auth admin --p2p.network mocha-4)
```

The token is per-container-instance. If you recreate the container, re-export.

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Celestia light node on port 26658 |
| `config.toml` | Node config overrides — copy to `data/config.toml` to apply |
| `client/main.go` | Go client: submit blob, retrieve at returned height |
| `submit-blob.sh` | Quick shell round-trip for manual testing |

## RPC Methods

| Method | Signature | Notes |
|--------|-----------|-------|
| `blob.Submit` | `(blobs []Blob, opts GasPrice) → height uint64` | Returns inclusion height |
| `blob.GetAll` | `(height uint64, namespaces []Namespace) → []Blob` | Retrieves all blobs in namespace at height |
| `header.NetworkHead` | `() → ExtendedHeader` | Poll before retrieval to confirm sync |
| `header.GetByHeight` | `(height uint64) → ExtendedHeader` | Confirm a specific height is available |

## Namespace

The default namespace is `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGE=` (base64, 29 bytes,
encoding version byte `0x00` + 18-byte zero prefix + 10-byte ID `[0,0,0,0,0,0,0,c,d,a]`).

To change it, update the `namespace` constant in `client/main.go` and `NAMESPACE` in
`submit-blob.sh`. Rules:
- Must be exactly 29 bytes (1 version + 28 ID)
- Version-0 namespaces: first 18 ID bytes must be `0x00`
- User namespaces must be above `MaxReservedNamespace` — last 10 bytes must be `> [0x00×9, 0xFF]`

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `insufficient funds` | Node wallet has no TIA | Fund from Mocha faucet |
| `401 Unauthorized` | Token missing or stale after container restart | Re-run `celestia light auth admin` |
| `result: null` on GetAll | Target height not yet synced | Call `header.NetworkHead` and wait |
| `connection refused :26658` | Node not ready | Wait for healthcheck (`docker compose ps`) |
| P2P flapping / peer churn | Running on same host as a validator | Move to a separate host or use a distinct data dir |
