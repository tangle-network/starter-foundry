# Pairwise judge

Position-bias-aware A-vs-B evaluation built on `@tangle-network/agent-eval`'s
`PairwiseSteeringOptimizer` plus the `positionalBias` / `verbosityBias` /
`selfPreference` adversarial-bias suite.

## Why pairwise

Absolute rubric scores are noisy when variants are close (delta < 0.05). A
ranked decision ("v2 is better than v1 on this scenario") is more reliable
than absolute calibration, especially across heterogeneous prompts where
the rubric scale isn't preserved.

## Why position-corrected

LLM judges score the candidate they see first higher than the same
candidate shown second. Without position correction, every comparison is
biased toward whichever variant the harness happens to put in slot A.

The runner invokes the supplied `judge` function **twice per scenario** —
once with `(first: A, second: B)` and once with `(first: B, second: A)` —
and only declares a winner when the SAME variant wins in both orderings.
Disagreement collapses to `'tie'` and surfaces as a positional bias
signal in the report. Score reuse across orderings is forbidden by
construction; the API requires a real `judge` callable.

## Judge contract

```ts
const judge: PairwiseJudge = async ({ first, second, scenarioId }) => {
  // Run your LLM/human/learned judge here. Return both scores in 0..1.
  return { firstScore: 0.82, secondScore: 0.79 }
}
```

Implementations MUST treat `first` and `second` as opaque presentation
slots; sorting/normalising by `variantId` inside the judge erases the
position-bias signal that this layer exists to surface.

## When to use

- After rubric eval (`agent-eval:judge-rubric`) shortlists 2-4 candidates.
- When absolute scores cluster within 0.05 (signal lost in rubric noise).
- For prompt iteration where you have many sibling variants to triage.

## When NOT to use

- For absolute thresholds. Pairwise tells you "A > B", not "A meets the
  bar". Use rubric eval for thresholds.
- When variants disagree on scenario coverage. Pairwise only scores
  scenarios both variants ran.

## Running

```bash
tsx src/eval/judges/pairwise-cli.ts ./runs/v1 ./runs/v2 --judge-family claude-opus-4
```

Both directories must contain `outputs.json` with `{ variantId, family,
scenarios: [...] }`. Set `PAIRWISE_JSON_OUT=path/to/report.json` to also
emit a structured sidecar for CI ingestion.

## Bias gates

The example in `pairwise.example.ts` shows the canonical guard:

```ts
if (Math.abs(report.bias.position.avgDelta) > 0.1) throw new Error(...)
if (Math.abs(report.bias.verbosity.pearson) > 0.6) throw new Error(...)
```

`selfPreference` is computed only when `judgeFamily` is provided AND the
variants declare `family`. Non-trivial `deltaMean` (>0.05) means the
judge prefers outputs from its own family — swap to a heterogeneous
judge fleet (`runJudgeFleet` from agent-eval) before promoting.

## What composes here

| Capability         | Source                                                |
| ------------------ | ----------------------------------------------------- |
| `eval:scenarios`   | `agent-eval:scenarios` (Worker 1) — corpus this reads |
| `eval:judge-rubric`| `agent-eval:judge-rubric` (Worker 1) — produces `RunScore` per variant |
| `eval:judge-pairwise` | this layer — composes both for ranked decision    |

This layer does NOT re-score outputs — it consumes `RunScore` from rubric
eval. If rubric eval hasn't run, run it first.
