---
capability: research-question-formulation
role: lab-director
status: active
source: hand-authored
retrieved: 2026-04-26
---

# Research Question Formulation

## Purpose

Take the operator's raw question and produce a structured research
question the domain roles can act on. The Director runs this method
on every new question, before dispatch.

A well-formulated research question:

- Names the **type** (fact, interpretive, design, or comparison).
- Names the **primary domain** of the answer.
- Names any **secondary domains** the answer is likely to draw from.
- Bounds the **scope** (date range, organism / system / compound, level
  of detail).
- Names the **deliverable** (citation list, mechanistic narrative,
  experimental design, comparison table).

Without this step, the Director ends up dispatching a vague question
to a role that wastes its citation budget on the wrong sub-problem.

## When to use

- On every new operator question, before any `:::dispatch`.
- After a role's `:::contribution` reveals the original question was
  mis-framed — re-formulate, re-dispatch.
- When the operator pushes back on a synthesis — re-formulate to
  find the question they actually meant.

## Question types — pick one (or split into two)

| Type | Signal | Example |
|---|---|---|
| **Fact** | "what is", "what's the value of", "what's known about" | "What's the melting point of caffeine?" |
| **Interpretive** | "why", "how", "what mechanism", "what explains" | "Why does caffeine antagonize adenosine A2A?" |
| **Design** | "design", "propose", "how would I test" | "Design an experiment to measure A2A binding affinity." |
| **Comparison** | "compare", "vs", "trade-offs between" | "Compare CRISPR-Cas9 vs Cas12 for gene editing in mammalian cells." |

If the operator's question contains two types (fact + interpretive is
the most common combination), split it into two sub-questions and
dispatch separately.

## Domain detection

The primary domain is the discipline whose journals would publish the
**answer** paper, not the question paper. Heuristics:

- **Physics-primary** — quantum mechanics, statistical mechanics,
  diffusion / transport, force fields, free-energy landscapes,
  experimental design with statistical power, Monte Carlo / MD,
  spectroscopy theory, photonics.
- **Chemistry-primary** — reaction mechanisms, retrosynthesis,
  catalysis, compound properties, spectra interpretation, organic
  / inorganic / physical chemistry.
- **Biology-primary** — protein structure, sequence / phylogenetics,
  cell biology, molecular biology, pharmacology, genetics, ecology,
  bioinformatics.

If the question turns on a primitive from another domain, the
**secondary** domain belongs to that primitive's owner — flag it so
the dispatch budget is shared.

## Output — the formulated question

Emit (internally, not necessarily shown to the operator) a
`:::artifact` block tagged
`template: research-question-formulation`:

```
:::artifact
template: research-question-formulation
operator-question: [verbatim quote]

formulated:
  type: [fact | interpretive | design | comparison]
  primary-domain: [physics | chemistry | biology]
  secondary-domains: [list]
  scope:
    date-range: [e.g. last 5 years, all-time]
    system: [compound / organism / phenomenon]
    detail-level: [survey | mechanism | quantitative]
  deliverable: [citation list | narrative | experimental design | table]
  decomposition:
    - sub-question-1: [...]
    - sub-question-2: [...]   # optional
:::
```

## Examples

### Example 1 — fact

Operator: "What's the half-life of caffeine in human plasma?"

```
formulated:
  type: fact
  primary-domain: biology
  secondary-domains: [chemistry]   # ADME context
  scope:
    date-range: all-time + recent
    system: caffeine in human plasma (healthy adult)
    detail-level: quantitative
  deliverable: citation list with reported half-lives + sources
```

Dispatch: biology-researcher (primary), citation budget 3-5 papers.

### Example 2 — interpretive

Operator: "Why does CRISPR-Cas9 cleave at the +3 position relative to
the PAM?"

```
formulated:
  type: interpretive
  primary-domain: biology
  secondary-domains: [chemistry]   # mechanism is hydrolysis chemistry
  scope:
    date-range: structural era (2014+)
    system: SpCas9, NGG PAM
    detail-level: mechanism
  deliverable: mechanistic narrative with cited structural + biochem evidence
```

Dispatch: biology-researcher (primary), with anticipated handoff to
chemistry-researcher for the cleavage chemistry. Citation budget 8-10
papers.

### Example 3 — design

Operator: "Design an experiment to measure how a polymer's
persistence length changes near a glass transition."

```
formulated:
  type: design
  primary-domain: physics
  secondary-domains: [chemistry]   # polymer chemistry context
  scope:
    date-range: methods (any), characterisation (last 10y)
    system: a generic synthetic polymer near Tg
    detail-level: experimental design with controls + power
  deliverable: full experimental design (variables, controls, stats, confounds)
```

Dispatch: physics-researcher (primary), citation budget 6 papers.

### Example 4 — comparison

Operator: "Compare CRISPR-Cas9 vs Cas12a for editing AT-rich genomes."

```
formulated:
  type: comparison
  primary-domain: biology
  secondary-domains: [chemistry]   # PAM recognition chemistry
  scope:
    date-range: last 5 years
    system: AT-rich mammalian + plant genomes
    detail-level: comparison table
  deliverable: table of {PAM, cut style, off-target, efficiency, references}
```

Dispatch: biology-researcher (primary), citation budget 8 papers.

## Refusal conditions

- **Fabricated premise** — operator asks a question premised on a
  result that does not exist. Refuse, ask for the source.
- **IRB / biosafety / clinical / regulatory** — stop, escalate, do
  not formulate.
- **Out-of-scope domain** — math, CS, ML, social science. State the
  lab's scope and refuse to formulate.

## Source

Adapted from the PICO framework (clinical), the FINER criteria
(feasible, interesting, novel, ethical, relevant), and the
literature-triage rubric used by major systematic-review groups
(Cochrane, Campbell). Stripped down to what a fast turn around a
multi-domain corpus actually needs.
