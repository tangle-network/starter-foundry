# Experiment Design Template (ML)

## Purpose
Design a rigorous ML experiment that defends its conclusion. The
output is a pre-registered plan that, executed faithfully, produces
results worth submitting to a top venue.

## When to use
Trigger when the user is planning experiments, designing ablations,
or critiquing an experiment plan. Always upstream of result
generation; running first and designing second is how the
reproducibility crisis happens.

## Method

1. **Hypothesis.** State what is being tested in falsifiable form:
   "Method M will outperform baseline B on benchmark X by ≥Δ% with
   p<0.05 over n seeds." If the hypothesis isn't testable, the
   experiment isn't an experiment.
2. **Baselines.** ≥2 strong, current baselines. Include:
   - The current SOTA (or close to it).
   - A simple-but-strong baseline (often the surprise winner;
     don't skip it).
   - A direct ablation of the proposed method (the method
     without its key novelty).
   Re-implementing baselines is acceptable; re-using the original
   authors' published numbers is acceptable *only* if the
   evaluation protocol is identical.
3. **Metrics.**
   - **Primary**: the headline number; one metric. Pick before
     looking at any data — picking after is fishing.
   - **Secondary**: 2–4 metrics that capture different facets.
   - **Calibration / fairness / robustness** as appropriate.
   - For classification: accuracy + macro-F1 + AUROC; for
     generation: BLEU / ROUGE / human eval; for RL: cumulative
     reward + sample efficiency. Pick by community convention.
4. **Data.**
   - Dataset, version (datasets evolve — e.g., MMLU-Pro
     vs MMLU), source, license.
   - Train / val / test splits with seeds. Test set untouched
     until final evaluation.
   - Pre-processing pipeline reproducible end-to-end.
   - Contamination check: confirm test data does not appear in
     pretraining corpora (where applicable).
5. **Implementation.**
   - Architecture, parameter count, init scheme.
   - Hyperparameters: full list, with the search space and the
     selection criterion.
   - Compute budget: GPU type, count, training hours, total
     FLOPs estimate. Compute-blind comparisons mislead.
   - Reproducibility: framework version, seeds (typically ≥3),
     deterministic mode where feasible.
6. **Statistical plan.**
   - Number of seeds: ≥3 minimum, ≥5 for borderline claims.
   - Significance test: paired t-test for matched-seed
     comparisons; Welch's for unmatched; non-parametric
     (Wilcoxon, Mann-Whitney) when distributions are skewed or
     small-sample.
   - Effect size: report Cohen's d or relative improvement;
     p-value alone is misleading at large n.
   - Multiple-comparison correction (Bonferroni / Holm) when
     testing across many configurations.
   - Confidence intervals on the headline number.
7. **Ablations.**
   - For each component of the proposed method, ablate it. If
     ablating a component doesn't hurt performance, the
     component isn't doing work.
   - Document ablation results alongside the main result —
     reviewers will demand them.
8. **Failure modes and pre-mortem.**
   - What would falsify the hypothesis? Document.
   - Common failure modes: hyperparameter mis-tuning of
     baselines (cherry-picking), test-set leakage, evaluation
     drift, single-seed variance.
   - Add monitoring (loss curves, gradient norms, validation
     score) to catch training failures.
9. **Pre-registration.** Lock the plan before running. OSF,
   internal lab notebook, or arXiv-stamped methodology draft.
   Deviations from the plan are documented and explained.

## Reporting checklist

Use the NeurIPS / ML reproducibility checklist:

- [ ] Code, data, and instructions to reproduce.
- [ ] Description of the compute infrastructure.
- [ ] Hyperparameter search range and method.
- [ ] Seeds reported.
- [ ] Standard deviation / confidence intervals on results.
- [ ] Significance test described.
- [ ] License of every external asset (dataset, model, code).
- [ ] Statement of computational and environmental cost.
- [ ] Limitations section that's honest about scope.

## Common experiment failures

1. **HARKing.** Hypothesizing After Results are Known. Tighten
   the pre-registered plan.
2. **Test-set tuning.** Even one peek at the test set during
   development corrupts it.
3. **Single-seed claims.** ML training has high variance;
   single-seed gains often vanish under re-running.
4. **Weak baselines.** "Outperforms LSTM" in 2026 is not a
   meaningful comparison; pick contemporary baselines.
5. **Compute mismatch.** Comparing a method trained with 10x
   compute to a baseline at 1x; isolate the contribution of
   the method itself.
6. **Cherry-picked benchmarks.** Reporting only the benchmarks
   where the method wins; report the full set.
7. **No code release.** A method without code is a claim, not a
   result.

## Output

```
:::artifact
template: experiment-design
hypothesis: "..."
baselines: [...]
metrics: { primary: ..., secondary: [...] }
data: { dataset: ..., version: ..., splits: {...}, license: ... }
implementation:
  arch: "..."
  params: ...
  hparams: { ... }
  search: { ... }
  compute: { gpu: ..., count: ..., hours: ..., flops: ... }
seeds: [42, 1337, 2718, 314]
statistical-plan: { test: "paired-t", alpha: 0.05, correction: "holm" }
ablations: [...]
pre-registration: { url: "..." }
limitations: [...]
:::
```

## Refusal

The agent will not:
- Approve an experiment without baselines or significance plan.
- Approve cherry-picked benchmark sets without a stated rationale.
- Sign off on a result claim from a single seed.
