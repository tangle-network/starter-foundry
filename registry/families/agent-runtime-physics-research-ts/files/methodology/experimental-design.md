---
capability: experimental-design
status: active
source: hand-authored, aligned with PRD/PRL methods conventions and PDG averaging norms
retrieved: 2026-04-26
---

# Experimental Design methodology (physics)

The agent helps a researcher draft a defensible measurement or
calculation. It does not approve the design — that is the
collaboration's review board, the PI, or peer review. The output is a
structured `:::artifact` for a methods section, internal note, or
proposal.

## When to use

Trigger this template when the user asks:

- "How would I measure <observable>?"
- "What systematic uncertainties matter for <experiment>?"
- "How precise do I need to be to distinguish <model A> from <model B>?"
- "How do I propagate uncertainty through <derivation>?"
- "What controls / null tests should this calculation include?"

If the user has not chosen what they're measuring or computing, route
to `literature-search.md` first.

## Method

1. **Pin the observable.** State precisely what number is being
   measured or computed, with units, expected order of magnitude, and
   the regime of validity. "Cross section" is not enough — at what
   √s, for what final state, fiducial vs total.
2. **Pin the discriminating power required.** What is the precision
   target, and what does it discriminate? "Constrain m_W to ±10 MeV
   to discriminate between <Model A> and <SM> at >3σ given current
   electroweak fit."
3. **Identify the dominant statistical and systematic uncertainties.**
   Build the full error budget on paper before running anything.
   - Statistical: scales as 1/√N; sets the integrated luminosity /
     sample-size requirement
   - Systematic: each source enumerated — calibration, modeling,
     background, theory; each gets a budget
4. **Define controls and null tests.** Every measurement has a "do
   the same thing on a sample with no signal" or "swap a known
   ingredient and verify the answer changes correctly." Name them.
5. **Define blinding strategy.** Hidden-signal-region, scrambled-data,
   floating-offset; commit to unblinding criteria *before* looking at
   data. "We unblind once <list of QC checks> all pass" — written
   down.
6. **Specify the analysis chain.** From raw data to the reported
   number: reconstruction, selection, calibration, fit, background
   subtraction, unfolding (if any), uncertainty propagation. Each step
   has an input, an output, and a check.
7. **Specify cross-checks.** Independent analyzers, alternative
   methods (matrix-element vs neural net, profile likelihood vs
   sideband), data/MC agreement plots. State the disagreement
   threshold that triggers re-analysis.
8. **Pre-register the analysis when applicable.** For collaboration
   measurements, internal note + analysis plan before unblinding.
   For independent / preprint work, OSF or arXiv-stamped methodology
   draft before final results.

## Output shape

```
:::artifact
template: experimental-design
observable: { name: "...", units: "...", regime: "..." }
discriminating-power:
  precision-target: "..."
  models-distinguished: ["...", "..."]
  significance-target: "3σ"
error-budget:
  statistical: "δ_stat ~ 1/√N → need N ≥ ..."
  systematics:
    - { source: "calibration", budget: "...", method: "..." }
    - { source: "modeling", budget: "...", method: "..." }
controls:
  null-test: "..."
  closure-test: "..."
blinding:
  strategy: "hidden signal region 0.9 < x < 1.1"
  unblinding-criteria: ["...", "..."]
analysis-chain:
  - step: "reconstruction"
    input: "raw"
    output: "..."
    check: "..."
cross-checks:
  - "alternative method: <method-B>"
  - "second analyzer: <person>"
:::
```

## Common design failures

1. **Underestimated systematics.** Assuming all error is statistical
   gives a misleadingly small budget. Most modern experiments are
   systematics-dominated.
2. **No unblinding criteria.** Looking before commitment leads to
   experimenter bias; pin criteria up front.
3. **Single analyzer / single method.** Internal cross-checks (two
   analyzers, two methods) catch ~half of subtle bugs.
4. **No closure test.** "Run the same pipeline on simulated data
   where the answer is known" should always succeed before running on
   data.
5. **Dropped correlations.** Combining sub-measurements without their
   covariance gives wrong final uncertainty. Use BLUE or profile
   likelihood, not naive weighted average, when correlations exist.
6. **Reporting one-sigma confidence as "evidence."** PDG/HEP
   convention: 3σ = evidence, 5σ = discovery. Many other fields differ
   — be explicit about the threshold convention used.

## Refusal triggers

Emit a `:::escalation` block whenever the user requests:

- A study involving **human subjects** (e.g., medical-physics
  patient data) → IRB / institutional ethics
- **Classified, ITAR, or export-controlled** work → institutional
  security office
- A **patent / IP** opinion on novelty → patent attorney / TTO
- Any **clinical-physics** dose calculation tied to a real patient →
  licensed medical physicist + treating clinician

State the escalation, name the body, and offer to help prepare the
ask (frame the question, draft the outline, list the documents).
