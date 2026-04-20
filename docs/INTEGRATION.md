# Integration Guide

How to wire starter-foundry into a downstream agent runtime (e.g., blueprint-agent) and close the feedback loop so the scaffolds get smarter on every run.

## Programmatic API — the hot path

```typescript
import { planPrompt, composeStarter, createContextPack } from '@tangle-network/starter-foundry'

// 1. Route the prompt to a family + capabilities. ~1ms, no network, no LLM.
const plan = await planPrompt({
  prompt: userMessage,
  partner: null,              // or 'coinbase' | 'tangle' | 'solana' | ...
})

// 2. Compose files to disk. ~3ms.
if (plan.kind === 'starter') {
  await composeStarter({ spec: plan.spec, outDir })
} else {
  // workspace — multiple families composed into one repo
  const { composeWorkspace } = await import('@tangle-network/starter-foundry/workspace')
  await composeWorkspace({ spec: plan.spec, outDir })
}

// 3. Build plan for the agent. ~5ms.
const ctx = await createContextPack({ spec: plan.spec, outDir })
// ctx.agentBrief.summary + ctx.agentBrief.firstMoves + ctx.buildPlan → feed to the agent
```

## Multi-family workspaces

A prompt like "Build a DEX swap page for Ethereum" routes to a workspace with `web` + `evm` projects:

```json
{
  "kind": "workspace",
  "spec": {
    "projects": [
      { "id": "web", "path": "apps/web", "spec": { "family": "react-vite-ts", "layers": [...] } },
      { "id": "evm", "path": "contracts/evm", "spec": { "family": "forge-contracts", "layers": [...] } }
    ]
  }
}
```

`composeWorkspace` writes each project into its own subdirectory. Callers should feed a separate `contextPack` per project to the agent, not try to merge them.

See `src/lib/prompt-planner.ts` → `buildWorkspacePromptPlan` for the routing rules.

## Telemetry — what to emit

Every invocation of starter-foundry produces a deterministic plan. To close the feedback loop — so templates get fixed based on real agent behavior — the runtime that consumes starter-foundry should emit **session events** after each buildout.

### Minimum viable: 4 event kinds

Append to a JSONL sink. Schema version is `1`.

```typescript
interface ScaffoldRequestEvent {
  kind: 'scaffold.request'
  schemaVersion: 1
  sessionId: string          // UUID
  ts: string                 // ISO 8601
  userId: string             // hashed/opaque
  prompt: string             // scrubbed (see below)
  partner: string | null
  plan: {
    kind: 'starter' | 'workspace'
    family: string
    layers: string[]
    routingDurationMs: number
  }
}

interface ScaffoldValidatedEvent {
  kind: 'scaffold.validated'
  schemaVersion: 1
  sessionId: string
  ts: string
  ok: boolean                // result of validateStarter BEFORE agent touched it
  checks: Array<{ type: string; path?: string; ok: boolean; error?: string }>
}

interface BuildResultEvent {
  kind: 'build.result'
  schemaVersion: 1
  sessionId: string
  ts: string
  command: string            // "pnpm build" | "pnpm test" | ...
  exitCode: number
  durationMs: number
  stdoutTail: string         // last ~2KB
  stderrTail: string         // last ~2KB
  onBareScaffold: boolean    // true if agent hasn't edited yet
}

interface SessionOutcomeEvent {
  kind: 'session.outcome'
  schemaVersion: 1
  sessionId: string
  ts: string
  status: 'completed' | 'abandoned' | 'stuck' | 'pivoted'
  totalTurns: number
  buildCount: number
  buildFailureCount: number
  userAcceptedPR: boolean | null
  qualityScore: number | null   // 0..1, your metric
}
```

These 4 answer the only question that matters: **did the scaffold build, did the agent finish, did the user accept the result.**

### Nice-to-have — for richer training signal

- `agent.modified_file` — path + hash-before + hash-after per edit. Tells us which scaffold files agents always rewrite (template-quality signal).
- `agent.added_capability` — when agent runs `pnpm add X` or creates `src/payments/`. Tells us which capabilities we should have attached (routing-quality signal).
- `user.followup` — classified as correction | continuation | abandonment.

See `docs/AGENT_EVENT_SCHEMA.md` in this repo for the full spec with typescript types.

### Scrubbing (mandatory)

Before emitting any string field, regex-replace secrets:

