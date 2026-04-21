# Partner: `sui`

Partner pack for Sui — Move-based L1 with object-centric model, parallel execution, zkLogin. Biases toward Sui Move contracts + the @mysten/sui TypeScript SDK.

**Applies to**: frontend-static, react-vite-ts, nextjs-ts, fullstack-ts, api-service, agent-service-ts, move-contracts

## First moves

- Install SDK: `pnpm add @mysten/sui` (TS client) + `@mysten/wallet-kit` (React wallet connection).
- For Move contracts: `sui move new <name>` then edit sources/. Objects-not-accounts mental model — see https://docs.sui.io/concepts/object-model.
- For zkLogin: `pnpm add @mysten/zklogin`. Users authenticate via OAuth → zkLogin derives a deterministic Sui address from the JWT + a salt. No seed phrase.
- For sponsored txs: your backend signs the gas, user signs the transaction data. Use `TransactionBlock.setGasPayment()` to specify sponsor coins.

## Gotchas

- Sui's object model is not Ethereum's account model. You cannot "just" port an ERC-20 — coins are first-class objects with ownership rules.
- zkLogin salts must be managed server-side (one per user) — expose them client-side and you leak the user's address derivation.
- Move packages are immutable after publish. Plan upgrades via the upgrade-capability pattern (UpgradeCap object) BEFORE shipping v1.
- Testnet + devnet reset periodically — do not rely on on-chain state persistence during development.
