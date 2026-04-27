# Result Interpretation Template (ML)

## Purpose
Interpret experimental results honestly. Distinguish what the data
supports from what's plausible-but-unsupported. Surface limitations
and threats to validity. The output is a defensible paragraph + a
results table the reader can audit.

## When to use
Trigger after experiments have run. Before running, use
experiment-design.md. For surveying field-level results, use
literature-review.md.

## Method

1. **Report raw numbers first.**
   - Mean ± std across seeds.
   - 95% confidence interval.
   - Number of seeds.
   - Best, worst, median if distribution is skewed.
   - Don't bury variance — single-number tables hide noise.
2. **Compare to baselines.**
   - **Statistical significance**: paired t-test or non-parametric
     equivalent vs each baseline. Report p-values, not just
     "significant."
   - **Practical significance**: relative improvement, with
     reference to the noise floor. A statistically significant
     0.1% gain on a benchmark with seed-variance ±0.5% is not
     practically meaningful.
   - **Multiple-comparison correction** when comparing across
     many configurations or benchmarks.
3. **Ablations.**
   - For each ablated component, report the result with that
     component removed.
   - Identify the component(s) doing real work; flag the ones
     that don't move the metric — they may be cargo-culted.
   - If an ablation contradicts the headline (the simpler
     version is nearly as good), report it prominently.
4. **Per-stratum analysis.**
   - Break down by data subset (language, domain, difficulty,
     length).
   - Aggregate gains often hide stratum-level regressions.
   - For safety-critical applications, low-frequency stratum
     regressions are the news.
5. **Limitations.**
   - **Data**: scope, language coverage, distribution, freshness,
     license. Can the result generalize beyond this dataset?
   - **Compute**: how much was spent; would the conclusion hold
     at smaller / larger scale?
   - **Method**: assumptions baked in (architecture choice,
     hyperparameter search, evaluation protocol).
   - **Reproducibility**: code released, seeds reported, full
     hparams documented.
6. **Threats to validity** (Cook & Campbell taxonomy adapted):
   - **Internal**: did the manipulation cause the effect, or some
     confounder? Compute disparity, training-data leakage,
     hyperparameter mis-tuning of baselines.
   - **External**: does the result generalize beyond the test
     conditions? Different dataset, different scale, different
     hardware.
   - **Construct**: does the metric measure what the user cares
     about? BLEU vs human judgment of fluency; accuracy vs
     calibrated accuracy.
   - **Statistical**: was the test appropriate? Sufficient
     seeds? Effect size meaningful? Multiple comparisons
     corrected?
7. **Honest hypothesis verdict.**
   - **Supported** with stated effect size and significance.
   - **Partially supported**: held on subset / metric / scale
     but not others; describe.
   - **Not supported**: ran the experiment, didn't see the
     effect. This is a valid outcome.
   - **Inconclusive**: insufficient power; describe what's
     needed to resolve.
8. **Next steps.** What's the most informative follow-up
   experiment given these results? What would falsify the
   interpretation? Where's the evidence still thin?

## Reporting discipline

- **Tables show variance.** Headline numbers always with std or
  CI.
- **Plots show distributions.** Where possible, scatter or violin,
  not just bars.
- **Pre-registration deviations are flagged.** Any change from
  the planned analysis is reported with the original plan and
  the rationale.
- **Anti-cherry-pick.** Report all benchmarks run, not just the
  wins. If an experiment was abandoned, say so and why.

## Common interpretation failures

1. **Statistical-significance theater.** p<0.05 with d=0.05 is
   noise.
2. **Headline-only.** Burying ablations or per-stratum
   regressions.
3. **Generalizing beyond the experiment.** "We've shown M is
   better" when the experiment was on one benchmark at one
   scale.
4. **Ignoring negative ablations.** A component that doesn't
   help should be removed, not silently kept.
5. **Anchoring on the prior.** Choosing the interpretation that
   matches the hypothesis rather than the data.
6. **No threat-to-validity section.** Implies all threats were
   addressed, which they never are.

## Output

```
:::artifact
template: result-interpretation
hypothesis: "..."
verdict: "supported" | "partially-supported" | "not-supported" | "inconclusive"
results:
  primary:
    method: { mean: ..., std: ..., ci: [..., ...], seeds: 5 }
    baseline-1: { ... }
    baseline-2: { ... }
    significance: { test: "paired-t", p: 0.003, effect-size-d: 0.42 }
  secondary: { ... }
ablations: [...]
per-stratum: [...]
limitations: [...]
threats-to-validity:
  internal: [...]
  external: [...]
  construct: [...]
  statistical: [...]
deviations-from-plan: [...]
next-steps: [...]
:::
```

## Refusal

- The agent will not interpret a result claimed under a single
  seed as a finding.
- The agent will not omit a limitations or threats-to-validity
  section.
- The agent will not soften "not-supported" to "trends in the
  expected direction" — say what the data shows.
