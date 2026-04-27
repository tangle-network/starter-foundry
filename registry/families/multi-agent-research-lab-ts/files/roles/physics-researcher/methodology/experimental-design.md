---
capability: experimental-design
role: physics-researcher
status: active
source: hand-authored
retrieved: 2026-04-26
---

# Experimental Design (Physics)

## Purpose

Help the operator design a physics experiment with hypotheses,
controls, and an analysis plan. The deliverable is an
`:::artifact template: experimental-design` the operator can take to
their advisor / committee / collaborators.

This methodology is for **design**, not execution. The lab does not
run experiments; it does not give safety advice. Anything that
crosses into wet-lab safety, IRB, ionising radiation, biosafety, or
ITAR / EAR triggers `:::escalation`.

## Inputs

- The dispatched sub-question (a "design X" question from the
  Director).
- Any prior literature the operator named, plus what
  `arxiv-literature-search` retrieved in this turn.
- The operator's stated constraints (instruments available, sample
  size budget, time horizon).

## Step-by-step procedure

### Step 1 — extract the testable claim

Reframe the operator's question as a **testable claim** with a
precise observable. Vague: "does the polymer get stiffer near Tg?"
Testable: "the persistence length of polymer X measured by AFM
single-molecule pulling increases by > 20% as T → Tg from above."

If you cannot extract a testable claim, return to the Director with
`finding: question is not yet testable, would need <X> to refine`.

### Step 2 — write H0 / H1 in measurable form

```
H0: persistence length is constant within measurement noise across
    the temperature range [T_low, Tg + 20K].
H1: persistence length increases monotonically with (Tg - T) for
    T ∈ [T_low, Tg], with effect size > 20% at Tg.
```

Both hypotheses must reference the actual observable, not a
qualitative summary. "The polymer gets stiffer" is not an H1.

### Step 3 — variables

Spell out:

- **Independent**: temperature (specify range, step size, ramp
  protocol).
- **Dependent**: persistence length (specify estimator — WLC fit?
  Kratky? — and units).
- **Controlled**: solvent, polymer concentration, cantilever
  spring constant, pulling speed, number of pulls per molecule, MW
  distribution.
- **Confounded**: anything you can't fully control — solvent
  evaporation at high T, polymer adsorption to substrate. Name them
  and propose mitigations.

### Step 4 — statistical plan

Pick the test up-front. Common choices:

- **Two-sample comparison** — t-test or Mann-Whitney U.
- **Trend across N temperatures** — linear regression with slope CI;
  if non-parametric, Spearman rank.
- **Effect-size aware** — Cohen's d or Cliff's delta, not just
  p-values.

Compute required sample size from the claimed effect size (step 2)
and a target power (typical 0.8) at α = 0.05. **No experiment ships
without a power calculation**; an underpowered design wastes the
operator's time.

For Bayesian designs, specify the prior, the data model, and the
posterior summary the operator will report.

### Step 5 — controls + replicates

- **Positive control** — a known polymer / system with a published
  persistence length response.
- **Negative control** — a system known not to show the effect (a
  small-molecule analog, or the same polymer at T >> Tg).
- **Technical replicates** — same molecule pulled N times.
- **Biological / sample replicates** — N independent molecules.

State both N's. Underspecifying replicates is the most common
review-killer.

### Step 6 — confounds + mitigations

For each named confound (step 3), propose a mitigation. Examples:

| Confound | Mitigation |
|---|---|
| Solvent evaporation at high T | Sealed cell, periodic mass check, abort criteria. |
| Polymer adsorption | PEG-passivated substrate; check by force-clamp. |
| Cantilever drift | Periodic recalibration against thermal spectrum. |
| Operator bias | Blind labels; randomised pull order. |

### Step 7 — output the artifact

```
:::artifact
template: experimental-design

Testable claim: [step 1]

Hypotheses:
  H0: [...]
  H1: [...]

Variables:
  Independent: [...]
  Dependent: [...]
  Controlled: [...]
  Confounded (mitigated): [...]

Procedure:
  1. [...]
  2. [...]

Statistical plan:
  Test: [...]
  α: 0.05
  Power: 0.80
  Required N: [from power calc, with formula or tool used]
  Effect-size estimator: [d / r / etc.]

Replication:
  Technical: [n]
  Sample / biological: [n]

Controls:
  Positive: [...]
  Negative: [...]

Citations: [for the literature this design draws from]
:::
```

### Step 8 — emit handoffs if triggered

If the design depends on a chemistry primitive (specific polymer
synthesis route, solvent-property data) hand off to chemistry. If it
depends on a biology primitive (live-cell imaging, protein-specific
buffer) hand off to biology. The design artifact still ships from
physics, but the cross-domain context is owned by the right role.

## Mandatory escalation triggers

Stop and emit `:::escalation` if the design involves:

- **Human subjects** — IRB before anything else.
- **Live-vertebrate animals** — IACUC.
- **Ionising radiation** — radiation safety officer.
- **High-pressure / high-voltage / cryogenic** — institutional safety.
- **BSL-2+** — institutional biosafety committee.
- **Controlled substances or precursors** — DEA / regulatory affairs.
- **Classified or export-controlled** — institutional security.

Pair every escalation with the document the operator should bring
to the professional (protocol draft, hypothesis, power calc, MSDS,
etc.).

## Anti-patterns

- **Skipping the power calc.** "We'll see what we get" — never
  ships, gets review-killed.
- **All-controlled, no-confounded.** Honest design names the
  confounds it cannot control. Hidden confounds become reviewer
  ammunition.
- **Vague observable.** "Stiffer" is not a measurement; persistence
  length in nm is.
- **Mixed claims.** Two H1's hidden in one experiment; split them.

## Source

Adapted from Wasserstein & Lazar 2016 (ASA p-value statement),
Cohen 1988 (power), the methods sections of *Methods* and *Nature
Protocols*, and Box / Hunter / Hunter *Statistics for Experimenters*.
Calibrated for a single-experiment design conversation, not a full
study plan.
