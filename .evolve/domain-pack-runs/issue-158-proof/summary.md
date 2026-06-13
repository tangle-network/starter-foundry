# Domain Pack Run issue-158-proof

Generated: 2026-06-13T12:40:43.623Z

| Candidate | Status | Domain | Starter | Tracking |
|---|---|---|---|---|
| bridge-contracts | candidate | bridge/contracts | forge-contracts | #153 |
| bridge-ui | candidate | bridge/ui | react-vite-ts | #153 |
| fhe-capabilities | candidate | fhe/contracts | fhenix-contracts | #152 |
| fhe-contracts | candidate | fhe/contracts | fhenix-foundry | #152 |

## Next Gates

- bridge-contracts: forge build; forge test; node --test --test-concurrency=1 dist-tests/domain-packs.test.js dist-tests/coverage.test.js; pnpm build; pnpm exec tsc -p tsconfig.test.json; pnpm exec tsx scripts/validate-registry.ts
- bridge-ui: node --test --test-concurrency=1 dist-tests/domain-packs.test.js dist-tests/coverage.test.js; pnpm build; pnpm exec tsc -p tsconfig.test.json; pnpm exec tsx scripts/validate-registry.ts
- fhe-capabilities: node --test --test-concurrency=1 dist-tests/domain-packs.test.js dist-tests/coverage.test.js; pnpm build; pnpm exec tsc -p tsconfig.test.json; pnpm exec tsx scripts/validate-registry.ts
- fhe-contracts: forge build; forge test; node --test --test-concurrency=1 dist-tests/domain-packs.test.js dist-tests/coverage.test.js; npx hardhat compile; npx hardhat test; pnpm build; pnpm exec tsc -p tsconfig.test.json; pnpm exec tsx scripts/validate-registry.ts
