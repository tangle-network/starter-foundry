# RunRecords and Gates (Gen-17)

Every measured run in starter-foundry — audit, propose, eval, judge —
emits a typed `RunRecord` to `.evolve/runs.jsonl`. The `HeldOutGate`
turns a candidate's RunRecords against a baseline's into a structured
`PROMOTE | HOLD | REVERT` decision. Model snapshots are pinned through
`.evolve/snapshots.lock.json` exactly the way `pnpm-lock.yaml` pins
package versions.

This cookbook is the operator runbook: what these substrates are, how
to read them, and the four-step canonical flow.

## What's in `.evolve/runs.jsonl`

One JSON object per line. The shape:

```ts
interface RunRecord {
  runId: string // crypto.randomUUID()
  experimentId: string // logical experiment grouping
  candidateId: string // identifies the variant
  seed: number // for reproducibility
  model: string // <alias>@<snapshot> form ONLY
  promptHash: string // sha256 of effective prompt
  configHash: string // sha256 of role config
  commitSha: string // git rev-parse HEAD
  wallMs: number
  costUsd: number
  tokenUsage: { input: number; output: number }
  outcome: {
    searchScore: number // primary objective in [0,1]
    holdoutScore?: number // optional, present when held-out eval ran
    raw: Record<string, number | boolean> // domain-specific subscores
  }
  splitTag: 'search' | 'holdout' | 'historical'
  failureMode?: string // first failing stage name
  source: 'foundry' | 'vb' // verticalbench coupling
}
```

The `model` field MUST be `<alias>@<snapshot>` (e.g.
`claude-sonnet-4-6@claude-sonnet-4-5-20250929`). The CI invariant
`scripts/check-bare-alias.ts` rejects any record without the snapshot
suffix. The only exception: `splitTag: 'historical'` may carry
`<alias>@unknown-historical` for runs migrated from pre-Gen-17
experiments.

The file is gitignored — it's high-volume local state. The monthly CI
workflow `runs-export.yml` uploads it as a long-retention artifact.

## When to run `pnpm gate`

Any time a prompt or profile change accumulates ~3+ paired runs against
a baseline. The gate composes from agent-eval@0.13's
`bootstrapCi`/`pairedTTest`/`cohensD`/`benjaminiHochberg` primitives —
no reimplementation, no eyeballed p-values.

```bash
pnpm gate baseline.jsonl candidate.jsonl
echo "exit: $?"   # 0 = PROMOTE, 1 = REVERT, 2 = HOLD
```

Decision logic (operator-locked thresholds):

- **REVERT** if `pairedDeltaMedian < 0` AND `p < 0.05` (significantly worse)
- **REVERT** if `holdoutScore` is known AND `searchScore - holdoutScore >= 0.20` (overfit gap)
- **PROMOTE** if `pairedDeltaMedian >= 0` AND `|cohensD| >= 0.5` AND `p < 0.05` AND not overfit
- **HOLD** otherwise

`HeldOutGate` defaults: `minProductiveRuns: 3`, `pairedDeltaThreshold: 0`,
`overfitGapThreshold: 0.20`, `cohensDThreshold: 0.5`,
`applyBHCorrection: true`. Operator-overridable via the constructor.

## Profiles and `extends` inheritance

`.evolve/profiles/<name>.profile.json`. tsconfig-style `extends`. Children
override parent fields. Max depth 5; cycles rejected.

Base: `.evolve/profiles/default.profile.json` declares `logicalModel`,
`alias`, `temperature`, `maxTokens`, `costCeilingUsd`. Roles
(`default-proposer`, `default-judge`, `family-author`,
`capability-author`) extend it.

Inspect:

```bash
pnpm profiles list
pnpm profiles show default-proposer
pnpm profiles diff default default-judge
```

## Refreshing the snapshot lock

`.evolve/snapshots.lock.json` is the source of truth. Profiles declare
`logicalModel`; the lock pins each logical name to a dated snapshot from
the Tangle router catalog.

