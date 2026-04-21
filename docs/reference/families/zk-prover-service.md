# Family: `zk-prover-service`

Minimal ZK prover service starter with live status endpoint.

**Taxonomy**: language=javascript · runtime=node · surface=zk-service

**Tags**: zk, proofs, service

## Slots

- `database` — options: database:sqlite, database:postgres, database:mongodb, database:convex (default: `database:sqlite`)
- `sdk` — options: sdk:none, sdk:coinbase-cdp, sdk:solana-web3, sdk:evm-wallet (default: `sdk:none`)
- `auth` — options: auth:none, auth:better-auth, auth:clerk, auth:supabase-auth (default: `auth:none`)
- `payments` — options: payments:none, payments:stripe, payments:coinbase-commerce (default: `payments:none`)
- `queue` — options: queue:none, queue:bullmq, queue:trigger-dev (default: `queue:none`)

## Routing keywords

- **tier1**: risc zero, sp1, circom
- **tier2**: snarkjs, fhenix, zk prover, verifiable ml, private voting, dark pool, mixer
