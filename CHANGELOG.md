# CHANGELOG

## v0.7.2 (2026-04-25, @ 1f504fc)

**Generated range:** `v0.7.0..HEAD`

### New capabilities
- `capability:agent-eval` — Ships a reproducible agent-eval harness into the scaffold: starter scenarios, a deterministic + optional LLM-judge runner that talks to the 

### Commits (33)
- feat(gen10): agentic-dispatch closed loop — judge fleet + dispatch + auto-loop wiring (#70) (1f504fc)
- feat(consume-vb-feedback): augment any vibecoder — first scaffold-side attribution loop (#69) (c8322b6)
- chore: bump to 0.7.1 — agent-eval 0.7.2 consumption + Gen 8-9 arc (#68) (6c58533)
- refactor: consume agent-eval 0.7.2 primitives (−342 net lines) (#67) (910d4a2)
- feat(auto-loop): headless governor — one decision per invocation, cron-friendly (#66) (19ee723)
- chore(cleanup): finish the cut PR #64 missed — progress.md 990→48 + muffled-gate §Measurement (#65) (dce2ce9)
- fix(measurement): proposal_promotion_rate 0.034 → 0.75 (metric was lying, not proposer) (#59) (58fd377)
- feat(compose): AGENTS.md lists pre-installed packages — kills redundant-install waste (#60) (184ec05)
- chore(cleanup): real consolidation — -1883 net lines, no new prose (#64) (2baa193)
- chore(housekeeping): consolidate .evolve/ — patterns + progress + restored reflections (#63) (34fbb6a)
- feat(proposer): agentic dispatch via TCloud.agent() — self-verifies vs promoter gates (#62) (7e11b6b)
- fix(cost-tracker): wire CostTracker.record + fix .summary() method name — cost-summary.json populates (#61) (27c1f77)
- fix(invariant): auto-derive agent-eval importer scan — closes Gen-9-style miss mechanically (#58) (2785761)
- feat(gen9): promoter dogfood gates — declared-dep-used, scaffold-runs, eval-scores (#57) (79fbd36)
- fix(forge-lint): drop info-severity + ignore test/script — closes dex-swap lint cluster (+6.6pp) (#56) (87b8f52)
- feat(capability:agent-eval): reproducible eval harness any agentic scaffold layers in (#55) (2b92bdd)
- feat(gen9): structural muffled-gate audit — 7 live → 0, invariant prevents re-intro (#54) (2e5551a)
- docs: add CLAUDE.md — unconditional rule against Co-Authored-By trailers in commits/PRs (3193f8b)
- chore(evolve): round-0 result — Gen 8 compile-gate validated end-to-end after Gen 8b fix (5d204d3)
- test(gen8b): behavioral guard — real spawn confirms HarnessConfig.cwd is honored (00a2a19)
- fix(gen8b): promoter cwd silently dropped — strict gate ran in wrong dir (#53) (8419c8a)
- feat(gen8): compile-gate — strict tsc + judge short-circuit close the Goodhart loop (#52) (4c9ed30)
- chore(converge): mark CONVERGED — main fully green on 567a01e (7ac92e9)
- fix(registry): React 18 idiom + .tsx extensions on 3 Gen 6 families (#51) (2de2f66)
- chore: bump to 0.7.0 — Gen 5-7 closed-loop generation + agent-eval ^0.7.0 + scaffold-gap measurement honesty (c6effeb)
- fix(measurement): scaffold_gap_installs 56→9 — capability deps + signal extension (#50) (4c3607a)
- fix(tests): force internal.json mtime ahead of source in counterfactual fallback test (3985c6f)
- chore(deps): pin @tangle-network/agent-eval ^0.7.0 (off link:) (#49) (ab8405e)
- fix(ci): switch @tangle-network/agent-eval to npm ^0.7.0, remove sibling-clone workaround (04c29fe)
- fix(ci): seed .evolve/traces/buildouts.jsonl from tests/fixtures/ when mined data absent (99d67d0)
- chore: remove SPEC-design-personalization-v2.md — shipped + superseded (5ed2f58)
- fix(ci): setup agent-eval sibling before install so @tangle-network/agent-eval resolves (706eb14)
- chore(cleanup): remove 5 already-promoted proposal drafts from .evolve/ (3aa711c)

### Registry state at HEAD
- families: 100
- capabilities: 110
- partners: 19

### Consumer action items
- Ensure your bench container has the toolchains any new families require (e.g. `bun`, `deno`, `wasm-pack`, `vllm`).
- Re-emit your buildout traces via `emitBuildoutEvent` — new family IDs will be classified by the detector.
