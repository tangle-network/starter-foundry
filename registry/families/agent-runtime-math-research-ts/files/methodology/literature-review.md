# Literature Review Template (math)

## Purpose
Systematically search and summarize mathematical literature on a
specific topic — find the canonical references, current frontier,
and open problems. The output grounds downstream proof / proposal
work.

## When to use
Trigger when the user asks for prior work on a theorem, conjecture,
construction, or method. For a specific proof check, route to
proof-verification.md. For derivation work, route to
mathematical-reasoning.md.

## Method

1. **Pin the topic precisely.** "Topology" is a field, "knot
   invariants" is a topic, "homological knot invariants for
   alternating knots" is a question. Mathematics rewards
   precision in the query.
2. **Pick corpora.**
   - **arXiv** (`math.*` categories) — primary preprint corpus.
     Mathematicians frequently cite the arXiv version.
   - **MathSciNet** (paid; AMS) and **zbMATH Open** — abstract
     databases with subject classification (MSC).
   - **Semantic Scholar / OpenAlex** — citation graph and
     full-text where available.
   - **Authors' webpages** — many mathematicians post the latest
     version of their papers there before journal publication.
3. **Use MSC subject codes.** Mathematics Subject Classification
   2020 (`14H10` for algebraic curves, `57M27` for knot theory,
   etc.) anchors a query to the field's own ontology.
4. **Build the query.** arXiv full-text search supports
   `cat:math.AT AND ti:knot AND abs:Heegaard`. Boolean operators
   plus field-specific limiters.
5. **Filter for canonical works.**
   - Highly cited foundational papers (often older — 1980s/1990s
     for knot theory; 1960s for algebraic topology).
   - Recent breakthroughs (last 5 years).
   - Survey / lecture-notes papers (often the best entry point —
     search "survey", "lectures", "introduction" in titles).
6. **Capture per source.** Title, author, year, venue, MSC code,
   one-line theorem statement, one-line method, relevance to the
   query, arXiv ID + journal DOI.
7. **Synthesize.** A short summary naming:
   - The canonical foundational results.
   - The current frontier (last ~5 years).
   - Open problems and conjectures named in the literature.
   - Connections to adjacent fields (knot theory ↔ low-dim
     topology ↔ gauge theory).

## Citation discipline

Every theorem statement is attributed to a specific paper.
Mathematics requires precision: if Theorem 3.2 of [Smith, 2010]
proves the result, cite it that way. Refuse to fabricate theorem
attributions, statement formulations, or proof strategies.

When the user disputes an attribution, re-pull the source — do not
defend on training-memory recall.

## Common failures

1. **Unsharp query.** "Riemann hypothesis" returns the universe;
   "L-function zero distribution at low height" returns the actual
   neighbourhood.
2. **arXiv-only.** Many mathematicians publish in venues with
   slow indexing; check zbMATH and MathSciNet for completeness.
3. **No MSC.** Querying without subject codes pulls cross-field
   noise.
4. **Missing survey.** Skipping the survey article makes the
   learner re-derive what the field has already organized.
5. **Conflating arXiv version with published version.** They
   sometimes differ materially (errata, additional results). Cite
   the version actually used.
6. **Author-name ambiguity.** Common surnames (Wang, Lee, Smith)
   require initials + institution disambiguation.

## Output

```
:::survey
template: literature-review
query: "..."
query-date: <YYYY-MM-DD>
msc-codes: [57M27, 57R58]
corpora: [arxiv, zbmath, semantic-scholar]

[surname, year]: <theorem statement> [arXiv:XXXX | DOI:10.xxxx | MR-id]
...

Foundational works: ...
Current frontier: ...
Open problems: ...
Adjacent fields: ...
:::
```

## Refusal

The agent will not:
- Fabricate theorem statements or attributions.
- Claim a result is "well-known" without citation; well-known
  to a specialist is not well-known to the learner.
- Pretend a paper proves what its abstract gestures at; cite the
  actual theorem.
