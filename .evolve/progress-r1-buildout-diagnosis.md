# Evolve R1 (post-Gen-9) — buildout_pass_rate diagnosis

**Target:** buildout_pass_rate 0.693 → 0.85 (gap 0.157)
**Data source:** `.evolve/buildout-analysis.json` (generated 2026-04-23, 292 buildouts, 212 with outcome, 65 failures)

## Failure decomposition (by toolCallsTotal + failingLayers)

**Pipeline-init failures (34 of 65, OUT OF SCOPE)** — `shotsRun=0, toolCallsTotal=0, blendedScore=0, failingLayers=[]`. These sessions never started. Blank initialPrompt in the traces. This is a VB / factory orchestration data issue, not starter-foundry registry. Partner breakdown: 14× tangle-network, 10× unpartnered, 6× ethereum-foundation, 2× coinbase-base, 2× deno. Not fixable from this side.

**Scaffold-side failures (31 of 65, IN SCOPE)** — have VB execution signal:

| cluster | scenario/partner | count | blended | layer |
|---|---|---|---|---|
| A | dex-swap / ethereum-l1 | 14 | 0.868 | lint |
| B | zk-mixer-ui / ethereum-l1 | 8 | 0.78 | semantic |
| C | base-dex-aggregator / coinbase-base | 2 | 0.78 | build |
| D | p2p-lending-protocol / — | 2 | 0.54 | typecheck+build |
| E | budget-dashboard / — (4 of 5 fails) | 4 | 0.52 | mixed |
| F | transaction-categorizer | 1 | 0.86 | build |

## Cluster A — dex-swap/ethereum-l1 (highest ROI)

14 identical runs, ALL fail on the `lint` layer. blendedScore=0.868 (everything else passes). Routes to the same workspace shape (`react-vite-ts + forge-contracts`) as nft-mint-page/ethereum-l1, which **passes 16/16**. Same families, opposite outcomes → the difference is in the content agents emit, not the starting scaffold.

Agents consistently rewrite `SwapCard.tsx`, `src/index.css`, `index.html`, `package.json`. Adds are duplicates of what react-vite-ts already ships (tailwindcss, @tailwindcss/vite, clsx, lucide-react).

**Root cause: unknown from here.** The `lint` layer is defined on VB's side — starter-foundry just consumes the outcome's failing-layer list, not the actual ESLint output. react-vite-ts itself ships no ESLint config; if VB applies its own ruleset, the specific rule that fires across 14 runs of dex-swap content but not 16 runs of nft-mint-page content is the answer.

**If I had the lint stderr tail from one failing run, Round 2 could ship a targeted fix.** Likely candidates (ordered by prior-probability for "React DEX component" code): `@typescript-eslint/no-unused-vars` on iteration-leftover imports; `react-hooks/exhaustive-deps` on effect arrays computing swap quotes; `@typescript-eslint/no-explicit-any` on amount/token types. Without the signal it's a guess.

**Flip potential:** +14 passes / 212 outcomes = **+6.6pp** → 0.693 → 0.759 alone.

## Cluster B — zk-mixer-ui/ethereum-l1 (second ROI)

8 runs all fail on `semantic` layer. blendedScore=0.78 (lower than dex-swap — quality gap too), 138 mean turns (hitting/near turn cap). Same ethereum-l1 partner. Routes to `react-vite-ts + zk-prover-service + forge-contracts` (different workspace shape). Higher turns + semantic failure suggests the scaffold doesn't give enough scaffolding for the ZK side — agent spends turns figuring it out, eventually loses semantic coherence.

**Flip potential:** +8 / 212 = +3.8pp.

## What I verified locally

- Repro-ability: dex-swap + nft-mint-page route to identical `react-vite-ts + forge-contracts` workspaces. nft-mint passes, dex-swap fails. NOT a family routing bug.
- Timing: all 14 dex-swap/ethereum-l1 sessions ran 2026-04-19 20:32 through 2026-04-20 00:12 UTC, BEFORE Gen 9 + Round 0 landed (2026-04-23/24). Fresh measurements may already show improvement.
- react-vite-ts has NO lint script in package.json — if VB's lint layer tries `pnpm lint` and gets "script not found", that'd be a 100% fail rate for any react-vite-ts scenario. But nft-mint-page passes on the same family, so that theory is ruled out.

## Round verdict: PARTIAL / BLOCKED

Not a KEEP, not a REVERT. Diagnosis landed cleanly, root cause for the highest-ROI cluster requires VB-side data I don't have local access to. Shipping a speculative ESLint-rule guess without the error signal would be the "permutation debugging" antipattern (see CLAUDE.md debugging discipline).

## Handoff — pick one

1. **Preferred: re-measure first.** Buildout data pre-dates Gen 9 by 4 days. Kick off a fresh VB sweep; some failures may have resolved structurally. `/governor` → `/evolve` on the new baseline.
2. **Surgical: share one lint stderr.** Paste the ESLint output from any single `dex-swap/ethereum-l1/lint` failure into the next `/evolve` dispatch. Round 2 can ship a targeted fix within an hour (likely a shared `.eslintrc` or config-tweak that VB can read).
3. **Alternative: tackle zk-mixer-ui semantic.** If the turn-cap hypothesis holds (138 mean turns = hitting cap), the fix is a richer zk-prover-service scaffold with pre-wired UI stubs. That's a registry-side fix I can do locally without VB output — but +3.8pp is smaller ROI than cluster A's +6.6pp.

## Dispatch-at-end

Run `/governor` with the diagnosis above. Expected branch: governor routes to `/reflect` (since R1 is blocked on external signal and the last 3 rounds were /pursue → /evolve → /evolve) OR asks operator to kick a fresh VB sweep. Do NOT auto-dispatch a speculative `/evolve` R2 against the same stale data.
