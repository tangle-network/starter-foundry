---
capability: protein-structure-analysis
role: biology-researcher
status: active
source: hand-authored
retrieved: 2026-04-26
---

# Protein Structure Analysis

## Purpose

Given a protein (by name, UniProt accession, or PDB ID), produce a
citation-grounded structural narrative the Director can synthesize.
The deliverable is a `:::contribution` containing a
`:::artifact template: protein-structure-analysis` with structural
features, functional implications, and any conformational /
mechanism context.

This methodology is for **structural analysis from the public
record** — UniProt + PDB + the deposition / follow-up literature.
It is not de novo structure prediction (no AlphaFold inference) and
not clinical interpretation.

## Inputs

- Target protein identifier (UniProt accession preferred, name +
  organism otherwise).
- Director's dispatch sub-question (e.g. "what's the structural
  context for the cleavage-active state of SpCas9").
- Citation budget from triage.
- Any `carry-context` from a handoff (especially common from
  chemistry asking about a substrate-bound complex).

## Step-by-step procedure

### Step 1 — resolve the identifier

Use UniProt to resolve any name/organism pair to a canonical
accession. Record:

- **UniProt accession** (e.g. Q99ZW2 for SpCas9).
- **Organism** (TaxID).
- **Length, MW, isoforms**.
- **Functional annotations** (EC number, GO terms, Pfam / InterPro
  domains).

### Step 2 — pull all PDB entries

Query the PDB / RCSB for all structures of the protein:

- Filter by resolution (≤ 3.0 Å for atomic-detail mechanism work;
  cryo-EM with reported map resolution acceptable).
- Note ligand-bound vs apo, mutant vs WT, partner-bound vs
  monomeric.
- Note crystallisation conditions (pH, ionic, additives) — sometimes
  the most useful caveat is "this structure is in 0.5 M ammonium
  sulfate, far from physiological".

For each PDB entry of interest:

- **PDB ID** + retrieval date.
- **Resolution** (and method: X-ray / cryo-EM / NMR).
- **Deposition / publication paper** (DOI).
- **B-factor caveats** — flag any region with B > 40 Å² (i.e. the
  structure may be ambiguous in the part the question turns on).
- **Conformational state** (e.g. "open" / "closed" / "active") —
  source the assignment from the deposition paper, not from the
  PDB title.

### Step 3 — assemble the structural narrative

For the Director's question, produce:

- **Domain architecture** — which domains, in which order along the
  sequence, with start-end residue numbers (UniProt numbering).
- **Active site / functional residues** — UniProt feature table +
  primary literature citation for the assignment.
- **Conformational landscape** — what states are observed in the
  PDB (active, inactive, partner-bound, etc.), with one citation
  per state.
- **Disagreement in the literature** — whenever two PDB entries +
  papers disagree on which state is "physiological", name the
  disagreement.

### Step 4 — produce the artifact

```
:::artifact
template: protein-structure-analysis

Protein:
  Name: [common name]
  UniProt: [accession, retrieved <date>]
  Organism: [organism, TaxID]
  Length / MW: [residues, kDa]

Domains (UniProt + InterPro):
  - [Domain 1]: residues N-M [Pfam ID]
  - [Domain 2]: ...

Active site / key residues:
  - [residue N, function] [citation: <surname year>]

Structural states observed in the PDB:
  | State | PDB | Resolution | Method | Ligand / partner | B-factor flag | Source paper |
  |-------|-----|------------|--------|------------------|---------------|--------------|
  | active | 8XYZ | 2.4 Å | X-ray | substrate | active-site Bs <30 | [Author year, DOI] |
  | inactive | 7ABC | 3.1 Å | cryo-EM | apo | hinge B>40 | [Author year, DOI] |

Conformational disagreement (if any):
  - [name the disagreement and the empirical crux]

Cross-domain context:
  - Chemistry: [if the active-site mechanism is owned by chemistry —
    handoff flag]
  - Physics: [if the conformational dynamics depend on a free-energy
    landscape / MD simulation — handoff flag]

Citations:
  [Author, year] First A. et al. (year). Title. Journal vol pp. DOI.
  PDB: <id>, retrieved <date>
  UniProt: <accession>, retrieved <date>
:::
```

### Step 5 — emit handoffs

- **Active-site mechanism / cleavage chemistry** → handoff to
  chemistry-researcher.
- **Conformational dynamics / free-energy landscape** → handoff to
  physics-researcher.
- **Drug bound at the active site, drug-design context** → handoff
  to chemistry-researcher (medicinal chemistry).
- **B-factor or resolution caveat** that materially affects the
  Director's answer → name it; ask the Director whether to commission
  a parallel structure-prediction inquiry if needed.

### Step 6 — wrap in contribution

```
:::contribution
from: biology-researcher
in-response-to: [dispatch or handoff source]

finding: [paragraph narrative — name the canonical state,
the alternatives, the disagreement (if any), every claim
[citation: <surname year>]]

handoffs: [list]

corpus-coverage: [high / medium / low]

citations: [full list with database accessions + retrieval dates]
:::
```

## Sanity checks

- Every functional claim has a primary-literature citation, not
  just a UniProt feature-table entry.
- Every PDB entry has its deposition / follow-up paper cited.
- B-factor caveats are surfaced where they would change the answer.
- Cross-domain mechanism / dynamics triggers a handoff.
- No claim is from training memory.

## Anti-patterns

- **Citing PDB without the paper.** A PDB entry is a deposit; the
  paper is the interpretation. Both go in citations.
- **Ignoring B-factor caveats.** A 4.0 Å cryo-EM density and a 2.0 Å
  X-ray of the same complex are not equivalent evidence.
- **Treating "active state" labels as authoritative.** PDB titles
  reflect deposition annotation, not consensus. The deposition paper
  + follow-ups own the assignment.
- **Silent dynamics swallow.** Reporting a static structure as "the
  state of the protein" without flagging dynamics literature.
  Conformational landscapes are physics's territory; hand off.

## Source

Adapted from UniProt + RCSB PDB documentation, the
structural-biology critique norms (Read et al. 2011 on the Quality
of Crystal Structures), and the cross-domain handoff conventions in
Cell Chemical Biology editorial guidance.
