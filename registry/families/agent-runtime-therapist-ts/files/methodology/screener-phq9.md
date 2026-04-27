---
capability: phq9-screener
status: active
source: hand-authored, aligned with Kroenke, Spitzer & Williams (2001) PHQ-9 administration & scoring guidance
retrieved: 2026-04-26
providedBy: agent-tools/clinical-screeners
---

# PHQ-9 Depression Screener Protocol

The PHQ-9 is a 9-item validated screener for depressive symptoms over
the prior two weeks. The agent administers it only with explicit user
consent, only when listening has surfaced sustained low mood / anhedonia
/ similar signals, and only with the safety scaffolding below. The
score is a screener, not a diagnosis.

## When to use

Switch from `listening-protocol.md` to PHQ-9 when:

1. The user has signaled sustained (≥2 weeks) low mood, loss of
   interest, or hopelessness in conversation.
2. The user asks for a structured check or a number ("am I depressed?",
   "is this normal?").
3. The user explicitly consents — never spring it on them.

Do not run the PHQ-9 if:

- The user is in active crisis (Item 9 risk firing pre-screen) →
  go to `escalation-protocol.md` immediately.
- The user is intoxicated, in acute distress, or asks not to.
- The user is under 12 (PHQ-A is a different instrument; refuse and
  refer to a pediatric provider).

## Method

1. **Permission.** "There's a 9-question screener called the PHQ-9
   that gives a snapshot of how the past two weeks have been. Each
   question gets a 0–3 answer. Want to walk through it?"
2. **Frame the window.** "Over the *last two weeks*, how often have
   you been bothered by …" — repeat the window before each item if
   needed.
3. **Read each item verbatim.** Do not paraphrase the validated
   wording. Accept any of: number (0–3), the label
   (`not at all` / `several days` / `more than half the days` /
   `nearly every day`), or natural language the agent maps to a band.
   When mapping natural language, *confirm* the band before scoring.
4. **Score** by summing items 1–9 (each 0–3). Total range 0–27.

## The 9 items (administer verbatim)

Over the last 2 weeks, how often have you been bothered by …

1. Little interest or pleasure in doing things
2. Feeling down, depressed, or hopeless
3. Trouble falling or staying asleep, or sleeping too much
4. Feeling tired or having little energy
5. Poor appetite or overeating
6. Feeling bad about yourself — or that you are a failure or have let
   yourself or your family down
7. Trouble concentrating on things, such as reading the newspaper or
   watching television
8. Moving or speaking so slowly that other people could have noticed?
   Or so fidgety / restless that you've been moving around a lot more
   than usual?
9. Thoughts that you would be better off dead, or of hurting yourself
   in some way

Response options for each: 0 = not at all, 1 = several days,
2 = more than half the days, 3 = nearly every day.

## Scoring & bands

| Score | Severity              | Default action                   |
|------:|-----------------------|----------------------------------|
| 0–4   | Minimal               | Reflect, return to listening     |
| 5–9   | Mild                  | Reflect, suggest self-care, optional follow-up |
| 10–14 | Moderate              | Recommend talking to a clinician |
| 15–19 | Moderately severe     | **Strongly recommend clinician**, share resources |
| 20–27 | Severe                | **Escalate** — see escalation-protocol.md |

**Item 9 (suicidality) is special.** A non-zero answer on Item 9
fires the escalation protocol regardless of total score. Do not wait
for the sum; switch to `escalation-protocol.md` the moment Item 9
is non-zero, complete the safety conversation, *then* return to
finish or skip remaining items at the user's preference.

## Output shape

Wrap the result in a `:::artifact` block:

```
:::artifact
template: phq9
date: <ISO-8601>
total: 14
band: "moderate"
item-9-nonzero: false
items: [2, 2, 1, 2, 1, 2, 1, 2, 1]
notes: "user reported low mood ~3 weeks; appetite intact"
:::
```

When Item 9 is non-zero, also emit the `:::escalation` block specified
in `escalation-protocol.md`.

## Discipline rules

- **You are not a diagnostician.** Always state: "PHQ-9 is a
  screener, not a diagnosis. A diagnosis requires a clinician."
- **No false reassurance.** A score of 4 does not mean "you're fine";
  it means "this snapshot is in the minimal band."
- **No medication advice.** Refuse questions like "should I take
  Lexapro?" — escalate to a prescribing clinician.
- **Re-screening cadence.** PHQ-9 is validated for repeat
  administration. Suggest re-screening at 2-week or 4-week intervals
  if the user wants to track over time, but do not pressure.
- **Voice mode.** Read items more slowly than you would type. Confirm
  numeric answers before scoring. Pauses are part of the response.

## Refusal

If the user pushes for a diagnosis, prescription, or therapy "session"
beyond peer support: refuse plainly, name the boundary, and offer to
help find a real clinician (`escalation-protocol.md` covers the
handoff).
