---
capability: literature-triage
role: lab-director
status: active
source: hand-authored
retrieved: 2026-04-26
---

# Literature Triage

## Purpose

Estimate, before dispatching, how much corpus retrieval the question
needs and which corpora the primary role should hit first. Without
triage, the Director either over-budgets (the role pulls 30 papers
to answer a fact question) or under-budgets (the role runs out of
citations halfway through an interpretive synthesis).

Triage runs **after** `research-question-formulation` and **before**
`:::dispatch`.

## Inputs

- The formulated research question (from
  `research-question-formulation`).
- The role's known corpus access:
  - **physics-researcher** — arxiv, OpenAlex, Crossref.
  - **chemistry-researcher** — Crossref, OpenAlex, PubChem,
    ChemSpider, RSC, ACS journals.
  - **biology-researcher** — UniProt, PDB, NCBI / PubMed, OpenAlex,
    Crossref.

## Citation-budget rule of thumb

| Question type | Citation budget | Rationale |
|---|---|---|
| **Fact** | 1-3 | One authoritative source + one or two corroborating cites. Over-pulling on a fact question is a tell that the role is hedging. |
| **Interpretive (mechanism)** | 6-10 | The mechanism narrative needs the original proposal, two corroborations, two recent updates, and any contradicting evidence. |
| **Design (experimental)** | 4-6 | The methods literature is shallower than the mechanism literature; over-pulling produces methodology bloat. |
| **Comparison** | 8-12 | One or two cites per option per dimension. Comparisons under-cited tend to lean on one role's bias. |

If the question crosses domains (signalled in formulation's
`secondary-domains`), add a 30% budget premium and pre-warn the
primary role that a `:::handoff` is likely.

## Corpus-priority rule

| Question type | Corpus priority |
|---|---|
| **Fact (compound property)** | PubChem → ChemSpider → RSC/ACS → Crossref |
| **Fact (protein / sequence)** | UniProt → PDB → NCBI → OpenAlex |
| **Fact (theoretical / formula)** | arxiv (latest review) → OpenAlex |
| **Interpretive (any)** | Top-tier primary journals (Nature/Science/Cell/JACS/PRL) → preprints → reviews |
| **Design** | Methods journals (Nature Protocols, Methods, JoVE) → primary literature for prior art |
| **Comparison** | Recent reviews (≤3y) → primary literature for each option |

The primary role chooses within its domain; the Director's job is
to flag the priority shape so the role does not start with the
wrong corpus.

## Triage output

Emit (internally) a `:::artifact` block tagged
`template: literature-triage`:

```
:::artifact
template: literature-triage
formulated-question-ref: [hash or summary of the formulation]

triage:
  primary-role: [role-id]
  citation-budget: [n papers]
  cross-domain-premium: [yes/no — and why]
  corpus-priority:
    1. [first corpus to hit]
    2. [second]
    3. [third]
  expected-handoffs:
    - [role-id]: [reason it's likely]
  red-flags:
    - [signal that means stop, escalate, or refuse]
```

## Examples

### Triage A — fact question (caffeine half-life)

```
triage:
  primary-role: biology-researcher
  citation-budget: 3 papers
  cross-domain-premium: no
  corpus-priority:
    1. PubMed (clinical pharmacokinetics)
    2. OpenAlex (corroboration)
  expected-handoffs:
    - chemistry-researcher: only if operator follows up on metabolism
  red-flags:
    - operator asks for personalised half-life → clinical, escalate
```

### Triage B — interpretive cross-domain (CRISPR cleavage chemistry)

```
triage:
  primary-role: biology-researcher
  citation-budget: 10 papers (8 + 30% cross-domain premium = 10.4)
  cross-domain-premium: yes — mechanism crosses biology / chemistry
  corpus-priority:
    1. PDB (structural era)
    2. Cell / Nature / Mol Cell (primary structural biology)
    3. JACS (cleavage chemistry corroboration via expected handoff)
  expected-handoffs:
    - chemistry-researcher: mechanism of phosphodiester hydrolysis
  red-flags:
    - operator asks about clinical trials → escalate (medical)
```

### Triage C — design question (polymer persistence length near Tg)

```
triage:
  primary-role: physics-researcher
  citation-budget: 6 papers
  cross-domain-premium: no
  corpus-priority:
    1. arxiv (recent reviews on polymer dynamics near Tg)
    2. PRL / Macromolecules (primary)
    3. Nature Protocols (characterisation methods)
  expected-handoffs:
    - chemistry-researcher: only if operator names a specific polymer
      whose chemistry matters for the choice of probe
  red-flags:
    - none typical
```

## Refusal / escalation triggers in triage

If triage surfaces ANY of these, stop — do not dispatch, escalate:

- The question turns on a clinical decision (diagnosis, treatment,
  dosing).
- The question requires unpublished or proprietary data the lab
  does not have access to.
- The question would require operating in a regulatory class (FDA
  IND, EMA, ITAR / EAR).
- The question is implicitly asking the lab to make a decision the
  operator is professionally accountable for (peer review,
  reviewer-2 rebuttal).

## Source

Adapted from the systematic-review search-strategy literature
(Cochrane Handbook ch. 4, McGowan et al. 2016 PRESS) and from
practical corpus-triage rules used by the OpenAlex and Semantic
Scholar teams when designing search defaults. Calibrated for a
multi-role agent budget where retrieval cost is per-role per-corpus.
