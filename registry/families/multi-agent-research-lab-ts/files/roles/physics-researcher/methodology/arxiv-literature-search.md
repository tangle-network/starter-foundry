---
capability: arxiv-literature-search
role: physics-researcher
status: active
source: hand-authored
retrieved: 2026-04-26
---

# arXiv Literature Search

## Purpose

Pull a citation-grounded answer to a physics-primary question from
arxiv (primary), OpenAlex (corroboration / citation graph), and
Crossref (DOI metadata). Used by the Physics Researcher when the Lab
Director dispatches a physics question and when chemistry / biology
hand off a physics primitive.

## Inputs

- The dispatched / handed-off sub-question (precisely formulated).
- The Director's `:::artifact template: literature-triage`,
  including citation budget and corpus priority.
- Any `carry-context` from a handoff (what the originating role
  already knows, what it explicitly wants you to verify).

## Step-by-step procedure

### Step 1 — translate to arxiv search syntax

Convert the formulated question into arxiv field-scoped search:

- Prefix `ti:` for title terms.
- Prefix `abs:` for abstract terms.
- Prefix `cat:` for arxiv category (e.g. `cat:cond-mat.soft` for soft
  matter, `cat:physics.bio-ph` for biophysics, `cat:quant-ph` for
  quantum, `cat:hep-th` for high-energy theory).
- Combine with Boolean `AND`, `OR`, `ANDNOT`.

Example for "free-energy landscape of polymer near Tg":

```
arxiv: cat:cond-mat.soft AND
       (abs:"free energy landscape" OR abs:"FEL") AND
       (abs:"glass transition" OR abs:"polymer Tg")
```

### Step 2 — execute via research-corpus tool

Call the `corpus.arxiv(query)` tool with the constructed query. Apply
the citation budget from triage as `limit`. Sort by `submittedDate`
descending if the question is "what's the current state of the
art", by `relevance` if the question is interpretive.

### Step 3 — corroborate via OpenAlex citation graph

For each promising arxiv result, query OpenAlex by DOI (if assigned)
or title to get:

- Citation count + recent-citation trend.
- Co-citation neighbours (papers frequently cited alongside it).
- Author affiliations (this is where cross-domain handoff trigger
  fires — a co-author with a chem / bio appointment is signal).

### Step 4 — verify via Crossref

For peer-reviewed publication, hit Crossref by DOI to confirm:

- Journal (signal for tier — PRL / PRB / PRX / Nature Physics / etc.).
- Publication date (preprint vs published differential).
- Funding statement (sometimes flags a domain crossing — DOE /
  DARPA vs NIH / NSF DBI).

### Step 5 — assemble the survey

Build a `:::survey` block inside your `:::contribution`:

```
:::survey
template: arxiv-literature-search
query: [the search you ran, in human-readable form]
budget-used: [n papers]

| # | Title | Authors | Year | Source | Citations | Cross-domain signal |
|---|-------|---------|------|--------|-----------|---------------------|
| 1 | ... | ... | 2024 | arxiv (PRL) | 47 | none |
| 2 | ... | ... | 2023 | arxiv (J Chem Phys) | 12 | chem co-author — flag |

**Synthesis (physics view)**: 2-3 sentences naming the consensus,
the dissenting view if any, and the gap.

**Full citations**:
- [Surname, year] First A. et al. (year). Title. Journal vol pp. DOI.
:::
```

### Step 6 — emit handoffs if triggered

For each row tagged "cross-domain signal — flag", emit a `:::handoff`
inside the same contribution. Do not roll cross-domain context into
the physics survey — the Director needs a separate trail to route.

### Step 7 — wrap in contribution + return

```
:::contribution
from: physics-researcher
in-response-to: [dispatch or handoff source]

finding: [1-3 paragraph narrative answer, every claim tagged
[citation: <surname year>]]

handoffs: [list of any :::handoff blocks emitted, by target role]

corpus-coverage: [how confident you are the corpus is exhausted at
this budget — high / medium / low; if low, name what cite would
push to medium]

citations: [full list]
:::
```

## Sanity checks before emitting

- Every claim in `finding` has `[citation: <surname year>]`.
- No citation appears in `finding` that is not in the survey table.
- No claim in `finding` was carried over from training memory — every
  fact came from a tool call.
- Every cross-domain trigger surfaced in step 5 has a matching
  `:::handoff`.
- Corpus coverage is named, not implied.

## Anti-patterns

- **Search-string voodoo.** A query so over-engineered it returns
  one paper and skips the consensus. Iterate the query, not the
  filter.
- **Citation laundering.** Citing a review that cites the original
  rather than the original. Cite the original; the review is for
  the operator's deeper read.
- **Silent handoff swallow.** Realising mid-survey that the answer
  needs chemistry but pushing through with a hedged physics
  contribution. Stop, hand off, finish your part.

## Source

Adapted from arxiv search-syntax docs (export.arxiv.org/help/api),
the OpenAlex API ranking heuristics, and the citation-discipline
section of the systematic-review literature (PRISMA, Cochrane).
