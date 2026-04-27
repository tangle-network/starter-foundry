---
capability: gad7-screener
status: active
source: hand-authored, aligned with Spitzer, Kroenke, Williams & Löwe (2006) GAD-7 administration & scoring
retrieved: 2026-04-26
providedBy: agent-tools/clinical-screeners
---

# GAD-7 Anxiety Screener Protocol

The GAD-7 is a 7-item validated screener for generalized-anxiety
symptoms over the prior two weeks. The agent administers it only with
explicit user consent and only when listening has surfaced sustained
worry / restlessness / similar signals. The score is a screener, not a
diagnosis.

## When to use

Switch from `listening-protocol.md` to GAD-7 when:

1. The user has signaled sustained worry, racing thoughts,
   restlessness, irritability, or anticipatory dread.
2. The user asks for a structured check or a number.
3. The user explicitly consents.

Do not run the GAD-7 if:

- The user is in active panic or acute crisis → go to
  `escalation-protocol.md` and stabilize first.
- The user is intoxicated, dissociating, or asks not to.
- The likely target is panic disorder, OCD, PTSD, or social anxiety
  specifically — GAD-7 picks up generalized anxiety; the other
  disorders have their own validated screeners (PDSS, OCI-R, PCL-5,
  SPIN). Note this aloud and offer to refer to a clinician for the
  more specific screener instead of forcing GAD-7.

## Method

1. **Permission.** "There's a 7-question screener called the GAD-7
   that gives a snapshot of how anxiety has been over the past two
   weeks. Each question is a 0–3 answer. Want to walk through it?"
2. **Frame the window.** "Over the *last two weeks*, how often have
   you been bothered by …"
3. **Read each item verbatim.** Do not paraphrase. Accept the
   number, label, or natural-language mapped to a band — confirm the
   band before scoring when the user used natural language.
4. **Score** by summing the 7 items (0–3 each). Total range 0–21.

## The 7 items (administer verbatim)

Over the last 2 weeks, how often have you been bothered by …

1. Feeling nervous, anxious, or on edge
2. Not being able to stop or control worrying
3. Worrying too much about different things
4. Trouble relaxing
5. Being so restless that it is hard to sit still
6. Becoming easily annoyed or irritable
7. Feeling afraid as if something awful might happen

Response options: 0 = not at all, 1 = several days,
2 = more than half the days, 3 = nearly every day.

After the 7 items, ask the validated functional-impact follow-up:

> "If you checked off any problems, how *difficult* have these made it
> for you to do your work, take care of things at home, or get along
> with other people?" — not difficult at all / somewhat difficult /
> very difficult / extremely difficult

This is not summed into the score but informs the conversation.

## Scoring & bands

| Score | Severity   | Default action                       |
|------:|------------|--------------------------------------|
| 0–4   | Minimal    | Reflect, return to listening         |
| 5–9   | Mild       | Reflect, share self-soothe options   |
| 10–14 | Moderate   | Recommend talking to a clinician     |
| 15–21 | Severe     | **Strongly recommend clinician**, share resources |

A "very" or "extremely difficult" functional-impact rating shifts the
recommendation up one band even if the raw score sits lower.

## Output shape

```
:::artifact
template: gad7
date: <ISO-8601>
total: 11
band: "moderate"
items: [2, 2, 2, 1, 1, 2, 1]
functional-impact: "very-difficult"
notes: "user reports work avoidance and 4–6 weeks of escalation"
:::
```

## Discipline rules

- **GAD-7 is a screener, not a diagnosis.** Say so explicitly when
  delivering the result.
- **Co-occurrence with depression is common.** A user with GAD-7
  ≥10 and depression-shaped language should be offered the PHQ-9 too.
  Don't hide the option.
- **No medication advice.** Benzodiazepine, SSRI, propranolol —
  refuse and escalate to a prescriber.
- **Substance use modifier.** Caffeine, stimulants, withdrawal can
  inflate GAD-7. Ask about it before declaring a band; it doesn't
  invalidate the screener but contextualizes it.
- **Voice mode.** Slow down. Anxious users may rush; pace them with
  silence between items rather than racing through.

## Refusal

Refuse to "just tell me if I have anxiety." The PHQ/GAD instruments
do not diagnose. Offer the screener, deliver the band honestly, and
hand off to `escalation-protocol.md` when the band warrants it or the
user asks for next steps.
