# Issue 148 Scratchpad — Domain Packs

Updated: 2026-06-14

## Objective

Implement the foundation from https://github.com/tangle-network/starter-foundry/issues/148:
metadata-driven domain packs, generic routing/scoring, proof coverage for FHE and
bridges, and a clear consumer path back into blueprint-agent.

## Current State

- Latest base: `main` at `6484405` (`chore(domain-packs): record post-1912
  scored evidence (#181)`).
- Current active branch: `feat/domain-pack-authenticity-groups`.
- Latest shipped slices:
  - PR #171: generic surface-aware domain-pack routing.
  - PR #173: blueprint-agent roster/exclude/runtime controls are passed through
    domain-pack gates.
  - PR #175: live scored promotion refuses to launch VB when deterministic
    preflight fails.
  - PR #179: domain-pack completion verification reads blueprint-agent verifier
    artifacts instead of trusting only the matrix row.
  - PR #181: recorded post-blueprint-agent #1912 evidence; the `src/**/*`
    lane-local false negative is gone.
- Current active slice:
  - `domainPack.authenticityGroups` adds a reusable evidence contract:
    registries can say "need one SDK/package signal and two contract API
    signals" without hardcoding Fhenix, Zama, LayerZero, or any future provider
    in planner/verifier code.
  - Compose now emits grouped evidence into `AGENTS.md`, `CLAUDE.md`,
    `llms.txt`, `.starter-foundry/compose-report.json`, and
    `.starter-foundry/context-pack.json`.
  - The planner and candidate queue now preserve grouped evidence, so parallel
    workers get the stronger contract in their work units.
- Latest scored evidence:
  - Post-blueprint-agent #1912 live Kimi evidence is recorded under
    `.evolve/domain-pack-runs/issue-157-scored-results/post-1912-kimi-k26-domain-lanes/`.
    It proves Starter Foundry still routes generic FHE/bridge candidates and
    blueprint-agent no longer false-fails lane-local `src/**/*` domain globs.
  - The same run does **not** prove generation lift: scaffold routing was green
    (`4/4`), but completion stayed red (`0/4`). The next useful fix is making
    domain evidence more structured/generative, not tuning one Fhenix leaf.
- Issue tracking:
  - #148 is open and its body still lists some stale lanes.
  - #152, #153, #157, and #158 are closed.
  - #165 is open for scaling the metadata-driven pack factory.
- Merged foundation:
  - `9834df9` / PR #149: metadata-driven domain-pack foundation.
  - `f6feb44` / PR #156: deterministic train/holdout smoke gate.
  - `ed39560` / PR #159: bridge UI layer routing fix.
  - `9174407` / PR #160: domain-pack promotion-loop controller foundation.
  - `a44c1ca` / PR #162: scored promotion gate requires real completion pass
    rate.
  - `018f8fa` / PR #163: generated agent context contracts for composed
    scaffolds.
- Pre-existing unrelated dirty files: `.evolve/buildout-analysis-internal.json`,
  `.evolve/governor.jsonl`, `.evolve/scorecard.json`.
- Issue #148 is open with the full RFC/spec and canonical v3 execution tracker:
  https://github.com/tangle-network/starter-foundry/issues/148#issuecomment-4698561503
- Open child lane: #165 scale metadata-driven pack factory.
  Closed child lanes: #152 FHE runtime compatibility, #153 bridge proof pack
  expansion, #157 scored promotion, #158 parallel candidate promotion loop.
- Historical child lanes: #152 FHE runtime compatibility, #153 bridge proof pack
  expansion, #154 hardcode migration, #157 scored promotion, #158 parallel
  candidate promotion loop.

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
- [x] Add grouped authenticity evidence so domain packs can express alternative
  SDK/package/API proofs without provider-specific planner code.

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
- [x] Active #153 slice: layer-level domain-pack scoring now routes bridge UI
  prompts to a frontend family plus `capability:crypto-bridge-ui`, while explicit
  Foundry/Hardhat runtime prompts keep contract routing compatible.
- [x] Active #158 slice: `scripts/domain-pack-run.ts` now selects/ranks
  candidates, writes isolated work units under `.evolve/domain-pack-runs/`,
  records state, supports filters, active claim locks, status transitions, and
  deterministic smoke execution.
