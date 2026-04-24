# Handoff — Post-Crash, Gen 7 Shipped, Gen 8 Ready to Dispatch

**Date:** 2026-04-23 17:33 (local)
**Branch:** `feat/emit-cache-warm-list` at `756bc87` — pushed to remote
**Status:** Safe to resume on a fresh machine or remote runner.

## What happened (2-sentence version)

Full Gen 6 + Gen 7 arc shipped in one day — 10 commits, aggregate 0.407 → 0.603 (+19.6pp), 5 auto-shipped families + 2 capabilities, coverage_lift architectural ceiling broken via multi-pursue R4 partner-first routing. Machine crashed mid-R5 dispatch; both R5 proposers were killed before producing variants, but everything committed before the crash is safe and now on remote.

## Remote state (verified)

```
origin/feat/emit-cache-warm-list = 756bc87
local HEAD                       = 756bc87
working tree                     = clean
stale worktrees                  = removed
```

## The 10 commits (all pushed)

| SHA | Summary |
|-----|---------|
| 756bc87 | R5 bootstrap — two-orthogonal-file proposer config |
| b622d1e | Full arc reflection + 5 durable memory entries |
| 3c5ef7b | R4 multi-pursue bookkeeping |
| 518bf50 | **partner-first routing — coverage_lift 0 → 0.308 (R4 winner)** |
| fe9cefd | R6 evolve — capability gap-detector + nightly autonomy |
| 78110b2 | R5 evolve — capability proposer (capability_promotion_rate null → 0.67) |
| 3c265e9 | R4 evolve — judge rubric calibration (3/3 borderline → pass) |
| dcf9bfc | R3 evolve — fidelity feedback loop + prescriptive slots |
| e2a1908 | R2 evolve — fidelity gate + 5 plumbing fixes + first shippable |
| ceee7ee | R1 evolve — Gen 6 pipeline end-to-end |

## Scorecard flow state (as of 756bc87)

| Flow | Value | Target | Status |
|------|-------|--------|--------|
| `full_stack_proposal_rate` | 1.00 | 0.70 | PASS |
| `llm_proposal_success_rate` | 1.00 | 0.80 | PASS |
| `proposed_family_first_ship_hours` | 0.1h | 24 | PASS |
| `capability_promotion_rate` | 0.6667 | 0.40 | PASS |
| `coverage_lift_per_promote` | 0.3077 | 0.10 | PASS (Gen 7 unlock) |
| `proposal_promotion_rate` | 0.0435 | 0.30 | fail (denominator pollution, dilutes naturally) |
| **aggregate** | **0.603** | — | **+19.6pp over Gen 6 baseline** |

## Registry state

- 102 families (was 99 pre-arc) — added kyc-onboarding, fraud-ops-console, polymarket-portfolio-hedging; zk-mixer-ui reverted for routing shape-mismatch (Gen 8 seed)
- 109 capabilities (was 107) — added evm-nft-mint-page, passkey-onboarding

## What was lost in the crash

**Zero code.** R5 proposers (trace-capture fix + workspace-composable proposer) were mid-run when machine crashed. Both worktrees were empty of artifacts when checked post-crash. Lost work = LLM compute + ~20min wall time. The R5 bootstrap config at commit `756bc87` is intact, so R5 can be re-dispatched identically.

## Gen 8 — what's queued, ready to dispatch

**Config:** `.evolve/multi-pursue/round5-config.json` on remote.

**Two orthogonal proposers** (worktree isolation; they target different files so winners compose):

### Proposer A — trace-capture fix
- **Target file:** `scripts/mine-buildout-sessions.mjs` (specifically `findInitialPrompt()` at line 139)
- **Root cause confirmed pre-dispatch:** 20 of 54 buildout scenarios have null `initialPrompt`. All 20 come from `gen32-sdk-live-local` sources (e.g., `sessions/32/gen32-sdk-live-local/phase2-fintech-mixed-mo8jiu1b-kyc-onboarding-r1`). The miner's user-text heuristic works on Claude Code session `.jsonl` files but misses the SDK-live-local entry format.
- **Hypothesis:** Extend `findInitialPrompt` to handle SDK-live-local entry shape, OR add a fallback that derives prompt from `scenarioId` + `partnerGuess`. Re-mine buildouts.jsonl. Expected: scenarios_with_prompt 34/54 → 50+/54.
- **Compound effect:** unlocks the tier1-first router mechanism (Variant A from R4, commit 2d31982 in its now-deleted worktree — the mechanism is not in main but the pattern is documented in `.evolve/multi-pursue/frontier.json`). Expected coverage_lift: 0.308 → 0.45+.

### Proposer B — workspace-composable
- **Target file:** `src/lib/planner/projects.ts` (`collectServiceProjects`, `buildWorkspacePromptPlan`) or `src/lib/prompt-planner.ts`
- **Problem:** 19 of 54 scenarios route to hardcoded `[nextjs-ts, rust-service]` workspace composition regardless of domain. When a prompt is workspace-classified but has no partner (so R4's partner-first doesn't fire), the composition is coarse.
- **Hypothesis:** Make workspace composition registry-aware — scan families whose taxonomy + tier1/tags/keywords align with the prompt per-lane; fall through to hardcoded defaults only when no registry match scores ≥2.
- **Expected coverage_lift:** further +0.05-0.15 on top of A's gains.

