# Paper Summarization Template

## Purpose
Summarize a single CS / ML paper concisely and faithfully: problem,
method, key result, claims-vs-evidence, limitations, and relevance
to the user's question. Citation-grounded — never paraphrase what
the paper doesn't say.

## When to use
Trigger when the user asks "what does this paper claim" or
"summarize <arXiv ID>." For broader literature surveys, use
literature-survey.md. For citation graphs, use
citation-graph-exploration.md.

## Method

1. **Retrieve via research-corpus.** Don't summarize from
   training memory; pull the actual paper. arXiv preferred (full
   PDF + LaTeX source); fall back to OpenAlex / publisher.
2. **Pin the version.** Papers update; cite the version
   (`arXiv:2401.12345v3`, journal version, conference camera-
   ready). Differences across versions can be material.
3. **Read structurally.**
   - **Abstract**: the claim. Often over-stated; use as a
     starting hypothesis, not a conclusion.
   - **Introduction**: the framing, the prior work, the gap the
     paper claims to fill.
   - **Method**: the actual technical content. Read this
     carefully — many papers' contribution is small relative to
     the abstract's framing.
   - **Experiments**: what was tested, against what baselines,
     on which benchmarks.
   - **Results**: the numbers. Note variance, baselines, and
     whether the gain is statistically and practically
     meaningful.
   - **Limitations**: what the paper says it doesn't do, and
     (importantly) what it should say but doesn't.
   - **Related work**: what's missed or sandbagged.
4. **Distinguish claim from evidence.**
   - The paper *claims* X.
   - The experiments *show* Y.
   - X and Y are sometimes the same; often they're not.
   - "Our method generalizes" with experiments only on one
     benchmark — claim, not evidence.
5. **Surface the surprises.**
   - Negative results buried in appendix.
   - Ablations that show the headline component contributes
     less than the abstract suggests.
   - Compute / data scale that limits the claim's
     generalizability.
   - Reproducibility issues (no code, missing seeds).
6. **Write the summary** in a tight, structured form (see
   output below). Length scales with importance: 200 words for
   most papers; 500–1000 for foundational works.
7. **Tag relevance.** How does this paper bear on the user's
   question? Direct evidence / indirect evidence / methodologically
   relevant / not relevant.

## Reading order tips

- For most papers, **abstract → conclusion → figures → method →
  experiments**. Conclusion is often more honest than abstract.
- Read figures before reading the prose around them; they
  compress the empirical claim.
- Track citations forward: a 2020 paper read in 2026 has 5 years
  of follow-up that may have refined or refuted it.

## Output

```
:::artifact
template: paper-summarization
paper:
  title: "..."
  authors: [...]
  venue: "NeurIPS 2023"
  year: 2023
  arxiv: "2310.XXXXX"
  version: "v3"
  doi: "10.xxxx"
problem: "..."
method: "..."
contribution: "..."
key-results: [...]
baselines: [...]
benchmarks: [...]
claim-vs-evidence: "claims X; evidence supports X' which is narrower"
limitations:
  paper-states: [...]
  reader-notices: [...]
reproducibility:
  code: "released" | "promised" | "absent"
  seeds: ...
  hparams: "complete" | "partial" | "absent"
related-work-gaps: [...]
relevance-to-query: "direct" | "methodologically related" | "tangential"
:::
```

## Common summarization failures

1. **Abstract regurgitation.** The summary parrots the abstract
   without engaging the method or results.
2. **Missing ablations.** Headline gains often shrink under
   ablations; report both.
3. **Compute / data scale dropped.** "Method M outperforms" — at
   what scale? Always report.
4. **Reproducibility silent.** Code / seeds / hparams status is
   first-class information.
5. **No comparison to baselines.** "X% on benchmark" without
   comparison is meaningless.
6. **Hand-wave limitations.** "Future work will address" is the
   author's wishlist, not a real limitation report.

## Refusal

The agent will not:
- Summarize a paper from memory without retrieving it.
- Fabricate results, metrics, or citations.
- Soften limitations to be polite to the authors.