- [x] Active #157 slice: `scripts/domain-pack-smoke.ts` now supports
  `--blueprint-agent scored`, parses blueprint-agent
  `matrix/competition.json`, records train/holdout score distributions and run
  paths, applies min-score and holdout-regression gates, and lets
  `scripts/domain-pack-run.ts --gates scored` advance candidates to
  `scored-passed`.
- [x] Active #157 hardening: scored promotion now distinguishes composite score
  from actual VB completion pass rate. High composite / zero-pass evidence fails
  closed instead of promoting.
- [x] Active #155 slice: composed scaffolds now emit a manifest-derived
  domain-pack contract in `AGENTS.md`, `CLAUDE.md`, `llms.txt`, and
  `.starter-foundry/context-pack.json`. The section is populated from
  selected `domainPack`, `contextHints`, validation commands, and
  authenticity signals.
- [x] Active #152 slice: FHE capabilities are runtime/provider explicit.
  Existing CoFHE sample layers are now scoped to Fhenix Hardhat only; new
  Fhenix Foundry variants target `src/*.sol` and build with `forge build`;
  new Zama fhEVM variants target `contracts/*.sol` and compose with fhEVM
  imports. The generic selector now requires capability-specific evidence
  before attaching a domain-pack layer, and registry validation rejects
  incompatible provider/protocol/runtime/surface combinations.
- [x] Active #152 queue hygiene: domain-pack candidate ordering now preserves
  whole ambiguity groups and explicit registry-entry candidates before
  per-seed shards, so adding many FHE capability variants does not hide
  bridge/FHEVM work from the default top-25 queue.
- [x] Active #157 queue hygiene: explicit provider-scoped candidates now require
  provider/protocol evidence, and single capability candidates require
  capability-intent evidence from manifest keywords/provides/authenticity. This
  prevents Fhenix candidates from absorbing generic BFV/Aztec/Circom leaves and
  keeps the default scored-evidence queue pointed at real train/holdout rows.
- [x] Active #157 handoff hardening: `domain-pack-smoke` now records
  `starterCli` preflight evidence and auto-builds the repo-local default
  `dist/cli.js` before routing/compose/VB handoff when it is missing or stale.
  Explicit CLI paths remain strict contracts and are not silently repaired.
- [x] Active #157 queue evidence refresh: `.evolve/domain-pack-candidates.json`
  regenerated from current planner output. Fhenix Foundry is now
  `fhenix-fhe` only (`6` train / `2` holdout), while LayerZero OFT remains a
  bridge contracts candidate (`6` train / `3` holdout).
- [x] PR #176 CI convergence: the router matrix eval accuracy/recall gates
  passed on GitHub, but a shared-runner p95 sample (`8.15ms`) tripped the prior
  hard `5ms` latency cap. CI now keeps accuracy/recall as hard gates, warns
  above the `5ms` advisory latency budget, and fails only on catastrophic
  deterministic-path p95 over `25ms`.
- [x] Post-#1908 scored evidence: live Kimi (`kimi-code/kimi-k2.6`) with
  DeepSeek reviewer/semantic paths ran FHE and LayerZero candidates through one
  train leaf and one holdout leaf each. Dry-runs passed. Scored promotion
  failed closed: FHE train score `0.918`, FHE holdout score `0.200`, bridge
  train/holdout score `0.909`/`0.909`; scaffold pass rate `4/4`, completion
  pass rate `0/4`.
- [x] Active #148 grouped-evidence slice: `domainPack.authenticityGroups` is
  typed, schema-validated, semantically checked, emitted into agent/context
  outputs, and preserved in `.evolve/domain-pack-candidates.json`. Seeded first
  for Fhenix CoFHE, Zama fhEVM, and LayerZero OFT as proof entries, not as
  hardcoded planner branches.

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
- [x] `pnpm exec tsc --noEmit --pretty false`
- [x] `pnpm exec tsc -p tsconfig.test.json --pretty false`
- [x] `pnpm exec tsx scripts/validate-registry.ts`
- [x] `pnpm exec tsx --test tests/domain-packs.test.ts tests/domain-pack-smoke.test.ts tests/coverage.test.ts` -> 459/459 passing.
- [x] `node --test --test-concurrency=1 dist-tests/domain-pack-smoke.test.js dist-tests/plan-domain-pack-work.test.js dist-tests/domain-packs.test.js dist-tests/domain-pack-hardcode-guard.test.js dist-tests/coverage.test.js dist-tests/prompt-planner.test.js` -> 494/494 passing.
- [x] Changed-file Prettier check for the active #153 files.
- [x] `git diff --check`
- [x] `pnpm exec tsx --test tests/domain-pack-run.test.ts` -> 4/4 passing.
- [x] `pnpm exec tsx --test tests/domain-pack-smoke.test.ts` -> 4/4 passing.
- [x] `pnpm exec tsx --test tests/domain-pack-smoke.test.ts tests/domain-pack-run.test.ts` -> 8/8 passing.
- [x] `pnpm exec tsc -p tsconfig.test.json --pretty false`
- [x] `pnpm exec tsc --noEmit --pretty false`
- [x] `pnpm exec tsx scripts/domain-pack-run.ts --limit 4 --write-plan --no-claim --run-id issue-158-proof --json` selected 4 candidates across bridge contracts, bridge UI, FHE capabilities, and FHE contracts.
- [x] `pnpm exec tsx --test tests/domain-pack-agent-context.test.ts` -> 4/4
  passing, covering FHE, LayerZero bridge contracts, bridge UI, and
  machine-readable `context` output.
