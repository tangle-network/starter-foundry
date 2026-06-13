# Domain Pack Run issue-157-bridge-plan

Generated: 2026-06-13T13:17:21.974Z

| Candidate | Status | Domain | Starter | Tracking |
|---|---|---|---|---|
| bridge-contracts-capability-evm-layerzero-oft | candidate | bridge/contracts | forge-contracts | #153 |

## Next Gates

- bridge-contracts-capability-evm-layerzero-oft: forge build; forge test; node --test --test-concurrency=1 dist-tests/domain-packs.test.js dist-tests/coverage.test.js; pnpm build; pnpm exec tsc -p tsconfig.test.json; pnpm exec tsx scripts/validate-registry.ts
