# Hypothesis Schema

Each entry in `queue.json` is a `Hypothesis`:

```ts
interface Hypothesis {
  id: string                  // kebab-case, unique
  name: string                // short human label
  rationale: string           // WHY + supporting evidence
  category:
    | 'bug-fix'
    | 'architectural'
    | 'efficiency'
    | 'parameter-tuning'
  expected_impact: string     // metric: direction (e.g. "pass rate: +5-10pp")
  risk?: string               // what could regress
  priority: 1 | 2 | 3         // 1 = ship-blocker, 3 = nice-to-have
  treatment: Record<string, unknown>
                              // free-form payload — your runner interprets it
}
```

Mirrors the contract documented in `~/.claude/skills/research/SKILL.md`.

## Categories (priority order)

1. **`bug-fix`** — failures that should be passes. Highest ROI, always
   tested first.
2. **`architectural`** — new capabilities, better abstractions, smarter
   strategies. Higher durability than tuning.
3. **`efficiency`** — same quality, less cost / latency / tokens.
4. **`parameter-tuning`** — config knob adjustments. Lowest priority,
   most likely to overfit.

## Anti-patterns

The runner does not enforce these directly, but the operator should
reject queue entries that violate them:

- Hypothesis tied to a single scenario id ("only fixes case X") →
  memorisation, not improvement.
- Hypothesis without a `rationale` linking to evidence → vibes-driven
  experimentation, no learning loop.
- Hypothesis with `expected_impact: "make it better"` → not measurable,
  not gateable.
- `parameter-tuning` priority 1 → almost always wrong; bug fixes and
  architectural changes outrank tuning.

## Workflow

1. Append entries to `queue.json`.
2. Run `pnpm research:screen` (cheap 1-rep pass, ranks by delta).
3. Run `pnpm research:validate` on the screener winners (5-rep
   bootstrap-CI gate).
4. Operator reads `research-results/<runId>/scorecard.json`, decides
   what to promote. The harness emits a recommendation; promotion is a
   human call.

## Treatment payload

The runner is treatment-agnostic. `treatment` is forwarded verbatim to
your `ScenarioRunner.runTrial`. Common shapes:

```jsonc
// Prompt delta
{ "kind": "system-prompt-delta", "append": "...", "promptVersion": "v2" }

// Steering bundle id (consumer-side resolved)
{ "kind": "steering-bundle", "bundleId": "v3-aggressive" }

// Config knob
{ "kind": "config", "delta": { "temperature": 0.2, "maxTokens": 2048 } }

// Code patch reference
{ "kind": "patch", "branch": "feat/parallel-tools", "sha": "abc123" }
```

Whatever shape you use, document it once in this file so the proposer
emits compatible drafts.