**Full briefs for both proposers are in the chat transcript under the original dispatch messages** (search the 2026-04-23 session for "Proposer A in /multi-pursue Round 5" and "Proposer B in /multi-pursue Round 5"). The briefs are also reproducible from `.evolve/multi-pursue/round5-config.json` + the reflection at `.evolve/reflections/2026-04-23-164043-gen6-gen7-arc.md`.

## To resume on a remote runner

**⚠ CRITICAL — agent-eval must be on branch `feat/three-layer-scaffold-only`.**

`package.json` has `"@tangle-network/agent-eval": "link:../agent-eval"`. starter-foundry's `src/training/*/propose.ts` imports `runProposeReview`, `inMemoryReviewStore`, `jsonlReviewStore`, `createLlmReviewer`, and types (`ProposeFn`, `VerifyFn`, `ReviewFn`, `Verification`, `ReviewMemoryEntry`) that were added to agent-eval in commit `c696bfd` on the `feat/three-layer-scaffold-only` branch. Those symbols are NOT on agent-eval's `main` — checking out agent-eval's main will make `pnpm test` fail with TS2305 "has no exported member" errors.

```bash
# On the remote machine — single-shot setup
# 1. Clone AGENT-EVAL FIRST as a sibling (starter-foundry links to ../agent-eval)
cd ~/code   # or wherever, as long as both repos are siblings
git clone https://github.com/tangle-network/agent-eval.git
cd agent-eval
git checkout feat/three-layer-scaffold-only   # MUST be this branch, not main
pnpm install --frozen-lockfile
pnpm build                                    # writes dist/ that starter-foundry links against
cd ..

# 2. Clone starter-foundry as sibling of agent-eval
git clone https://github.com/tangle-network/starter-foundry.git
cd starter-foundry
git checkout feat/emit-cache-warm-list
pnpm install --frozen-lockfile
pnpm build
pnpm test                                     # expect 688/688

# 3. Verify scorecard is intact
node scripts/refresh-scorecard.mjs
cat .evolve/scorecard.json | jq '.aggregate' # expect 0.603
```

The agent-eval commit providing the imports: https://github.com/tangle-network/agent-eval/commit/c696bfd (exports propose-review + steering + judge-runner + optimization-loop; 319/319 tests green at that commit).

Secrets needed: `~/company/devops/secrets/agent-state.env` (Together API key is load-bearing — router is unfunded per the R3 HTTP 402 experience; OpenAI rate-limits at 429 and Gemini 400s on the judge signature). Multi-provider fallback in `src/lib/llm.ts` is default-on since R1 so the pipeline survives any single provider failure.

## To re-dispatch Gen 8 R5 proposers

Run `/multi-pursue` with the config at `.evolve/multi-pursue/round5-config.json` already in place. The skill will read the config, not re-bootstrap. Then dispatch two subagents:
- Proposer A targeting `scripts/mine-buildout-sessions.mjs`
- Proposer B targeting `src/lib/planner/projects.ts`
Both with `isolation: "worktree"`. Brief text is in the transcript and in the config file.

Alternatively, to skip the risk of another local crash, ship Gen 6+7 as a PR now and let the next session run R5 on a fresh machine or remote runner.

## Outstanding items (ranked by ROI)

1. **Open the Gen 6+7 PR.** Ten commits are significant enough to land as a real PR rather than pile more on a feature branch. Title: "Gen 6 + Gen 7: closed-loop generation + architectural ceiling broken." Body: reflection file summary + scorecard delta. This is a zero-risk zero-cost win.
2. **Re-dispatch Gen 8 R5** (see above). Two proposers, orthogonal files, clean compose. ~20min wall time. Expected compound lift on `coverage_lift_per_promote`.
3. **Audit `proposal_promotion_rate`** — the one fail flow. 30-day denominator is polluted by historical fails; consider tuning the rolling-window semantics or waiting for organic dilution via nightly runs.
4. **AxGEPA on `META_JUDGE_SIGNATURE`** — R4's rubric calibration produced the ground-truth example. 5 promotes + 3 reverts in `.evolve/generation-impact.jsonl` is the first training corpus. Concrete Gen 9 candidate.

## Memory entries created during this arc (check after cloning)

Persisted at `~/.claude/projects/-Users-drew-webb-starter-foundry/memory/`:
- `parallel-worktrees-yield-diagnostics.md`
- `partner-metadata-beats-prompt-text.md`
- `judge-rubric-can-be-the-blocker.md`
- `shipped-but-unwired-pattern.md`
- `revert-aware-scorecard-timestamps.md`

These are in a per-project memory dir (not in git). If resuming on a different machine, either re-generate them from the reflection or rsync the memory dir.

## Recommended next command

```
/governor
```

Governor will read current.json + reflections + the R5 config and decide between:
- Re-dispatching Gen 8 R5
- Opening Gen 6+7 as a PR first
- Waiting for nightly autonomous data (R6 shipped nightly proposer+capability pipelines; first night's organic run would inform flow dilution)

The honest read: **the operator's instinct to push + handoff was correct**. A local machine mid-dispatching two parallel LLM agents was the exact failure mode that killed this session. Run the R5 dispatch from a remote box or a longer-running session.
