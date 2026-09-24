# Regression gate

Statistical regression gate over scorecards. Reads two scorecards
(baseline + head), runs per-flow distributional tests, applies multiple-
comparison correction across flows, and emits a single verdict.

## Verdict semantics

- **PROMOTE** — no flow regressed (or all regressions are not
  statistically significant). Build passes (exit 0).
- **HOLD** — possible regressions but the FDR-corrected p-values do not
  cross the threshold, OR the samples are too noisy (high IQR/mean) to
  judge. Build does not pass automatically; humans review (exit 2).
- **REVERT** — at least one flow regressed AND the regression survives
  Benjamini–Hochberg FDR correction. Build fails (exit 1).

## Statistical machinery

All primitives come from `@tangle-network/agent-eval`:

- **`bootstrapCi(baseline, candidate)`** — non-parametric CI on the
  delta of means. 1000 resamples, 95% CI. Robust to skew.
- **`welchsTTest(baseline, candidate)`** — unequal-variance two-sample
  t-test. Yields p-value per flow.
- **`cohensD(baseline, candidate)`** — standardized effect size.
  |d| < 0.2 negligible, 0.2–0.5 small, 0.5–0.8 medium, > 0.8 large.
- **`compareToBaseline(samples, opts)`** — combines all three into a
  per-metric verdict {improved, regressed, stable, unstable}.
- **`benjaminiHochberg(pValues, fdr)`** — FDR correction across the
  per-flow p-values. Default FDR target 0.1 — i.e. expected false
  positive rate of 10%.

## Single-sample mode (default)

Scorecards usually carry one aggregate value per flow, not raw samples.
In that mode the gate:

- Treats each flow's value as a one-sample array.
- Skips bootstrap / Welch (need ≥6 samples combined to be honest).
- Falls back to a delta-vs-`STABILITY_EPSILON` verdict.
- Returns INCONCLUSIVE / PROMOTE / REVERT based on direction-sign.

This is honest about the rigor it can offer at single-sample resolution
— better than fake-confident at small N.

## Multi-sample mode (recommended)

Pass `withSamples` to the `gate()` function with raw per-scenario
arrays:

```ts
import { gate } from '@/eval/regression/gate'

const samples = new Map<string, { baseline: number[]; candidate: number[] }>()
samples.set('correctness', { baseline: [0.7, 0.72, ...], candidate: [0.81, 0.79, ...] })

const report = gate(baseline, head, { withSamples: samples })
```

In this mode the bootstrap CI, Welch's t, Cohen's d, and BH correction
all run with full rigor.

## CI integration

`.github/workflows/regression-gate.yml` (shipped by this layer) runs on
every PR:

1. Checks out `origin/main` to a temp dir, runs `pnpm eval` there to
   produce a baseline scorecard.
2. Runs `pnpm eval` on the PR head.
3. Calls `pnpm eval:gate baseline.json head.json --report report.json`.
4. Uploads `report.json` as an artifact.
5. Fails the build on REVERT (exit 1). HOLD (exit 2) is reported but
   does not fail by default — flip `continue-on-error: false` to gate
   strictly.

## Tunable thresholds

| Flag | Default | Meaning |
|---|---|---|
| `--alpha` | 0.05 | Per-flow significance threshold |
| `--fdr` | 0.1 | BH false-discovery-rate target |
| `--effect` | 0.5 | Cohen's d threshold for "meaningful" delta |
| `--only` | (all) | Comma-list of flows to gate on; others reported only |

## Multiple-comparison correction

Why BH instead of Bonferroni? Bonferroni is too conservative for a
flow-level gate — with 20 flows and α=0.05 it requires p < 0.0025 per
flow, which suppresses real regressions. BH controls FDR (expected
false-positive *rate*), trading some false-negative protection for
power. For PROMOTE/HOLD/REVERT decisions on a CI gate, this is the
right tradeoff.