**Operator (CODEOWNERS-gated):**

```bash
TANGLE_API_KEY=sk-tan-... pnpm refresh-snapshots --apply
```

Listing flows through the `@tangle-network/tcloud` SDK
(`new TCloudClient({ apiKey }).models()`) against `router.tangle.tools` —
the canonical billing meter. There is no direct-Anthropic path: bypassing
the org meter is not an option.

### CLI bridge (runtime chat calls only)

The Tangle Router exposes a _cli-bridge_ short-circuit for chat calls —
rewrites `model` to `bridge/<harness>/<model>` and drives a
subscription-backed CLI (Claude Code, opencode, codex, kimi-code, etc.)
as an OpenAI-compatible harness. Useful for local dev (zero marginal cost
per token; uses the operator's existing subscription) and for SOTA access
where the harness has it before the API does.

CLI bridge is a **routing flag on individual chat calls**, not a separate
listing source. Profiles opt in per-role:

```jsonc
{
  "extends": "default",
  "role": "judge-rubric",
  "logicalModel": "stable-sonnet-4-6",
  "bridge": {
    "harness": "claude-code",
    "model": "sonnet",
    "unlock": "${BRIDGE_UNLOCK}",
  },
}
```

When the profile has a `bridge` block, the loader passes `BridgeOptions`
through to TCloud SDK chat calls. The snapshot lock is unchanged — the
profile still pins `stable-sonnet-4-6` to its dated router snapshot for
audit; the bridge flag just tells the router to route the call through
the local harness instead of billing-metered inference.

**CI (daily cron in `.github/workflows/snapshot-deprecation-check.yml`):**

```bash
pnpm refresh-snapshots --check
```

`--check` warns if a pinned snapshot is within 30 days of deprecation
and fails past deprecation. It never writes the lock.

## The four-step canonical flow

1. **Pin snapshots.** First-run only:
   `pnpm refresh-snapshots --apply` (operator, CODEOWNERS-gated PR).
2. **Run measurements.** Any subcommand or script that emits RunRecords —
   `pnpm audit`, `pnpm propose:family`, `scripts/agent-eval-scaffold.ts` —
   appends to `.evolve/runs.jsonl`.
3. **Split for the gate.** Move records into baseline/candidate jsonls
   (typically: candidate = your branch's runs, baseline = main's). The
   monthly export from `.github/workflows/runs-export.yml` is the source
   of truth for historical baselines.
4. **Decide.** `pnpm gate baseline.jsonl candidate.jsonl`. PROMOTE → ship;
   REVERT → fix or roll back; HOLD → collect more runs and re-run.

## Migrating historical experiments

Pre-Gen-17 generations stored ad-hoc JSONL under
`.evolve/experiments.jsonl` and `.evolve/governor.jsonl`. Run:

```bash
pnpm migrate:experiments
```

The script appends synthetic RunRecords with `splitTag: 'historical'` and
`model: '<alias>@unknown-historical'` (allowlisted by the bare-alias
check). It's idempotent — re-runs dedup by content hash, so no double
entries.

## CI invariants

The five CI checks (all gated in `.github/workflows/ci.yml` or dedicated
workflows):

1. **Bare-alias scan** — `scripts/check-bare-alias.ts` — every RunRecord
   must carry a pinned model.
2. **Profile coherence** — `scripts/check-profile-coherence.ts` — every
   profile's `logicalModel` resolves in the lock (or the lock is empty).
3. **Cost ceiling** — `scripts/check-run-cost-ceiling.ts` — no record's
   `costUsd` exceeds its role's profile ceiling.
4. **Snapshot freshness** — `.github/workflows/snapshot-deprecation-check.yml`
   — daily; warns at 30d, fails past deprecation.
5. **Gate-on-profile-change** —
   `.github/workflows/gate-on-profile-change.yml` — any PR touching
   `.evolve/profiles/` requires either a `gate-decision` check
   (conclusion=success) or a `bypass-gate` PR label with a reason.
