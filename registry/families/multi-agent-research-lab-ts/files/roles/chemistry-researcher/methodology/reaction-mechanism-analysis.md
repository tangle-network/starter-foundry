---
capability: reaction-mechanism-analysis
role: chemistry-researcher
status: active
source: hand-authored
retrieved: 2026-04-26
---

# Reaction Mechanism Analysis

## Purpose

Given a target reaction (or transformation), produce a citation-
grounded mechanistic narrative the Director can synthesize. The
deliverable is a `:::contribution` containing a `:::artifact
template: reaction-mechanism-analysis` with the proposed mechanism,
its evidence, and any contradictions in the literature.

This methodology is for **mechanism analysis from published
literature** — not de novo proposal of a route the literature does
not support, and **never** experimental safety guidance.

## Inputs

- Target reaction or transformation (substrates, conditions if
  known, expected product if known).
- Director's dispatch sub-question (e.g. "what mechanism is proposed
  for X cleavage in conditions Y").
- Citation budget from triage.
- Any `carry-context` from a handoff (especially common from biology
  asking about an enzyme or drug-action mechanism).

## Step-by-step procedure

### Step 1 — frame the mechanistic question precisely

Distinguish:

- **Elementary step** (single bond making / breaking) vs **overall
  mechanism** (multi-step pathway).
- **Stoichiometric** vs **catalytic** (different evidence shapes).
- **Concerted** vs **stepwise** (look for kinetic isotope effect,
  Hammett, intermediates).
- **In vitro** (organic flask) vs **in vivo / enzyme-catalysed** (if
  the latter, you are likely going to hand off to biology-researcher
  for the structural context).

### Step 2 — pull the primary mechanism literature

Use `crossref-literature-search` (sister methodology) with:

- The IUPAC / common name of substrate + product.
- Mechanism keywords: "mechanism", "kinetics", "isotope effect",
  "intermediate", "transition state", "DFT" (signal for handoff to
  physics).
- Restrict to peer-reviewed primary literature (not reviews) for the
  mechanism claim itself; pull one or two recent reviews for
  context.

For published, well-studied reactions, hit:

- **JACS** (J. Am. Chem. Soc.) — primary mechanism papers.
- **Nature Chemistry**, **Science** — high-impact mechanism /
  catalysis.
- **Chem. Sci.**, **Angew. Chem.** — corroborating primary.
- **Chem. Rev.**, **Chem. Soc. Rev.** — review for breadth, never as
  the citation for a specific claim.

### Step 3 — extract the mechanistic evidence

For each primary paper, extract:

- **Proposed mechanism** (in arrow-pushing or step list form).
- **Evidence supporting it**:
  - Kinetic data (rate law, KIE).
  - Isotope labeling.
  - Trapped or detected intermediates (UV-Vis, NMR, MS, EPR, IR).
  - Computational (DFT, ab initio) — **flag for handoff to
    physics-researcher** for methods provenance.
  - Crystallography (substrate-bound or transition-state analog) —
    **flag for handoff to biology-researcher** if the crystal is of
    a protein-substrate complex.
- **Caveats / known disagreements** — the field-internal
  disagreement is the single most useful signal for the Director's
  contradiction-resolution step.

### Step 4 — produce the artifact

```
:::artifact
template: reaction-mechanism-analysis

Reaction:
  Substrate(s): [structure / SMILES / common name]
  Product(s): [...]
  Conditions cited: [solvent, T, catalyst, additives]

Proposed mechanism (consensus / dominant view):
  Step 1: [arrow-pushing or word description]
    Evidence: [KIE = X, intermediate Y observed by NMR — Z et al. year]
  Step 2: [...]
    Evidence: [...]
  ...

Alternative mechanism(s) (if the literature is split):
  - [name the alternative]
    Evidence cited: [...]
    Disagreement crux: [what experiment would distinguish]

Computational evidence (if any):
  Method: [DFT functional / basis or ab initio level]
  Source: [arxiv / J Chem Phys / J Chem Theory Comput]
  Flag: handoff to physics-researcher for methods-provenance check.

Structural / biological evidence (if any):
  Source: [PDB ID / Nature / Cell paper]
  Flag: handoff to biology-researcher for structural context.

Confidence in the consensus mechanism:
  high / medium / low — [why]

Citations:
  [Surname, year] Author A. et al. (year). Title. Journal vol pp. DOI.
:::
```

### Step 5 — emit handoffs

- **DFT / ab initio in evidence** → handoff to physics-researcher to
  validate the methods (functional choice, basis set, known
  systematic biases for the bond / state in question).
- **Crystal structure of protein-substrate** → handoff to biology-
  researcher for the structural-biology context (alternative
  conformations, B-factor caveats, the structural era's known
  caveats).
- **Mechanism in vivo** → handoff to biology-researcher for
  cellular context (compartmentalisation, cofactors, off-target).

### Step 6 — wrap in contribution

```
:::contribution
from: chemistry-researcher
in-response-to: [dispatch or handoff source]

finding: [paragraph narrative — name the consensus, name the
dissent, explicitly tag every claim [citation: <surname year>]]

handoffs: [list]

citations: [full list, primary literature first, reviews flagged]
:::
```

## Sanity checks

- Every mechanism claim has a primary-literature citation (not a
  review) where possible.
- Every alternative mechanism is named with its empirical crux.
- DFT / computational evidence triggered a physics handoff.
- Protein-substrate evidence triggered a biology handoff.
- No claim is from training memory.

## Anti-patterns

- **Textbook mechanism without primary citation.** "SN2 with
  inversion" might be true but needs the specific paper.
- **Smoothing field disagreements.** If the literature is split
  between concerted and stepwise, the contribution must show the
  split — that is exactly what the Director's synthesis needs.
- **Absorbing computational evidence silently.** DFT calculations
  carry method-dependent error; physics-researcher's handoff
  catches functional-choice bias.

## Source

Adapted from Anslyn & Dougherty *Modern Physical Organic Chemistry*
(mechanism analysis frameworks), Lowry & Richardson *Mechanism and
Theory in Organic Chemistry*, and the IUPAC recommendations for
reporting mechanistic evidence (Pure Appl. Chem. 2014).
