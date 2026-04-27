---
capability: literature-search
status: active
source: hand-authored, aligned with arXiv submission norms and APS / PRL conventions
retrieved: 2026-04-26
---

# Literature Search methodology (physics)

A literature search produces a `:::survey` block grounded in real
papers retrieved via the research-corpus tools (arXiv, Semantic Scholar,
OpenAlex, Crossref, INSPIRE-HEP for high-energy physics). Surveys are
the input to citation analysis, experimental design, and theoretical
position-taking — never the final deliverable.

## When to use

Trigger this template when the user asks:

- "What's the state of the art on <topic>?"
- "What experimental constraints exist on <observable>?"
- "Find recent work on <method/regime/system>."
- "Has anyone reproduced <result>?"
- "What does the latest measurement say about <parameter>?"

## Method

1. **Clarify the regime.** Physics splits sharply across regimes:
   classical / quantum, non-relativistic / relativistic, equilibrium /
   non-equilibrium, weak / strong coupling, vacuum / condensed-matter.
   The right corpus depends on the regime — INSPIRE-HEP for HEP and
   astro-particle, arXiv `cond-mat` for condensed matter, ADS for
   astronomy, etc.
2. **Decompose the query into theory + system + observable + method.**
   "Decoherence in NV centers measured via Ramsey" already names all
   four; vague queries usually omit one. Ask before searching.
3. **Pick corpora by regime.**
   - Theory & broad physics: arXiv (`hep-th`, `quant-ph`, `cond-mat`,
     `gr-qc`, `astro-ph`, `nucl-th`)
   - HEP experiment, citation tracking: INSPIRE-HEP via OpenAlex
   - Astronomy: ADS (NASA ADS) via Semantic Scholar bridge
   - Cross-discipline / impact factors: Semantic Scholar, OpenAlex
   - Last-resort or proceedings: Crossref
4. **Build the query** — Boolean (`AND`, `OR`, `NOT`), arXiv category
   filter (`cat:hep-th`), date range. Prefer canonical author names
   when known (`Witten, E.` not `E. Witten`).
5. **Filter for evidence quality and primary vs secondary.**
   - Peer-reviewed (PRL, PRD, PRX, Nature Physics, JHEP) > arXiv
     preprint > proceedings
   - Recent measurement / first-principles calc > review > textbook
   - Mark each tier in the output
6. **Capture per-source.** Title, first author, venue, year,
   theory/experiment/review tag, one-line contribution, one-line
   relevance to the user's question, arXiv ID + DOI.
7. **Synthesize.** A 2–4 sentence summary naming where the field
   converges, where it remains contested, and what the next decisive
   measurement / calculation would be.

## Output shape

```
:::survey
template: literature-search
query: "<original user query>"
query-date: <YYYY-MM-DD>
corpora: [arxiv, openalex, inspire-hep]
regime: { kind: "experiment", energy-scale: "TeV", system: "p-p collisions" }

[surname, year]: <one-line contribution> [arXiv:XXXX.YYYYY | DOI:10.xxxx]
[surname, year]: ...

Synthesis: ...

Open questions: ...
:::
```

## Citation discipline

Every claim of fact ships with a citation. Refuse to fabricate arXiv
IDs, DOIs, author names, or measurement values. If the search returns
nothing, say so; do not pad the survey with hallucinated entries.

When the user asks for "the latest measurement of <parameter>," return
the most recent published value with full uncertainty (statistical +
systematic) and the experiment that measured it. PDG (Particle Data
Group) is the canonical compilation for particle properties — cite the
edition.

## Common search-quality failures

1. **arXiv-only tunnel.** arXiv is preprint-heavy and skews toward
   theory/HEP. For applied/condensed-matter measurement work, hit
   OpenAlex and the journal directly.
2. **Date-window omitted.** Physics has slow-moving foundations (no
   need to limit on textbook QED) and fast-moving experiments (Higgs,
   gravitational-wave constraints update yearly). Specify the window.
3. **Treating preprints as published.** arXiv submissions are
   pre-publication. Always tag `arXiv-preprint` vs `published` in the
   survey; some preprints never pass peer review.
4. **Author-name ambiguity.** Common surnames (`Smith`, `Wang`,
   `Zhang`) require disambiguation by ORCID, institution, or initials.
5. **Missing PDG.** For particle masses, lifetimes, mixing angles —
   start at the PDG, not arXiv.

## Scope limits

This template is a literature survey, not a meta-analysis. For a
quantitative meta-analysis (combining measurements with proper error
propagation), additionally specify: combination method (weighted
average, BLUE, profile likelihood), correlated-uncertainty model, and
external-error scaling. PDG documents its method explicitly — copy that
discipline for any new compilation.
