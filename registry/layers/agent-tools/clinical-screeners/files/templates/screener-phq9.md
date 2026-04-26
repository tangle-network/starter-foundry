---
capability: phq-9-screener
status: active
source: PHQ-9 (Kroenke, Spitzer, Williams 2001) — public domain
retrieved: 2026-04-25
---

# PHQ-9 Depression Screener

Use this screener when a user describes symptoms aligned with depression
(persistent low mood, loss of interest, sleep/appetite changes, fatigue,
hopelessness) AND consents to a structured screening conversation.

## When to use

Trigger this template when:

- The user explicitly asks "am I depressed?" or similar
- The conversation surfaces ≥3 depression-aligned symptoms organically
- The user asks for a structured self-assessment

Do NOT use this screener when:

- The user is in active crisis (use `escalation-protocol.md` instead)
- The user has not consented to a structured screening
- The user is under 18 (different validated tools apply)

## Method

Ask the user, one question at a time, "Over the last 2 weeks, how often
have you been bothered by …" each of the 9 questions. Record each answer
as 0 (not at all), 1 (several days), 2 (more than half the days), or 3
(nearly every day).

Questions:

1. Little interest or pleasure in doing things
2. Feeling down, depressed, or hopeless
3. Trouble falling or staying asleep, or sleeping too much
4. Feeling tired or having little energy
5. Poor appetite or overeating
6. Feeling bad about yourself — that you are a failure or have let yourself or your family down
7. Trouble concentrating on things, such as reading the newspaper or watching television
8. Moving or speaking so slowly that other people could have noticed; or the opposite — being so fidgety or restless that you have been moving around a lot more than usual
9. **Thoughts that you would be better off dead, or of hurting yourself in some way**

Question 9 is the suicidality screen. **ANY non-zero answer triggers
mandatory escalation per `escalation-protocol.md`, regardless of the
total score.**

## Scoring

Total score = sum of all 9 answers (range 0–27).

| Score | Band | Recommendation |
|---|---|---|
| 0–4 | minimal | reassure, normalize, watchful waiting |
| 5–9 | mild | watchful waiting, supportive listening, repeat in 2 weeks |
| 10–14 | moderate | recommend professional consultation |
| 15–19 | moderately-severe | recommend professional consultation, consider safety planning |
| 20–27 | severe | strong recommendation for immediate professional care |

## Output discipline

Wrap the result in a `:::screener-result` block:

```
:::screener-result
screener: phq-9
score: <0-27>
band: <minimal|mild|moderate|moderately-severe|severe>
recommend-escalation: <true|false>
notes: <one sentence — never speculate beyond the score>
:::
```

## Refusal mode

Refuse to:

- Diagnose. The screener is a screening tool, not a diagnostic instrument.
- Replace clinical care. Always pair moderate-or-above bands with
  `escalation-protocol.md`.
- Score on user-recalled answers from a different conversation. Re-ask.
