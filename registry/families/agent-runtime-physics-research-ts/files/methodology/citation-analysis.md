---
capability: citation-analysis
status: active
source: hand-authored, aligned with INSPIRE-HEP and Semantic Scholar citation-graph conventions
retrieved: 2026-04-26
---

# Citation Analysis methodology (physics)

Citation analysis maps the structure of a research conversation:
who cites whom, where consensus is forming, where forks remain, and
which paper is the currently-cited authoritative measurement or
calculation. The deliverable is a `:::artifact` with a graph
description, not a vibes-based assertion of importance.

## When to use

Trigger this template when the user asks:

- "Who has cited <paper>?"
- "What is the most-cited paper on <topic>?"
- "Which result do experimentalists / theorists actually use?"
- "Has <result> been replicated / contradicted?"
- "What's the lineage of <method/idea>?"

## Method

1. **Identify the seed paper(s).** Start from a specific arXiv ID or
   DOI. If the user only has a topic, route through
   `literature-search.md` first to get a seed.
2. **Pull forward and backward citations.**
   - Forward (papers that cite the seed): Semantic Scholar
     `references.cited_by`, INSPIRE-HEP for HEP, OpenAlex for general
   - Backward (papers the seed cites): the paper's bibliography,
     OpenAlex `references`
3. **Tag each citing paper** by its relationship to the seed:
   - **Builds on**: extends the result in the same direction
   - **Constrains**: independent measurement bounding the same
     observable
   - **Contradicts**: incompatible measurement / calculation
   - **Reviews**: cites as one of many in a survey
   - **Methods**: uses the seed's method, not its result
   - **Tangential**: namedrops the seed without engaging
4. **Identify the convergence cluster.** Most physics topics have a
   group of 5–15 papers that everyone in the area cites. Surface that
   cluster explicitly — it's the "operative consensus."
5. **Identify forks.** Where two clusters cite different seed papers
   for the same observable, name the fork: which assumption / data
   set / regime each cluster takes.
6. **Highlight contradictions.** Tension > 3σ between two reported
   measurements is interesting. Name the experiments, the values,
   the systematics each side flags, and the next decisive measurement.
7. **Output the graph as a `:::artifact`.**

## Output shape

```
:::artifact
template: citation-analysis
seed: { arxiv: "XXXX.YYYYY", title: "...", year: 2023 }
forward-citations: 142 (as of 2026-04-26)
backward-citations: 38
clusters:
  - name: "operative consensus"
    members: ["arXiv:...", "arXiv:...", ...]
    summary: "..."
  - name: "fork-A: assume <X>"
    members: [...]
  - name: "fork-B: assume <Y>"
    members: [...]
contradictions:
  - { a: "arXiv:1", b: "arXiv:2", observable: "<param>",
      tension: "3.4σ", reconciliation-attempts: ["arXiv:3"] }
key-citing-paper: "arXiv:..." (most-cited downstream paper)
:::
```

## Citation discipline

Citation counts come from real corpus queries with the date stamped.
Counts drift; never quote a count without "as of <date>." Refuse to
invent counts or relationships.

For HEP, INSPIRE-HEP citation counts are the community-standard. For
broader physics, Semantic Scholar and OpenAlex disagree by
double-digit percentages on count — report both and note the
discrepancy when material.

## Common analysis failures

1. **Conflating citation count with importance.** Highly-cited papers
   are sometimes wrong in ways that took years to detect. A paper
   widely cited *to be refuted* is still highly cited.
2. **Ignoring the self-citation network.** Same group citing its own
   prior work is not independent confirmation.
3. **Missing the meta-paper.** Physics topics often have a single
   review or PDG entry that consolidates the field; downstream papers
   cite the review, not the primary measurements.
4. **Dropping the date.** Citation graphs update; what was a 3σ
   tension in 2022 may be reconciled by 2025.
5. **No-engagement tagging.** Many "tangential" citations are just
   namedrops. Don't count them as substantive engagement.

## Scope limits

This template is a citation-graph descriptor, not a bibliometric
ranking. For h-index, journal impact, or career evaluation, route to
a different tool — these are a different (and more contested)
question, and the agent should refuse to produce them as authoritative
evaluations of researchers.
