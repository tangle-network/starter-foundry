---
capability: experimental-design
status: active
source: hand-authored, aligned with ARRIVE 2.0, NIH rigor & reproducibility, and pre-registration norms
retrieved: 2026-04-26
---

# Experimental Design methodology

The agent helps a researcher draft a defensible experimental design.
It does not approve the design — that is the PI's, IRB's, IACUC's, or
peer reviewer's job. The output is a structured `:::artifact` the user
can take into a lab meeting or grant application.

## When to use

Trigger this template when the user asks:

- "How should I design an experiment to test X?"
- "What controls do I need for Y?"
- "How many replicates / animals / samples?"
- "What's a good positive control for Z?"
- "How do I pre-register this study?"

If the user has not yet decided what hypothesis they're testing, route
back to `literature-search.md` first — design without a hypothesis is
fishing.

## Method

1. **Pin the hypothesis.** State H₀ and H₁ in plain words *and* in
   measurable form. "More expression" is not measurable; "≥2-fold
   increase in TP53 mRNA at 24 h post-treatment vs vehicle" is.
2. **Identify the dependent variable + measurement.** Specific assay,
   specific readout (qPCR ΔΔCt vs absolute copy number, Western blot
   densitometry vs flow MFI, RNA-seq DESeq2 LFC). Different readouts
   have different sensitivity and bias.
3. **Identify independent variables and levels.** Treatment, dose,
   time, genotype, sex, age. Avoid silently varying more than one at a
   time unless using a factorial design.
4. **Identify confounders and how each is controlled.**
   - Batch effects → randomize across days, blocks, plate positions
   - Litter / cage / dam effects (animal work) → cluster-aware analysis
   - Sex → both sexes by default unless biologically excluded; analyze
     separately
   - Operator → blind the operator to condition
   - Time of day, feeding state, housing — list and address each
5. **Pick controls explicitly.** Negative (vehicle, sham, scramble),
   positive (known-effective stimulus), no-treatment baseline,
   technical (no-template / no-primary-antibody), and biological
   (independent biological replicates, not just technical replicates).
6. **Justify sample size.** Power calculation: effect size (from
   pilot data or literature), α (typically 0.05), power (typically
   0.8). Cite the calculator (`pwr` in R, G*Power, online effect-size
   tools). State assumptions explicitly. For animal work: ARRIVE 2.0
   requires this.
7. **Pre-register the analysis plan.** Primary endpoint, secondary
   endpoints, planned statistical test, multiple-testing correction,
   stopping rules. Adding endpoints post-hoc is exploration, not
   confirmation — distinguish.
8. **Specify quality-control gates** *before* unblinding. RNA quality
   (RIN ≥ 7), Western loading control band, alignment rate, biological
   replicate correlation. State the discard threshold up front.

## Output shape

```
:::artifact
template: experimental-design
hypothesis:
  null: "..."
  alt: "≥2-fold increase in <readout> at <timepoint> vs <comparator>"
design:
  type: "factorial 2x3"
  arms: [...]
  n-per-arm: 8
  power-calc:
    effect-size: 1.2 (Cohen's d, from pilot, n=4/arm)
    alpha: 0.05
    power: 0.8
    tool: "pwr::pwr.t.test (R)"
  controls:
    negative: "..."
    positive: "..."
    technical: "..."
  blinding: "operator blinded to genotype until analysis complete"
  randomization: "block-randomized across 3 days, 2 cages per arm"
  endpoints:
    primary: "..."
    secondary: ["...", "..."]
  qc-gates:
    - "RIN ≥ 7 for RNA-seq inclusion"
    - "Drop animals losing >20% baseline body weight"
  pre-registration: "Plan to register on OSF before sample collection."
:::
```

## Common design failures

1. **Pseudoreplication.** Ten Western lanes from one mouse is n=1, not
   n=10. Biological replicates require independent biological units.
2. **Underpowered.** "n=3" is the default reflex but rarely justified
   by a real power calculation. State the minimum detectable effect
   given the chosen n; if the user can't detect anything smaller than
   their expected effect, the experiment is not well-powered.
3. **HARKing risk.** Hypothesizing After Results are Known. Lock the
   primary endpoint and analysis plan before unblinding.
4. **Single-sex bias.** NIH and many funders require both sexes
   considered. If excluding one, justify biologically (e.g., uterine
   tissue study).
5. **Missing positive control.** A null result without a positive
   control is uninterpretable — you can't tell experiment-failed from
   biology-says-no.
6. **No pre-registration plan.** Confirmatory science needs a
   pre-registered plan; otherwise call it exploratory and label results
   as hypothesis-generating.

## Escalation triggers

Emit a `:::escalation` block whenever:

- The design touches **human subjects** (consent, recruitment, sample
  storage) → IRB
- The design uses **vertebrate animals** → IACUC + ARRIVE 2.0 reporting
- The design uses **rDNA, viruses, select agents, BSL-3 work, or
  gain-of-function** → IBC + biosafety officer
- The user asks for **clinical-trial-style design** with real patients
  → registered clinical trialist + biostatistician + IRB
- The design produces **identifiable genetic or health data** → HIPAA
  compliance + data-use agreement

State the escalation, name the body, and offer to help prepare the
submission (frame the question, draft the protocol skeleton, list the
required documents).
