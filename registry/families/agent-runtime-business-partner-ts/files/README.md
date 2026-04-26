# business-partner

Executive thinking-partner agent bundle. **Advisory only — not a board
member, not a fiduciary, not a substitute for the operator's lawyer,
CPA, or HR counsel.** Runs a weekly review cadence, designs OKRs, and
maintains a decision journal. Citation-grounded for any market or
strategy claim via the research-corpus layer.

## What this bundle is

An agent's filesystem: a system prompt + weekly-review / OKR /
decision-journal templates + Cloudflare Worker shell + Tangle Sandbox
SDK + the research-corpus tool kit (arxiv / Semantic Scholar /
OpenAlex / Crossref). Runs in a per-operator Tangle sandbox; LLM calls
go through `router.tangle.tools`.

## Advisory boundary

This bundle is **moderate stakes**. The biggest failure mode is
over-reliance: the operator treats a thinking partner as a decision
authority. The system prompt enforces an escalation contract for every
class of question that requires a real professional:

- HR / personnel actions → employment counsel
- M&A specifics → M&A counsel + banker
- Securities offerings → corporate counsel
- Comp negotiations beyond a public rubric → HR + employment counsel
- Legal advice → lawyer
- Fiduciary / board-duty territory → board chair + corporate counsel

Every escalation emits a `:::escalation` block naming the professional
and the question to bring them. Preparation for that conversation
(framing, documents, asks) is on-scope; the opinion itself is not.

## Weekly cadence pattern

The bundle ships a Monday-morning cron (`0 14 * * 1` = 14:00 UTC ≈
07:00 PT / 10:00 ET) that prompts the operator to start a weekly
review. The review walks seven dimensions — revenue / pipeline / team
/ product / runway / customer-feedback / personal-energy — and
produces an `:::artifact` block the operator can review, edit, and
file. See `templates/weekly-review-protocol.md` for the full method.

The cadence is intentional. The agent holds it even when the operator
wants to skip — skipping the cadence is a leading indicator the
operator is reactive rather than proactive, which is itself a signal
worth surfacing.

## Research-corpus integration

When the operator asks for market context, competitive landscape, or
benchmark data, the agent uses the research-corpus tools to pull from
arxiv / Semantic Scholar / OpenAlex / Crossref and emits a `:::survey`
block with inline `[surname, year]` citations. **Hallucinated market
data is the failure mode this layer prevents.** If no citation exists,
the agent downgrades the claim to a hypothesis the operator can test.

## Domain capabilities

- `weekly-review-protocol` — the seven-dimension Monday review.
  Methodology in `templates/weekly-review-protocol.md`.
- `okr-design` — Doerr-style OKRs (3–5 objectives × 3 KRs);
  aspirational vs committed split; mid-quarter 0/0.3/0.7/1.0 grading.
  Methodology in `templates/okr-design.md`.
- `decision-journal` — Bezos Type 1 / Type 2 reversibility; predicted
  outcome with timeframe; what would change my mind; honest scoring at
  the agreed checkpoint. Methodology in `templates/decision-journal.md`.

## Extension points

- `system-prompt.md` — adjust role / advisory boundary / escalation
  triggers. Re-run `prompt-frontmatter-valid` after edits.
- `templates/weekly-review-protocol.md` — change the seven dimensions
  for non-startup contexts (e.g. drop "runway" for a profitable
  business).
- `templates/okr-design.md` — swap to a different goal-setting frame
  (V2MOM, Hoshin Kanri, NCT) by replacing the file; keep the
  capability id stable.
- `defaults.allowedDomains` — additional outbound URLs (e.g.
  Crunchbase, PitchBook) the bundle is permitted to reach. Anything
  outside this list is sandbox-blocked.

## Source material

Templates draw on:

- Andy Grove, *High Output Management* (operating cadence, output
  measurement)
- John Doerr, *Measure What Matters* (OKR shape, grading scale,
  aspirational vs committed split)
- Jeff Bezos, 1997 + 2015 + 2016 shareholder letters (Type 1 vs
  Type 2 decisions, disagree-and-commit, day-1 mentality)
- Shane Parrish / Farnam Street (decision journal format, predictive
  scoring, what-would-change-my-mind discipline)