- [x] `node --test --test-concurrency=1 dist-tests/domain-pack-agent-context.test.js dist-tests/domain-pack-smoke.test.js dist-tests/domain-pack-run.test.js` -> 13/13 passing.
- [x] `pnpm build`
- [x] `pnpm exec tsx scripts/validate-registry.ts`
- [x] `pnpm exec tsc --noEmit --pretty false`
- [x] `pnpm exec tsc -p tsconfig.test.json --pretty false`
- [x] `pnpm exec tsx scripts/validate-registry.ts`
- [x] `node --test --test-concurrency=1 dist-tests/fhe-runtime-capabilities.test.js` -> 6/6 passing.
- [x] `node --test --test-concurrency=1 dist-tests/select.test.js dist-tests/prompt-planner.test.js dist-tests/coverage.test.js` -> 518/518 passing.
- [x] `node --test --test-concurrency=1 dist-tests/domain-packs.test.js dist-tests/domain-pack-agent-context.test.js dist-tests/domain-pack-hardcode-guard.test.js dist-tests/domain-pack-smoke.test.js dist-tests/domain-pack-run.test.js dist-tests/plan-domain-pack-work.test.js` -> 24/24 passing.
- [x] `pnpm test` -> 1140 passed, 1 skipped, 1 todo, 0 failed.
- [x] `pnpm lint --quiet`
- [x] `git diff --check`
- [x] `pnpm exec tsx --test tests/plan-domain-pack-work.test.ts` -> 2/2
  passing after the #157 candidate-intent fix.
- [x] `pnpm exec tsc --noEmit --pretty false`
- [x] `pnpm exec tsc -p tsconfig.test.json --pretty false`
- [x] `pnpm exec tsx scripts/validate-registry.ts`
- [x] `pnpm build`
- [x] `node --test --test-concurrency=1 dist-tests/plan-domain-pack-work.test.js`
  -> 2/2 passing.
- [x] `pnpm lint --quiet`
- [x] `pnpm exec tsx --test tests/domain-pack-smoke.test.ts` -> 8/8 passing
  with CLI preflight report coverage and explicit missing CLI fail-closed
  coverage.
- [x] `pnpm exec tsx scripts/plan-domain-pack-work.ts --write --json --top 25`
  regenerated `.evolve/domain-pack-candidates.json`; current corpus:
  `319` scenarios, `7` domain groups, `25` candidates.
- [x] `pnpm exec tsx scripts/domain-pack-smoke.ts --candidate
  fhe-contracts-fhenix-foundry --output
  .evolve/domain-pack-smoke/issue-148-cli-readiness-fhe.json --write --json
  --train 1 --holdout 1 --blueprint-agent dry-run --blueprint-roster smoke`
  -> passed; samples `fhenix-blind-poker-showdown` and
  `fhenix-confidential-lending-vault`; compose `2/2`; authenticity hits `444`;
  validation `2/2`; blueprint dry-run `2/2`.
- [x] `pnpm exec tsx scripts/domain-pack-smoke.ts --candidate
  bridge-contracts-capability-evm-layerzero-oft --output
  .evolve/domain-pack-smoke/issue-148-cli-readiness-bridge.json --write
  --json --train 1 --holdout 1 --blueprint-agent dry-run --blueprint-roster
  smoke` -> passed; samples `ethena-cross-chain-usde` and
  `lz-oft-balance-tracker`; compose `2/2`; authenticity hits `328`;
  validation `2/2`; blueprint dry-run `2/2`.
