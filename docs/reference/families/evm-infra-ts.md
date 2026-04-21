# Family: `evm-infra-ts`

Minimal EVM infrastructure service for RPC monitoring, viem scripts, and chain-aware APIs.

**Taxonomy**: language=javascript · runtime=node · surface=evm-infra

**Tags**: evm, typescript, infra, api

## Slots

- `database` — options: database:sqlite, database:postgres, database:mongodb, database:convex (default: `database:sqlite`)
- `sdk` — options: sdk:none, sdk:coinbase-cdp, sdk:solana-web3, sdk:evm-wallet (default: `sdk:none`)
- `auth` — options: auth:none, auth:better-auth, auth:clerk, auth:supabase-auth (default: `auth:none`)
- `payments` — options: payments:none, payments:stripe, payments:coinbase-commerce (default: `payments:none`)
- `queue` — options: queue:none, queue:bullmq, queue:trigger-dev (default: `queue:none`)

## Routing keywords

- **tier2**: viem, ethers, rpc, block monitor, gas price, transaction count, multicall, wallet balance, okb, oklink, okx, x layer, xlayer, /stats
- **archetypes**: gas tracker, gas estimator
