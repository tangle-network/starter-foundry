---
capability: crossref-literature-search
role: chemistry-researcher
status: active
source: hand-authored
retrieved: 2026-04-26
---

# Crossref Literature Search

## Purpose

Run a citation-grounded chemistry literature search using **Crossref
(primary)** for DOI-linked metadata, **OpenAlex** for citation graph
+ corroboration, and **PubChem / ChemSpider** for compound data.
Used when the Lab Director dispatches a chemistry question and when
physics or biology hand off into chemistry territory.

The Crossref API is the workhorse for chemistry because most
chemistry primary literature lives behind ACS / RSC / Wiley / Elsevier
paywalls — the Crossref DOI metadata is the universal handle.

## Inputs

- The dispatched / handed-off sub-question.
- Citation budget from the Director's triage.
- `carry-context` from any handoff.

## Step-by-step procedure

### Step 1 — pick the corpus order

| Question | Corpus order |
|---|---|
| Compound property (mp, bp, logP, pKa, spectra) | PubChem → ChemSpider → Crossref (for the underlying primary) |
| Reaction / mechanism | Crossref (JACS, Angew, Chem Sci, Nat Chem) → OpenAlex citation graph |
| Catalysis / new methodology | Crossref → OpenAlex (recent + highly cited) |
| Spectroscopic assignment | PubChem (spectra) → Crossref (primary report) |
| Drug / biologically-active compound | PubChem (incl. biological assay data) → Crossref → flag for handoff to biology |

### Step 2 — query construction

For Crossref, use the works endpoint with:

- `query.title` — title-restricted search.
- `query.bibliographic` — title + abstract.
- `query.author` — when the operator named an author / group.
- Filters: `from-pub-date`, `until-pub-date`, `container-title`
  (specific journal), `type:journal-article`.

Example: mechanism of photoredox single-electron transfer in
organic halide reduction:

```
Crossref:
  query.bibliographic: "photoredox single electron transfer organic halide"
  filter: container-title=J. Am. Chem. Soc. OR Nat. Chem. OR Chem. Sci.,
          from-pub-date=2018-01-01, type=journal-article
  rows: [from triage budget]
  sort: relevance
```

### Step 3 — corroborate via OpenAlex citation graph

Take each Crossref hit by DOI; query OpenAlex for:

- Citation count + per-year trend.
- Cited-by works (papers citing this one — useful for identifying
  the corroborating + dissenting literature).
- References (the paper's own bibliography — useful for tracing the
  mechanism back to its origin).
- Author affiliations (signals chemistry-only vs cross-domain).

### Step 4 — for compound data, hit PubChem / ChemSpider

If the question is property-driven:

- **PubChem** by CID (preferred), or by name / SMILES / InChI.
- Extract: molecular formula, MW, logP (XLogP3), pKa, mp, bp,
  density, solubility, spectral data (NMR / IR / MS where reported),
  hazard / GHS classifications, biological assay data (and **flag
  for biology handoff** if the assay data is the operator's actual
  interest).
- **ChemSpider** for cross-validation; flag any disagreement > 5%
  on a numeric property between sources.

### Step 5 — assemble the survey

```
:::survey
template: crossref-literature-search
query: [the search you ran, in human-readable form]
corpora-hit: [list]
budget-used: [n papers, n compound records]

| # | Title / Compound | Authors | Year | Source | Citations | Cross-domain signal |
|---|------------------|---------|------|--------|-----------|---------------------|
| 1 | ... | ... | 2024 | JACS | 47 | none |
| 2 | ... | ... | 2023 | Cell Chem Biol | 12 | bio co-authors — flag |

**Synthesis (chemistry view)**: 2-3 sentences naming the consensus,
the dissent if any, and the gap.

**Compound data (if applicable)**:
| Property | Value | Source | Retrieved |
|---|---|---|---|
| MW | ... | PubChem CID 1234 | 2026-04-26 |
| logP | ... | PubChem (XLogP3) | 2026-04-26 |

**Full citations**:
- [Surname, year] Author A. et al. (year). Title. Journal vol pp. DOI.
:::
```

### Step 6 — emit handoffs if triggered

For each row tagged "cross-domain signal — flag", emit a `:::handoff`
inside the contribution:

- DFT or computational methods → physics-researcher.
- Protein structure / in vivo / drug pharmacology → biology-
  researcher.

### Step 7 — wrap in contribution + return

```
:::contribution
from: chemistry-researcher
in-response-to: [dispatch or handoff source]

finding: [paragraph narrative; every claim tagged
[citation: <surname year>]; PubChem / ChemSpider citations include
CID + retrieval date]

handoffs: [list]

corpus-coverage: [high / medium / low]

citations: [full list]
:::
```

## Sanity checks

- Every numeric compound property has a database citation with
  retrieval date.
- Every mechanism claim has a primary-literature DOI citation, not
  a textbook attribution.
- Every cross-domain signal in the survey has a matching `:::handoff`.
- No claim is from training memory.

## Anti-patterns

- **PubChem-only on a mechanism question.** PubChem has compound
  data; mechanism lives in primary literature. Use Crossref.
- **Citing the review.** A review's citation is the original; trace
  it. Use the review for breadth, not for the load-bearing claim.
- **Silent disagreement between PubChem and ChemSpider.** Numeric
  disagreements are signal — flag them, do not pick the prettier
  number.

## Source

Adapted from Crossref API docs (api.crossref.org), OpenAlex API
ranking heuristics, and the cheminformatics community's PubChem
citation conventions (Kim et al., Nucleic Acids Res. — PubChem
papers, plus PubChem's own data citation guidance).
