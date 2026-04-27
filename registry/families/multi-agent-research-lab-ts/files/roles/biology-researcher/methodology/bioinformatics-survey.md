---
capability: bioinformatics-survey
role: biology-researcher
status: active
source: hand-authored
retrieved: 2026-04-26
---

# Bioinformatics Survey

## Purpose

Conduct a citation-grounded bioinformatics survey for a target
sequence, gene, pathway, or organism. The deliverable is a
`:::contribution` containing a `:::artifact template:
bioinformatics-survey` with sequence / annotation / phylogenetic /
expression / functional context, every value tagged with database
accession + retrieval date.

This methodology is for **survey of existing public-data
annotations** — UniProt, NCBI, Ensembl, EBI services, PubMed
literature. It is not de novo bioinformatics analysis (no actual
BLAST runs, no MSAs computed in this turn) — those are operator
follow-ups; the survey establishes what is known.

## Inputs

- Target identifier (UniProt accession / Ensembl gene ID / NCBI
  gene ID / sequence).
- Director's dispatch sub-question.
- Citation budget from triage.
- `carry-context` from any handoff.

## Step-by-step procedure

### Step 1 — resolve identifiers across databases

Map between common identifier spaces:

- **UniProt accession** ↔ **Ensembl gene ID** ↔ **NCBI Gene ID** ↔
  **HGNC symbol** (for human).
- Record the canonical accession + retrieval date in the artifact.

If the operator provided a free-text gene name (e.g. "p53"), resolve
it to the canonical accession (UniProt P04637 for human TP53) and
record both for trace.

### Step 2 — pull sequence + feature annotation

For protein:

- **UniProt** — sequence, signal peptide, transmembrane regions,
  domains (Pfam / InterPro), PTMs (phosphosites, glycosites),
  variants (canonical isoform vs others), GO terms (BP / CC / MF).

For nucleic acid / gene:

- **Ensembl** — exon / intron structure, regulatory features,
  promoters, known transcript isoforms, paralogues, orthologues.
- **NCBI** — RefSeq transcript / CDS, dbSNP variants if relevant.

### Step 3 — phylogeny / orthology

Where relevant:

- **OMA / OrthoDB / Ensembl Compara** — orthologues across model
  organisms.
- **InterPro** — protein-family conservation across taxa.
- Note where the protein / gene is conserved; note where it is
  lineage-specific.

The orthology context often surfaces the cross-domain handoff —
when the operator wants the reaction chemistry of a conserved
enzyme, you have biology + a chemistry handoff.

### Step 4 — expression + tissue context

Where relevant:

- **GTEx** (human tissue expression) — note tissues + relative
  expression.
- **Human Protein Atlas** — protein-level expression + cell-type
  context.
- **Bgee / Expression Atlas** — model-organism expression.

If the operator's question is human-disease-adjacent, this section
likely triggers `:::escalation` (clinical interpretation).

### Step 5 — functional / pathway context

- **Reactome** / **KEGG** — pathways the protein / gene participates
  in.
- **STRING** — known + predicted protein-protein interactions.
- **OMIM** (human disease association) — note that surfacing OMIM
  near a clinical question requires escalation.

### Step 6 — literature anchor

For the Director's specific sub-question, pull primary literature
via NCBI PubMed (for biology-primary work) + OpenAlex / Crossref
(for cross-domain corroboration). Citation budget is from triage.

### Step 7 — produce the artifact

```
:::artifact
template: bioinformatics-survey

Target:
  Name / common: [...]
  UniProt: [accession, retrieved <date>]
  Ensembl: [gene ID, retrieved <date>]
  NCBI Gene: [id, retrieved <date>]
  Organism: [species, TaxID]

Sequence / structure:
  Length: [aa or nt]
  Domains: [Pfam IDs + boundaries]
  PTMs: [list with positions + database citation]
  Variants of interest: [list with dbSNP / ClinVar where applicable]

Phylogeny / orthology:
  Conserved across: [taxa span]
  Lineage-specific features: [...]

Expression:
  Tissue distribution: [from GTEx / HPA, with retrieval date]

Pathways / interactions:
  Reactome: [pathway IDs]
  KEGG: [pathway IDs]
  Top STRING partners: [list with confidence scores]

Disease association:
  [if any] OMIM: [...] — flag for clinical escalation if operator
  question is clinical.

Cross-domain context:
  Chemistry: [if the function turns on enzyme mechanism / small-
    molecule recognition — handoff flag]
  Physics: [if conformational dynamics / FEL is load-bearing —
    handoff flag]

Citations:
  - [Surname, year] First A. et al. (year). Title. Journal. DOI.
  - UniProt: <accession>, retrieved <date>
  - Ensembl: <gene ID>, retrieved <date>
  - GTEx: <retrieval date>
  - Reactome: <pathway IDs>, retrieved <date>
:::
```

### Step 8 — emit handoffs

- **Enzyme mechanism / small-molecule recognition** → chemistry-
  researcher.
- **Conformational dynamics / FEL** → physics-researcher.
- **Drug pharmacology** → chemistry-researcher (med chem) +
  surface clinical escalation if dosing / patient context appears.

### Step 9 — wrap in contribution

```
:::contribution
from: biology-researcher
in-response-to: [dispatch or handoff source]

finding: [paragraph narrative — every claim
[citation: <surname year>]; database values include accession +
retrieval date]

handoffs: [list]

corpus-coverage: [high / medium / low]

citations: [full list]
:::
```

## Sanity checks

- Every numeric value has a database citation with retrieval date.
- Every functional claim has a primary-literature citation.
- Disease-association mentions trigger escalation evaluation.
- Cross-domain triggers fire handoffs; the survey does not absorb
  chemistry / physics silently.
- No claim is from training memory.

## Anti-patterns

- **Treating UniProt feature flags as primary evidence.** Feature
  flags reference papers; cite the paper.
- **Ignoring isoform context.** A claim that holds for the
  canonical isoform may not hold for tissue-specific isoforms;
  name the isoform.
- **Citing OMIM in clinical context without escalation.** OMIM is
  not clinical advice; surfacing it near a patient question is a
  trigger to escalate, not to interpret.
- **Silent expression interpretation.** "Highly expressed in
  tissue X" without the GTEx / HPA citation is a hand-wave.

## Source

Adapted from the UniProt / Ensembl / NCBI / Reactome / KEGG / GTEx
/ HPA documentation, the InterMine federated-query conventions,
and the bioinformatics community's data-citation guidance (Cousijn
et al. 2018, *Data Citation* roadmap).
