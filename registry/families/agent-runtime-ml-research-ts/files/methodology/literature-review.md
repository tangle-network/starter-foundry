# Literature Review Template (ML)

## Purpose
Conduct a systematic literature review on an ML topic — find the
SOTA, the canonical baselines, the open benchmarks, and the open
problems. Citation-grounded; no hallucinated papers, results, or
benchmarks.

## When to use
Trigger when the user asks for prior work, SOTA on a benchmark, or
"what's the best model for X". For experiment design / ablations,
use experiment-design.md. For interpreting a specific result, use
result-interpretation.md.

## Method

1. **Pin the research question.** What's the task (classification,
   generation, RL, retrieval, alignment), the modality (text,
   image, video, audio, tabular, multimodal), the regime (low-
   data, multilingual, real-time, long-context), and the
   evaluation (benchmark, downstream task, human eval)?
2. **Pick corpora.**
   - **arXiv** (`cs.LG`, `cs.CL`, `cs.CV`, `cs.AI`, `stat.ML`)
     for primary preprints — most ML work appears here first.
   - **OpenReview** for ICLR / NeurIPS / ICML / EMNLP / ACL with
     reviews and reproducibility checklists.
   - **Papers With Code** for benchmark leaderboards and code
     links — the canonical SOTA tracker.
   - **Semantic Scholar / OpenAlex** for citation graph.
   - **Hugging Face** model hub for released checkpoints (often
     the practical SOTA, not the academic SOTA).
3. **Build the query.** Boolean + arXiv-cat filter.
   `cat:cs.CL AND ti:RAG AND (abs:retrieval OR abs:agent)`. Don't
   search by buzzword alone — combine with method or task.
4. **Filter ruthlessly.**
   - Peer-reviewed (top conferences) > arXiv preprint.
   - Reproducible (code released, seed reported, full
     hyperparameters documented) > closed.
   - Honest evaluation (held-out test, no test-set leakage,
     proper baselines) > headline-numbers-only.
   - Recent (last 2 years for SOTA tracking; widen for
     foundational works).
5. **Capture per source.** Title, authors, year, venue, model
   architecture, dataset, training details (compute, data,
   tokens), evaluation metrics, headline results, code link.
6. **Surface canonical baselines explicitly.** Even old baselines
   matter — the field moves so fast that a clever 2018 baseline
   is often skipped, leading to overstated gains.
7. **Synthesize.**
   - The current best on the benchmark + how confidently it
     beats the prior best.
   - Architectural / training-recipe trends (scale, data, RLHF,
     mixture of experts, distillation).
   - Open problems named in recent work.
   - Reproducibility issues / known controversies.
8. **Distinguish leaderboard-SOTA from useful-SOTA.** Some
   benchmarks are saturated; gains are noise. Some methods only
   win at scales the user can't access. Note compute / data
   requirements.

## Citation discipline

Every claim ships with a citation. Refuse to fabricate paper
titles, author names, benchmark numbers, or arXiv IDs. If a number
is "in flux," report a range and the date.

When the user disputes a number, re-pull the paper — never defend
on memory.

## Common review failures

1. **arXiv-version-only.** ICLR camera-ready often has stronger
   results / better methodology than the original arXiv. Pull
   both versions and note differences.
2. **Cherry-picked SOTA.** Reporting a method's best score on
   one benchmark while ignoring its losses on three others.
3. **Compute-blind comparison.** Comparing a 70B model to a 7B
   baseline as if they're equivalent.
4. **Test-set leakage ignored.** Pretrained-corpus contamination
   of a benchmark (e.g., MMLU in pretraining web crawls) inflates
   reported scores.
5. **No baseline.** Reporting absolute numbers without comparison
   to a strong, current baseline.
6. **Missing reproducibility.** Method without released code,
   seeds, or hyperparameters is a claim, not a result.

## Output

```
:::survey
template: literature-review
question: "..."
query-date: <YYYY-MM-DD>
corpora: [arxiv, paperswithcode, openreview, semantic-scholar]
benchmarks-tracked: ["MMLU", "GSM8K", ...]

[surname, year]: <method> achieves <X> on <benchmark> [arXiv:XXXX | venue]
...

SOTA: <method> ([surname, year]) at <X>; surpasses prior best by <Δ>.
Reproducibility: code released? seeds reported? full hparams?
Trends: ...
Open problems: ...
Compute / data caveats: ...
:::
```

## Refusal

- Refuse to fabricate benchmark numbers, paper titles, or
  citations.
- Refuse to declare "SOTA" without an explicit benchmark and
  date — SOTA is benchmark-bounded and time-bounded.
- Refuse to characterize a contested claim as settled. ML moves
  fast and replication crises are common.
