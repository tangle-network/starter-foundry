# Partner: `tempo`

Partner pack for Tempo — Paradigm's payments-optimized L1 with sub-second settlement, high throughput, EVM-compatible. Biases toward payments rails, stablecoin-denominated dApps, x402 agent-to-agent flows.

**Applies to**: frontend-static, react-vite-ts, nextjs-ts, fullstack-ts, api-service, evm-infra-ts, agent-service-ts, x402-service, forge-contracts, hardhat-contracts, tangle-blueprint

## First moves

- Use standard EVM tooling: `pnpm add viem wagmi`. Tempo is EVM-compatible — no Tempo-specific SDK needed.
- Point RPC at Tempo: set `VITE_RPC_URL` / equivalent to the mainnet RPC from tempo-config.json. Explorer link is there too.
- USDC is the primary settlement asset. Contract address + decimals live in tempo-config.json; import them instead of hardcoding.
- For x402 integration: x402 headers work unchanged over Tempo. Use capability:tangle-x402 or x402-service family for the scaffolding.
- For MPP agent payments: capability:tangle-mpp pairs with this partner — delegation + budget caps signed on Tempo.

## Gotchas

- Tempo is new (2025) — block explorers + indexers may lag mainnet state by seconds during volume spikes.
- USDC-native means users need USDC on Tempo (not just ETH). Design your UX around a one-time bridge/onramp step.
- Gas is paid in native token (check tempo-config.json). Keep a small native balance for every address that will transact.
- Check chainId on every write-path — sending a signed tx meant for Tempo to Base (EVM-compatible = same format) is a common user error.
