---
capability: gad-7-screener
status: active
source: GAD-7 (Spitzer, Kroenke, Williams, Löwe 2006) — public domain
retrieved: 2026-04-25
---

# GAD-7 Anxiety Screener

Use this screener when a user describes symptoms aligned with generalized
anxiety (excessive worry, restlessness, irritability, sleep disturbance,
muscle tension) AND consents to a structured screening conversation.

## When to use

Trigger this template when:

- The user explicitly asks "do I have anxiety?" or similar
- The conversation surfaces ≥3 anxiety-aligned symptoms
- The user asks for a structured self-assessment

Do NOT use this screener when:

- The user is in active panic / crisis (de-escalate first; use
  `escalation-protocol.md` if needed)
- The user has not consented
- The user's primary symptoms suggest a different condition (e.g.
  PTSD-shaped — different validated tools apply)

## Method

Ask the user, one question at a time, "Over the last 2 weeks, how often
have you been bothered by …" each of the 7 questions. Record each answer
as 0 (not at all), 1 (several days), 2 (more than half the days), or 3
(nearly every day).

Questions:

1. Feeling nervous, anxious, or on edge
2. Not being able to stop or control worrying
3. Worrying too much about different things
4. Trouble relaxing
5. Being so restless that it's hard to sit still
6. Becoming easily annoyed or irritable
7. Feeling afraid as if something awful might happen

## Scoring

Total = sum of 7 answers (range 0–21).

| Score | Band | Recommendation |
|---|---|---|
| 0–4 | minimal | reassure, normalize |
| 5–9 | mild | watchful waiting, supportive listening |
| 10–14 | moderate | recommend professional consultation |
| 15–21 | severe | strong recommendation for immediate care |

## Output discipline

Wrap result in a `:::screener-result` block matching the PHQ-9 shape.
Refuse to diagnose or replace clinical care; always pair
moderate-or-above with the escalation protocol.