- [x] `pnpm exec tsx --test tests/plan-domain-pack-work.test.ts` -> 2/2
  passing, including persisted queue freshness guard.
- [x] `pnpm exec tsx --test tests/domain-pack-smoke.test.ts
  tests/domain-pack-run.test.ts` -> 12/12 passing.
- [x] `pnpm exec tsc --noEmit --pretty false`
- [x] `pnpm exec tsc -p tsconfig.test.json --pretty false`
- [x] `pnpm exec tsx scripts/validate-registry.ts` -> passed; existing tier1
  keyword overlap warnings only.
- [x] `pnpm build`
- [x] `git diff --check`
- [x] `pnpm lint --quiet`
- [x] `pnpm test` -> 1154 passed, 1 skipped, 1 todo, 0 failed.
- [x] `pnpm exec tsx scripts/meta-harness-eval.ts --out
  .evolve/meta-harness/runs/pr176-local-ci-baseline.jsonl --label
  pr176-local-ci-baseline` -> passRate `0.99449`, ideasai recall `0.86917`,
  held-out recall `1`, p95 `0.95ms`.
- [x] Local replay of the updated CI threshold script -> passed.

Current `.evolve/domain-pack-candidates.json` evidence:

- `scenariosScanned`: 319
- `domainGroupsScanned`: 7
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
- `bridge-ui-capability-crypto-bridge-ui.json`: passed after the #153 routing
  fix; 2 train + 2 holdout leaves; compose 4/4; authenticity hits 8; routing
  now selects `react-vite-ts` plus `framework:react-vite-ts` and
  `capability:crypto-bridge-ui`; blueprint-agent dry-runs 4/4.

Current `.evolve/domain-pack-runs/` evidence:

- `issue-158-proof/run.json`: planned 4 independent work units from 25 current
  candidates.
- Selected: `bridge-contracts`, `bridge-ui`, `fhe-capabilities`,
  `fhe-contracts`.
- Backlog distribution: 17 bridge candidates, 8 FHE candidates; 17 contracts
  surface, 8 UI surface; ambiguity groups `bridge-contracts` 9, `bridge-ui` 8,
  `fhe-capabilities` 4, `fhe-contracts` 4.
- Work units include candidate id, domain metadata, source leaves, registry
  files, files to modify, gates, expected starter family/layers, and GitHub
  tracking issue.

Current scored-gate evidence:

- Fixture-backed scored parsing and thresholds pass locally for
  `domain-pack-smoke`.
- Fixture-backed invalid threshold input fails closed to the default
  `--min-score 0.5` gate instead of weakening promotion.
- Fixture-backed controller integration passes locally for
  `domain-pack-run --gates scored`, including state transition to
  `scored-passed`.
- Local FHE scored replay exists at
  `.evolve/domain-pack-runs/issue-157-scored-results/fhe-scored.json`.
  The hardened gate fails it closed: train score `0.7407`, holdout score
  `0.8857`, but both train and holdout have `completionPassRate: 0`.
  Routing and compose passed, so the remaining gap is downstream task
  completion, not starter selection.
- Real blueprint-agent scored promotion artifacts for at least one FHE candidate
  and one bridge candidate are still required before #157 can close.
- Post-#157 queue hygiene sample: default top-25 now contains
  `bridge-contracts-capability-evm-layerzero-oft` at rank 6 with LayerZero/OFT
  train leaves and holdouts, and `fhe-contracts-fhenix-foundry` at rank 8 with
  only Fhenix leaves. The Fhenix Foundry train split is
  `fhenix-blind-poker-showdown`, `fhenix-confidential-dex`,
  `fhenix-encrypted-erc20-token`, `fhenix-private-dao-vote`,
  `fhenix-sealed-bid-auction`, `fhenix-sealed-payroll-stream`; holdout is
  `fhenix-confidential-lending-vault`,
  `fhenix-private-prediction-market`.

Known repo-wide gate note: `pnpm format:check` currently stops because the
repository has unrelated pre-existing Prettier drift across 117 files outside
this PR. Changed files in this branch were Prettier-written and pass
`git diff --check`.

Current scaffold-evidence reintegration slice:

- Finding: #157 scored artifacts proved routing/compose, but did not always
  prove that the selected domain pack reached the downstream VB scaffold
  artifact. This was material for bridge: the saved scored train artifact showed
  `react-vite-ts+evm-infra-ts+forge-contracts` and no
  `capability:evm-layerzero-oft` domain guidance, so a score could not be
  interpreted as a LayerZero/OFT scaffold result.
