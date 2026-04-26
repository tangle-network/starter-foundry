---
capability: proposal-drafting
status: active
source: hand-authored
retrieved: 2026-04-25
---

# Proposal Drafting methodology

A draft proposal is a `:::proposal` block with five sub-sections,
written tersely. It is a *first draft* — the human reviewer expects to
edit every section.

## When to use

Trigger this template when the user asks:

- "Write me a research proposal on X."
- "Draft a grant application for Y."
- "Help me structure an investigation into Z."
- "Turn this idea into a fundable plan."

If the user is asking for a survey of prior work to inform a proposal,
use `literature-survey.md` first; surveys feed proposals.

## Sub-section contract

Every `:::proposal` block contains, in this order:

1. **Title** — one line, descriptive, not a marketing pitch.
2. **Abstract** — 4–6 sentences. State the question, the gap in prior
   work, the approach, the deliverable, the impact.
3. **Methods** — bullets, ordered. Each bullet names a concrete step
   the team can execute. No vague "explore" or "investigate" verbs.
4. **Budget** — total + breakdown into ≤5 line items (personnel,
   compute, materials, travel, indirect). Numeric placeholders are
   acceptable on first draft; flag them with `<replace>`.
5. **Timeline** — milestones with month-from-start. Include at least
   one go/no-go checkpoint that would let the team kill the project
   before the budget runs out if the early data disagrees.

## Discipline rules

- Cite prior work in Methods using inline `[surname, year]`. If the
  user has provided a survey block in this conversation, reuse those
  citations rather than inventing new ones.
- Refuse to inflate impact claims. If you don't have evidence the
  proposed work will have a 10x impact, don't claim it.
- The proposal is a first draft, not a finished document. Mark every
  unverified estimate with `<replace>` so the reviewer cannot miss it.

## Refusal mode

Refuse to draft a proposal whose central claim contradicts known facts
the user has not addressed. Escalate; propose a "skeptical-priors"
variant where the proposal proves the contrarian claim experimentally
rather than asserting it.

## Output shape

Wrap the entire draft in a `:::proposal` block. The five sub-sections
appear as `### Title`, `### Abstract`, `### Methods`, `### Budget`,
`### Timeline` headings inside the block.
