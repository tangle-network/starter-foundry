# Issue 148 Scratchpad — Domain Packs

Updated: 2026-06-13

## Objective

Implement the foundation from https://github.com/tangle-network/starter-foundry/issues/148:
metadata-driven domain packs, generic routing/scoring, proof coverage for FHE and
bridges, and a clear consumer path back into blueprint-agent.

## Current State

- Branch: `chore/sandbox-sdk-rename`.
- Prior local commits on branch:
  - `1cda7b3 feat(registry): fhenix-foundry family — Foundry + vendored-CoFHE FHE contract scaffold`
  - `f2f51d7 feat(planner): route Solidity/V4-hook prompts to the evm lane`
- Pre-existing unrelated dirty files: `.evolve/buildout-analysis-internal.json`,
  `.evolve/governor.jsonl`, `.evolve/scorecard.json`.
- Issue #148 is open with a full RFC/spec and execution tracker:
  https://github.com/tangle-network/starter-foundry/issues/148

## Requirements

- [x] Add typed/schema-validated `domainPack` metadata to family/layer manifests.
- [x] Add a generic domain-pack selector/index driven by manifest metadata.
- [x] Use metadata to disambiguate FHE families without hardcoded Fhenix logic in
  generic planner code.
- [x] Add guardrail tests so future provider-specific routing does not creep into
  core planner files unnoticed.
- [x] Add FHE proof metadata and tests for Fhenix Foundry, Fhenix Hardhat, and
  Zama fhEVM.
- [x] Add bridge proof metadata and routing tests across distinct surfaces.
- [x] Add a candidate queue/scratch interface for parallel domain-pack work.
- [x] Expand the candidate queue from broad proof rows to current-corpus
  parallel rows (`25` emitted from `319` parsed blueprint-agent seeds).
- [x] Verify blueprint-agent can consume the routed packs through the sibling
  starter-foundry CLI path.

## Decisions

- `domainPack` lives on manifests; provider/protocol names are allowed in registry
  data and tests, not as bespoke generic planner branches.
- First implementation should augment the current keyword scorer rather than
  replace it. This keeps existing routing stable while creating the new path.
- Ambiguous prompts should expose ambiguity/fail-closed behavior in tests instead
  of silently falling through to generic frontend/fullstack scaffolds.

## Progress

- [x] Schema/types
- [x] Registry validation
- [x] Domain-pack scorer
- [x] FHE metadata
- [x] Bridge metadata
- [x] Candidate queue script
- [x] Tests
- [x] Blueprint-agent reintegration check
- [x] GitHub issue update
- [x] Candidate queue scale-out for #150: parser now handles multiple seed
  objects per file, requires leaf-level evidence, and emits group, entry, and
  seed-shard rows without provider-specific branches.
- [x] Domain-pack smoke gate foundation for #151: `scripts/domain-pack-smoke.ts`
  samples train/holdout leaves, composes the intended starter, checks routing
  prompts, counts authenticity signals, runs declared validation commands when
  toolchains are present, records blueprint-agent dry-run probes, and writes
  `.evolve/domain-pack-smoke/*.json`.

## Verification

- [x] `pnpm exec tsc --noEmit`
- [x] `pnpm exec tsx scripts/validate-registry.ts`
- [x] `pnpm build`
- [x] `pnpm exec tsc -p tsconfig.test.json`
- [x] `node --test --test-concurrency=1 dist-tests/keywords.test.js dist-tests/domain-packs.test.js dist-tests/domain-pack-hardcode-guard.test.js dist-tests/plan-domain-pack-work.test.js dist-tests/select.test.js dist-tests/prompt-planner.test.js dist-tests/coverage.test.js`
- [x] `pnpm test`
- [x] `STARTER_FOUNDRY_CLI=/home/drew/code/starter-foundry/dist/cli.js pnpm tsx --test scripts/experiments/lib/__tests__/scaffold-compose.test.ts`
- [x] Changed-file Prettier check
- [x] `pnpm lint --quiet`
- [x] `pnpm exec tsx --test tests/plan-domain-pack-work.test.ts` -> 2/2
  passing, including current blueprint-agent corpus count `>= 10`.
- [x] `pnpm exec tsx --test tests/domain-pack-smoke.test.ts` -> 1/1 passing.

Current `.evolve/domain-pack-candidates.json` evidence:

- `scenariosScanned`: 319
- `domainGroupsScanned`: 4
- `candidates`: 25
- Includes FHE rows for `fhenix-foundry`, `fhenix-contracts`,
  `fhevm-contracts`, FHE capability rows, LayerZero OFT bridge contracts, bridge
  UI, and per-seed bridge shards.

Current `.evolve/domain-pack-smoke/` evidence:

- `fhe-contracts-fhenix-foundry.json`: passed; 2 train + 2 holdout leaves;
  compose 4/4; authenticity hits 680; `forge build` + `forge test` passed;
  blueprint-agent dry-runs 4/4.
- `bridge-contracts-capability-evm-layerzero-oft.json`: passed; 2 train + 2
  holdout leaves; compose 4/4; authenticity hits 256; `forge build` +
  `forge test` passed; blueprint-agent dry-runs 4/4.
- `bridge-ui-capability-crypto-bridge-ui.json`: failed as intended by the new
  gate; compose/authenticity/blueprint dry-runs pass, but the routing prompt
  currently selects `forge-contracts` instead of `react-vite-ts`. This is
  concrete follow-up evidence for #153.

Known repo-wide gate note: `pnpm verify` currently stops at `format:check`
because the repository has unrelated pre-existing Prettier drift across many
files. Changed files in this branch pass targeted Prettier.

## Open Follow-up Candidates

- Promote generated `.evolve/domain-pack-candidates.json` rows into parallel
  implementation issues/PRs after this foundation lands.
- Extend the #151 smoke gate from blueprint-agent dry-run probes to full scored
  agent runs where credentials/time budget are available.
