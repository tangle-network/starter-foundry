---
capability: literature-search
status: active
source: hand-authored, aligned with PubMed/MeSH conventions and Cochrane search guidance
retrieved: 2026-04-26
---

# Literature Search methodology

A literature search produces a `:::survey` block containing cited
sources that answer the user's question. Surveys feed downstream
analysis (proposals, hypotheses, methods); they are not exhaustive
systematic reviews.

## When to use

Trigger this template when the user asks:

- "What's the current evidence for X?"
- "What is known about gene/protein/pathway Y?"
- "Are there recent reviews on Z?"
- "Who has worked on this organism / disease / pathway?"

If the user is asking for original synthesis or hypothesis generation,
chain through `experimental-design.md` after the survey. If the user
needs PRISMA-style systematic review, see "Scope limits" below.

## Method

1. **Decompose the question into MeSH-style terms.** Even when not
   querying PubMed directly, the discipline of mapping "fatty liver in
   diabetic mice" → `Fatty Liver/etiology`, `Diabetes Mellitus,
   Experimental`, `Mice` forces specificity.
2. **Pick the right corpus.**
   - PubMed/Entrez for biomedical primary literature
   - bioRxiv/medRxiv (via Crossref) for preprints — flag the preprint
     status explicitly
   - OpenAlex / Semantic Scholar for citation graphs and recent reviews
   - Specialty databases when relevant: GenBank, UniProt, RCSB PDB,
     Ensembl, EMBL-EBI, NCBI Gene, OMIM
3. **Build the query incrementally.** Start broad, narrow with Boolean
   operators (`AND`, `OR`, `NOT`) and field tags (`[Title/Abstract]`,
   `[MeSH Terms]`, `[Author]`, `[Journal]`, `[Publication Type]`).
4. **Filter for evidence quality.** Prefer in this order: systematic
   review or meta-analysis → primary research published in peer-reviewed
   venue → preprint with high replication signal → conference proceedings
   → grey literature. Mark each tier in the survey.
5. **Capture per-source.** Title, first-author, venue, year, study type
   (review / RCT / cohort / case-report / preclinical / in-vitro / in-silico),
   one-line contribution, one-line relevance to the user's question, DOI
   or PMID.
6. **Synthesize.** A 2–4 sentence summary naming where the literature
   converges and where it remains contested or thin.

## Output shape

Wrap the survey in a `:::survey` block:

```
:::survey
template: literature-search
query-date: <YYYY-MM-DD>
corpora: [pubmed, semantic-scholar, openalex]

[surname, year]: <one-line contribution> [PMID:XXXX | DOI:10.xxxx]
[surname, year]: ...

Synthesis: ...
:::
```

## Citation discipline

Every claim of fact ships with a citation. If you cannot cite a claim,
soften it to a hypothesis or omit it. Refuse to fabricate citations,
PMIDs, DOIs, or author names — escalate to a human reviewer if pressed.

## Common search-quality failures

1. **MeSH-blind search.** Querying free-text only misses terms indexed
   under different headings ("heart attack" vs `Myocardial Infarction
   [MeSH]`). Use MeSH for biomedical PubMed.
2. **Date-window omitted.** "Recent" is meaningless without a window.
   Default to last 5 years for fast-moving fields, last 10 for stable
   ones; widen explicitly when the user signals historical interest.
3. **Single-database tunnel.** Biology questions often have answers in
   adjacent silos (PubMed for human, Web of Science for ecology, GBIF
   for biodiversity). Hit at least two corpora when the question is not
   strictly biomedical.
4. **Preprint label dropped.** Preprints are valid evidence but must be
   tagged as such in the output — never present a preprint as
   peer-reviewed.
5. **Reviews-of-reviews loop.** When every cited source is itself a
   review, you have given the user secondary evidence only. Trace at
   least one primary study per major claim.

## Scope limits

This template covers literature surveys. For PRISMA systematic reviews,
the user must additionally specify: inclusion/exclusion criteria, search
strings (every database, every date), screening protocol (typically two
independent reviewers + adjudication), risk-of-bias tool (RoB 2,
ROBINS-I, NIH NHLBI), and pre-registered protocol (PROSPERO). Surveys
do not satisfy any of these — be explicit when the user asks for
"systematic review" but only has time for a survey.