```
sk-[A-Za-z0-9_-]{20,}    → <REDACTED:apikey>
ghp_[A-Za-z0-9]{36,}      → <REDACTED:ghtoken>
AKIA[0-9A-Z]{16}          → <REDACTED:aws>
Bearer\s+[A-Za-z0-9._-]{20,} → <REDACTED:bearer>
postgres(?:ql)?://[^\s]+  → <REDACTED:dburl>
```

Never include full file contents in any event — use content hashes + sizes. Reconstruction is possible from the scaffold's git commit + the edit log.

## Consuming the pipeline — where findings land

Run the pipeline manually or on a schedule:

```bash
node scripts/run-buildout-pipeline.mjs
```

Three committed output files — each is your actionable input:

| File | What it tells you | How to act on it |
|---|---|---|
| `.evolve/buildout-analysis.json` | Per-scenario pass rate, top-added packages, top-rewritten files | Rewrite the worst templates first |
| `.evolve/capability-gaps.json` | (scenario, capability) missed-attachment rankings | Fix the router where the gap is ≥3× |
| `.evolve/scaffold-quality-audit.json` | Which framework layers fail `pnpm install` / `tsc --noEmit` on a bare compose | Patch the layer's `package.json` / `tsconfig.json` |

### Typical workflow

1. Runtime (blueprint-agent) emits events per the schema above to shared storage (R2, Turso, or just append to a JSONL file).
2. Periodically: drop the JSONL into `.evolve/traces/vb-execution-<variant>.jsonl` OR feed a new miner script that conforms to `BuildoutEvent` (see `src/lib/buildout-traces.ts`).
3. Run `node scripts/run-buildout-pipeline.mjs`.
4. Review `.evolve/capability-gaps.json`.
5. For each gap with `missedIn >= 3`: fix the router in `src/lib/prompt-planner.ts` or add a capability mapping to `registry/package-to-capability.json`.
6. For each rewritten file in `.evolve/buildout-analysis.json` with `timesRewritten >= 5`: improve the template.
7. Ship the PR, audit re-runs, delta is visible.

### Programmatic ingestion — `emitBuildoutEvent`

For consumers that want to push events directly rather than write their own miner script, starter-foundry exposes a programmatic entrypoint that appends to the same `.evolve/traces/buildouts.jsonl` the local miner fills:

```typescript
import { emitBuildoutEvent } from '@tangle-network/starter-foundry'

await emitBuildoutEvent({
  sessionId: run.id,
  sourceModel: 'blueprint-agent-vb',  // or your runtime name
  sourcePath: run.manifestPath,
  scenarioId: run.scenarioId,
  partnerGuess: run.verticalId,
  replayRound: run.round,
  initialPrompt: run.prompt,
  addedPackages: run.packagesInstalled.map((n) => ({ pm: 'pnpm', name: n })),
  addedDirs: run.dirsCreated,
  rewrittenFiles: run.filesEdited,
  outcome: {
    source: 'vb-execution',
    allPass: run.verification.allPass,
    blendedScore: run.verification.blendedScore,
    failingLayers: run.verification.failingLayers,
    shotsRun: run.verification.shotsRun,
    shotsToConvergence: run.verification.shotsToConvergence,
    wallMs: run.wallMs,
    toolCallsTotal: run.toolCallsTotal,
  },
})
```

`emitBuildoutEvent`:
- writes atomically via `O_APPEND` (multi-writer safe across concurrent runs)
- creates `.evolve/traces/` on first call
- rejects empty `sessionId` or `sourceModel` (fail-loud instead of silently dropping)
- returns the fully-populated event so callers can log/inspect it

Downstream analysis (capability-gap detector, buildout-analysis aggregator, meta-harness training data) picks up these events on the next `run-buildout-pipeline.mjs` invocation without code change.

## Version + compatibility

- Package version lives in `package.json`.
- `BUILDOUT_SCHEMA_VERSION` (`src/lib/buildout-traces.ts`) pins the trace format. Bump on breaking change — old rows auto-rebuild.
- The pipeline is **append-only**, **resumable**, and **concurrent-safe**. Second run on unchanged data is a no-op.
- See `tests/buildout-pipeline.harden.test.ts` for the invariants the pipeline promises.

## One thing not to do

Don't emit events synchronously in the hot path. Fire-and-forget the session log to a background writer. starter-foundry's `planPrompt` + `composeStarter` are sub-10ms; any event emission that blocks there defeats the value.
