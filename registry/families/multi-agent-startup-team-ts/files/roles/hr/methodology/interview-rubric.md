---
capability: interview-rubric
status: active
source: hand-authored, drawn from structured-interview validity research
retrieved: 2026-04-26
---

# Interview Rubric (HR-led, hiring-manager-signed)

A rubric produces a `:::artifact` block tagged
`template: interview-rubric` containing the signals, the questions,
the 4-point Likert with behavioral anchors, the evidence
requirement, and the calibration plan. One rubric per interview
stage.

## Core principle

**Same questions, same rubric, every candidate.** Deviations should
be deliberate (e.g. follow-up probes when an answer is partial),
not free-form re-interpretation of the role.

The validity research is unambiguous: structured interviews are
roughly 2× as predictive of job performance as unstructured
interviews. Unstructured interviewing is also where most bias
enters the loop.

## Multi-role contributions

| Slot | Contributor |
|---|---|
| The bona-fide signals being tested | Hiring manager (CTO for eng, CMO for growth, CEO for exec) |
| Anchor questions + probes per signal | HR + hiring manager (jointly authored) |
| Behavioral anchors per Likert point | HR (drawn from past calibration data) |
| Calibration-session reference candidate | HR (with hiring manager review) |

If the bona-fide signals haven't been confirmed by the hiring
manager, **do not draft the rubric** — handoff first. A rubric
HR drafted alone enforces nothing because the hiring manager will
re-interpret it ad hoc during interviews.

## Rubric anatomy

A rubric for one interview stage contains:

1. **The signals** — 3 to 5 bona-fide capabilities this stage
   evaluates. More than 5 dilutes; fewer than 3 under-samples.
2. **The questions** — for each signal, 1 anchor question + 2 to 3
   probe questions. Anchor opens the topic; probes go deeper based
   on the candidate's response.
3. **The rubric scale** — 4-point Likert per signal. Avoid 5-point;
   the middle option absorbs ambiguity and stalls calibration.
4. **The behavioral anchors** — for each point on the scale, a
   concrete description of what that score looks like in this
   role. Without anchors, "3" means whatever the interviewer felt
   that day.
5. **The evidence requirement** — every score requires 1 to 2
   sentences of quoted/paraphrased evidence from the candidate's
   answer. No evidence → score doesn't count.

## The 4-point Likert (and why)

- **1 — Clearly below bar.** Fundamental gap. Strong evidence the
  signal is absent.
- **2 — Below bar, partial signal.** Some demonstration but key
  components missing or shallow.
- **3 — At bar.** Demonstrates the signal at the level the role
  requires.
- **4 — Clearly above bar.** Strong, multi-faceted demonstration;
  exceeds level expectation.

No middle "neutral" option. Forcing a directional score reduces
debrief stalemates; if an interviewer genuinely cannot decide,
that's a 2 ("partial signal — needs more evidence in a later
stage"), not a 2.5.

## Calibration session (mandatory before kickoff)

Before the loop ever runs against a real candidate:

1. Pick a reference candidate or a recorded interview (with
   consent and PII handled). Or use a written transcript.
2. Each interviewer scores it independently using the rubric.
3. Compare scores. Where there's >1 point of spread per signal,
   discuss the behavioral anchors until you converge.
4. Re-score a second reference. Spread should narrow.
5. Only ship the rubric to a real candidate when intra-panel
   variance on the same input is ≤ 1 point per signal.

This session takes 90 minutes. It saves more than that in debrief
stalemates over the loop's lifetime, and it's the single
highest-ROI intervention against unstructured-interview noise.

## Blinding (where possible)

- **Resume screening**: blind the candidate's name, school, photo,
  and graduation year. Score on the experience and skills shown.
  Tools that auto-redact exist; if the org doesn't use one, paste
  into a redacted-template form.
- **Take-homes**: anonymize submissions before review. Reviewer
  sees the work, not the candidate.
- **Phone screens**: not blindable, but the rubric carries the
  load.
- **On-site / virtual loops**: not practical to blind.

Blind every stage where it's practical. The earlier in the
funnel, the higher the volume — small bias compounds across
thousands of resume reads.

## Output shape

```
:::artifact
template: interview-rubric
date: <YYYY-MM-DD>
contributors: [hr, <hiring-manager-role>]
stage: <coding | systems-design | behavioral | bar-raiser | recruiter-screen | hm-screen>
duration-min: <int>
signals:
  - id: S1
    name: <e.g. "systems-design at IC4 scope">
    weight: <pct>
    anchor-question: <one>
    probes: [<probe-1>, <probe-2>, <probe-3>]
    likert:
      "1": <behavioral anchor — clearly below bar>
      "2": <behavioral anchor — partial signal>
      "3": <behavioral anchor — at bar>
      "4": <behavioral anchor — clearly above bar>
    evidence-requirement: 1-2 sentences quoted/paraphrased per score
calibration-session:
  reference-source: <transcript | recorded loop>
  acceptable-spread-per-signal: 1
  re-run-cadence: every 3 months | on panel change
:::
```

## Anti-patterns to refuse

- **"Culture fit" as a scoring signal.** Replace with explicit
  working-norm signals (collaborates async, writes-before-coding,
  comfortable with ambiguity). "Culture fit" correlates with
  affinity bias and has poor inter-rater reliability.
- **Single-interviewer hire/no-hire authority.** A single read is
  noisy. Multi-rater independent scoring with a structured debrief
  is the floor.
- **Brain-teaser questions** ("how many golf balls fit in a 747").
  No predictive validity for job performance; high noise;
  correlates with confidence rather than capability.
- **Asking about gaps in a way that probes protected status.**
  Gaps are fine to acknowledge; do not interrogate the reason.
- **5-point Likert.** Middle absorbs ambiguity. Force a
  directional score.

## Self-check before emitting

- 3-5 signals, each bona-fide and confirmed by the hiring
  manager. ✅ / ❌
- Anchor + probes per signal. ✅ / ❌
- 4-point Likert with behavioral anchors per point. ✅ / ❌
- Evidence requirement stated. ✅ / ❌
- Calibration session scheduled before first real candidate. ✅ / ❌
- No "culture fit" signal. ✅ / ❌
- No protected-class probe (directly or indirectly). ✅ / ❌

## Source

Frank Schmidt & John Hunter (1998), "The Validity and Utility of
Selection Methods" (meta-analysis on selection method validity).
Laszlo Bock, *Work Rules!* (Google's structured-interview
discipline + 4-point scale rationale). Lou Adler (behavioral
anchors, performance-based interviewing).
