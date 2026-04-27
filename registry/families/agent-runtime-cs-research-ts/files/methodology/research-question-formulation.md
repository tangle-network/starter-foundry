# Research Question Formulation Template

## Purpose
Formulate a research question grounded in a real literature gap,
with a falsifiable hypothesis, a methodology sketch, and a
positioning argument against prior work. The output is a
mini-proposal the user can take to an advisor or grant committee.

## When to use
Trigger when the user has an interest area but no sharp question,
or has a question and wants to test whether it's well-posed. For
literature search itself, route to literature-survey.md. For
experiment design once the question is set, route to the relevant
ML / systems / theory experiment templates.

## Method

1. **Survey first.** A research question that doesn't engage
   prior work is not a research question — it's a guess.
   Require at least a literature survey covering: foundational
   works, recent SOTA, methodologically related work in
   adjacent fields. Without this, the proposal will reinvent or
   miss obvious context.
2. **Identify a real gap.** Gaps come in flavors:
   - **Empirical gap**: a phenomenon under-measured. "X has
     never been benchmarked at scale Y."
   - **Methodological gap**: a method exists but hasn't been
     applied to a class of problems. "Method M works for X but
     hasn't been tried on Y."
   - **Theoretical gap**: an empirical result lacks explanation.
     "We observe X; no theory explains why."
   - **Contradiction gap**: prior work disagrees; the field
     needs resolution.
   Avoid pseudo-gaps: "no one has done exactly this thing in
   exactly this configuration" is usually a sign the gap isn't
   significant.
3. **Draft the question.** A good question is:
   - **Specific**: not "improve transformers," but "does
     <specific change> reduce <specific metric> on <specific
     benchmark> by <specific margin>?"
   - **Answerable**: with available data, compute, time.
   - **Significant**: the answer matters to people other than
     the asker.
   - **Falsifiable**: there's a possible result that says "no."
4. **State the hypothesis.** A prediction with a direction and
   (where possible) a magnitude. "We hypothesize <method M> will
   reduce <metric> by ≥<Δ> on <benchmark> compared to <baseline>
   with p<0.05 over n seeds."
5. **Sketch the methodology.**
   - Data: what dataset(s), what splits, what augmentation.
   - Method: architecture, training recipe, ablations.
   - Baselines: which comparators (current SOTA + simple-strong).
   - Metrics: primary + secondary.
   - Statistical plan: seeds, significance test.
   - Compute estimate: rough budget (GPU-hours, $).
6. **Position against related work.**
   - For each major prior approach, name it, say what it did,
     and say what's different about your approach.
   - Don't strawman; the reviewer will know.
   - "Concurrent work" (papers within the last ~6 months on
     similar topics) — name them; explain the differentiation.
7. **State expected contribution.** What does the field gain if
   the hypothesis is supported? What does it gain if it's
   refuted? Both should be valuable; if "yes" is interesting and
   "no" is uninteresting, the question is asymmetric and
   probably not well-posed.
8. **Stress-test the question.**
   - **What if a stronger baseline already wins?** (Then the
     contribution is smaller / null.)
   - **What if the result depends on a single hyperparameter?**
     (Then the contribution is fragile.)
   - **What if a contemporary paper just answered it?**
     (Re-survey if more than 2 months since literature review.)
   - **What if the metric is contested?** (Tighten the metric
     choice.)

## Output

```
:::artifact
template: research-question-formulation
question: "..."
gap-type: "empirical" | "methodological" | "theoretical" | "contradiction"
gap-description: "..."
hypothesis:
  prediction: "..."
  effect-size: "..."
  significance: "..."
methodology-sketch:
  data: "..."
  method: "..."
  baselines: [...]
  metrics: { primary: "...", secondary: [...] }
  seeds: ...
  compute-estimate: "..."
related-work:
  closest:
    - { paper: "...", contribution: "...", differentiation: "..." }
  concurrent:
    - "..."
expected-contribution:
  if-yes: "..."
  if-no: "..."
limitations: [...]
risks:
  - "stronger baseline may close the gap"
  - "..."
:::
```

## Common formulation failures

1. **Vague question.** "Can transformers do reasoning?" — too
   broad, not answerable.
2. **Hypothesis with no magnitude.** "M works better" — better
   how, by how much?
3. **No baselines.** Question implicitly assumes "vs nothing,"
   which guarantees a positive result.
4. **Survey gap.** Drafting the question without mapping the
   field; the closest prior work usually exists.
5. **Asymmetric novelty.** A "yes" makes a paper, a "no" makes
   nothing — usually a sign the question is too narrow.
6. **Compute-impractical.** Hypothesis requires resources the
   researcher won't get.

## Refusal

The agent will not:
- Approve a question without a literature-survey foundation.
- Approve a hypothesis without effect size and significance.
- Treat "novel" as sufficient — novelty without significance is
  not a research contribution.
