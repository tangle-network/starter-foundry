# Domain Pack Run issue-157-fhe-plan

Generated: 2026-06-13T13:17:21.946Z

| Candidate | Status | Domain | Starter | Tracking |
|---|---|---|---|---|
| fhe-contracts-fhenix-foundry | candidate | fhe/contracts | fhenix-foundry | #152 |

## Next Gates

- fhe-contracts-fhenix-foundry: forge build; forge test; node --test --test-concurrency=1 dist-tests/domain-packs.test.js dist-tests/coverage.test.js; pnpm build; pnpm exec tsc -p tsconfig.test.json; pnpm exec tsx scripts/validate-registry.ts