- Starter Foundry local change: scored promotion now records scaffold evidence
  per leaf, aggregates `scaffoldPassCount`/`scaffoldFailCount`, and fails closed
  when the observed VB `scaffold-compose.json` lacks the candidate's expected
  family/layers/capabilities.
- Blueprint Agent local change: `composeScaffoldInWorkdir` now preserves
  `.starter-foundry/compose-report.json` `domainPackGuidance`, and
  `sandbox-driver` persists it into run-artifact `scaffold-compose.json` with
  `projects`.
- Replay evidence with the stricter gate:
  - FHE `fhe-contracts-fhenix-foundry`: scaffold evidence passes 1/1 train and
    1/1 holdout; scores `0.919` train and `0.921` holdout still fail because
    completion pass rate is `0/1` on both splits.
  - Bridge `bridge-contracts-capability-evm-layerzero-oft`: train score
    `0.727` still fails completion, and now correctly fails scaffold evidence
    because `capability:evm-layerzero-oft` was absent from the saved VB artifact;
    holdout remains unparseable.
- Verification:
  - `blueprint-agent`: `pnpm exec tsx --test scripts/experiments/lib/__tests__/scaffold-compose.test.ts`
    -> 18/18 passing, including 315 vertical compose smoke.
  - `blueprint-agent`: `git diff --check` -> pass.
  - `blueprint-agent`: `pnpm exec tsc -p scripts/experiments/tsconfig.check.json --pretty false`
    remains blocked by pre-existing missing
    `agent-dev-container/products/sandbox/sdk/dist/index.js` imports.
  - `starter-foundry`: `pnpm exec tsc --noEmit --pretty false` -> pass.
  - `starter-foundry`: `pnpm exec tsc -p tsconfig.test.json --pretty false` -> pass.
  - `starter-foundry`: `pnpm exec tsx --test tests/domain-pack-smoke.test.ts`
    -> 7/7 passing.
  - `starter-foundry`: `pnpm exec tsx --test tests/domain-pack-smoke.test.ts tests/domain-pack-run.test.ts`
    -> 11/11 passing after aligning the scored controller fixture with the new
    scaffold-evidence artifact contract.
  - `starter-foundry`: `pnpm exec prettier --check scripts/domain-pack-smoke.ts tests/domain-pack-smoke.test.ts`
    -> pass.

Current surface-generalization slice:

- Planner change: `scripts/plan-domain-pack-work.ts` now filters candidate
  evidence by generic surface compatibility (`contracts`, `ui`, `api`,
  `indexer`, `worker`, `research`) before a leaf can support a domain-pack row.
  This is metadata/signal based, not a Fhenix or LayerZero exception.
- Prompt planner change: generic UI surface signals now include `viewer`,
  `wizard`, `panel`, `explorer`, and `form`, so protocol deployment products can
  route as workspaces while still attaching contract domain packs to the EVM
  subproject.
- Regenerated queue evidence:
  - `fhe-contracts-fhenix-foundry`: `fhenix-fhe` only, `6` train leaves and
    `2` holdout leaves.
  - `bridge-contracts-capability-evm-layerzero-oft`: `layerzero-omnichain`
    only, `3` train leaves and `1` holdout leaf; it no longer absorbs
    `ethena-cross-chain-usde` or `lz-oft-bridge-ui`.
- Live pi/deepseek telemetry evidence:
  - FHE train checkpoint: `toolCallsByName` recorded `Read:20`, `Bash:59`,
    `Write:7`, `Edit:6`; this confirms pi tool activity is visible to
    downstream scoring.
  - LayerZero pure-contract train checkpoint: scaffold artifact recorded
    `forge-contracts`, `framework:forge-foundation`, and
    `capability:evm-layerzero-oft`; `toolCallsByName` recorded `Bash:29`,
    `Read:8`, `Write:27`, `web_search:4`, `Edit:1`.
  - LayerZero workspace holdout reached a real `web + api + evm` scaffold and
    wrote `853` stream/event lines before the wrapper was interrupted; no final
    `bridge-scored.json` was produced, so this is partial evidence only.
- Reintegration gap: blueprint-agent's scored scaffold artifact still flattens
  workspace mode to top-level `web/api/evm` layers and drops the EVM subproject's
  domain-pack guidance. Starter-foundry `planPrompt` and direct
  `compose-prompt` route the same prompt correctly, so the next integration fix
  belongs in the blueprint-agent artifact extraction path.

