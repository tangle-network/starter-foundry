# Prioritization — RICE Scoring (PM)

## Purpose
Rank candidate features against each other on a quantitative basis. RICE
is a **tiebreaker**, not a decision oracle. The PM names the strategic
reason a winning RICE score actually wins; the score makes that reasoning
defensible.

## When to use
- Wednesday PRD lock, when multiple PRDs are competing for the same sprint.
- Roadmap planning — quarterly or monthly slot.
- After CS surfaces a theme that may or may not deserve a sprint slot.

## The four RICE dimensions

### Reach (R)
- How many users will this feature affect, per quarter or per month?
- Use **measured** numbers from analytics if available; named estimates
  with sources if not. No vibes.
- Example: "1,200 active users per month who hit the export flow."

### Impact (I)
- For each affected user, how much does this move the primary metric?
  Use a five-point scale:
  - 3.0 = massive (changes user behavior fundamentally)
  - 2.0 = high
  - 1.0 = medium
  - 0.5 = low
  - 0.25 = minimal
- Anchor the scale to a **named past feature** the team has shipped. If you
  can't anchor, the scale is a vibe.

### Confidence (C)
- How confident are we in the Reach × Impact estimate? Percentage:
  - 100% = backed by user research + analytics
  - 80%  = backed by analytics or strong analog
  - 50%  = backed by reasoning + weak analog
  - 20%  = a guess
- Below 50% confidence is a **discovery signal**, not a prioritization
  signal. Run a discovery cycle before scoring.

### Effort (E)
- Person-months from the eng-manager's `tech-feasibility-scoping`
  output. Not aspirational; not a vibe. Use the high end of the spike
  range.
- If feasibility is **blocked**, score is `null` — RICE cannot be
  computed until the dependency is resolved.

## The score
```
RICE = (Reach × Impact × Confidence) / Effort
```

Higher = better. But:

- A score of 1000 vs 500 means "consider 1000 first."
- A score of 1000 vs 950 means "they're tied — pick by strategy, not by
  the second decimal."
- The PM names which dimension dominates the ranking and whether the team
  trusts that dimension's measurement.

## Process

1. **Collect candidates.** Every PRD draft + every CS-surfaced theme that
   crossed the n≥3 threshold.
2. **Score independently.** PM scores R, I, E using analytics + eng's
   feasibility report. Designer reviews I (impact on primary user job).
   CS reviews R (reach across the customer base).
3. **Resolve disagreements** by re-stating the assumption behind the
   score. The lower-confidence score wins until evidence resolves it.
4. **Rank, then strategize.** Top 3 are candidates for the sprint. PM
   names the strategic reason the chosen winner beats the others. RICE
   is the floor; strategy is the ceiling.
5. **Lock.** The PRD that wins enters Wednesday's PRD lock. Losers go
   back to backlog with explicit reason ("blocked by feasibility",
   "low confidence — needs discovery", "lower impact than X").

## Anti-patterns

- **Score inflation.** Every PRD scoring 800+ means the scale isn't
  anchored. Re-anchor against shipped past work.
- **Confidence laundering.** Calling a guess "high confidence" because
  the feature is exciting. Confidence reflects evidence, not enthusiasm.
- **Effort optimism.** Eng-manager's feasibility report is the source.
  Do not "round down" to make the math work.
- **RICE-only decisions.** A high RICE on a feature that contradicts
  strategy is a *signal that strategy is wrong* — but the PM still has
  to name the strategic decision, not hide behind the score.

## Output (`:::artifact template: prioritization-rice`)
- Candidates table: name, R, I, C, E, score
- Top 3 ranked
- Strategic reason the winner wins (one paragraph)
- What changes if Confidence is lower than estimated (sensitivity check)