Post-#1910 scored contract-handoff evidence:

- Blueprint Agent #1910 is merged and active in the scored worktree. It surfaces
  Starter Foundry's generic scaffold completion contract to the worker after
  scaffold upload and before coding starts.
- Run id:
  `.evolve/domain-pack-runs/issue-157-scored-results/post-1910-kimi-k26-contract/`.
  Coder was `kimi-code/kimi-k2.6` via cli-bridge; reviewer/semantic models were
  `deepseek/deepseek-chat`; roster was `kimi-only`; `kc-kfc` was excluded.
- Starter Foundry found and fixed a scored-parser bug during this run: BA writes
  the true completion decision into
  `matrix/artifacts/*/verification-shot-*.json`, but
  `competition.ranked[0].passRate` can remain `0`. The scorer now reads the
  `completion-verifier` layer for the winning profile and falls back to ranked
  pass rate only when verifier artifacts are absent.
- Result vs post-#1908 baseline:
  - Scaffold evidence stayed green: `4/4` before, `4/4` after.
  - Completion improved: `0/4` before, `1/4` after.
  - FHE now has one real completion pass: train
    `fhenix-blind-poker-showdown` passed completion `4/4`; holdout
    `fhenix-confidential-lending-vault` failed `3/5`, missing borrower sealed
    read and outcome decrypt oracle.
  - Bridge still has `0/2` completion passes. Train
    `lz-oft-adapter-deploy` hit `4/8`; holdout `lz-oft-launch-platform` hit
    `4/12`.
- Current read: Starter Foundry routing/scaffold handoff is no longer the
  bottleneck. The bridge holdout transcript shows Kimi built real
  `contracts/evm`, `apps/api`, and `apps/web` pieces, but BA's verifier reports
  primary workdir as `apps/web` and fails to see LayerZero package/contract
  patterns that live outside that app. The next likely fix is Blueprint Agent
  verifier workspace scope for multi-project outputs, plus clearer leaf-specific
  missing-requirement feedback to the worker.

Post-#1912 grouped-evidence slice:

- Blueprint Agent #1912 fixed the workspace/lane domain-glob verifier bug. The
  recorded post-#1912 evidence shows `0` lane-local `src/**/*` false negatives
  across `3` verification artifacts, but no generation promotion: completion
  stayed `0/4`.
- Starter Foundry now has a generic grouped evidence contract:
  `domainPack.authenticityGroups`.
  - FHE examples: `cofhe-sdk`, `cofhe-contract-apis`,
    `fhevm-contract-apis`.
  - Bridge example: `layerzero-sdk`, `oft-contract`,
    `bridge-deploy-config`.
- The generated queue was refreshed with grouped evidence:
  `.evolve/domain-pack-candidates.json` has `25` candidates from `319`
  blueprint-agent scenario seeds. `fhe-contracts-fhenix-foundry` and
  `bridge-contracts-capability-evm-layerzero-oft` both carry grouped
  authenticity evidence in their work units.
- Verification for this slice:
  - `pnpm validate:registry` -> passed (`169` families; only pre-existing
    keyword-overlap warnings).
  - `pnpm exec tsc --noEmit --pretty false` -> passed.
  - `pnpm build && pnpm exec tsc -p tsconfig.test.json --pretty false` ->
    passed.
  - `node --test --test-concurrency=1 dist-tests/domain-pack-agent-context.test.js dist-tests/domain-packs.test.js dist-tests/plan-domain-pack-work.test.js`
    -> `18/18` passing.
  - `node --test --test-concurrency=1 dist-tests/domain-pack-run.test.js dist-tests/domain-pack-smoke.test.js`
    -> `13/13` passing.
  - `pnpm lint --quiet` -> passed.
  - Changed-file Prettier check -> passed.
  - `git diff --check` -> passed.
  - `pnpm test` -> `1156` passed, `0` failed, `1` skipped, `1` todo.

## Open Follow-up Candidates

- Use #165 to promote generated `.evolve/domain-pack-candidates.json` rows into
  parallel metadata/scaffold-pack implementation issues/PRs.
- Make Blueprint Agent consume `authenticityGroups` directly in verifier
  feedback instead of relying on flat provider strings.
- Run the next powered FHE/bridge scored promotion only after the grouped
  evidence is available in the scaffold handoff and verifier feedback.
