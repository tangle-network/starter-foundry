---
capability: recruiting-loop-design
status: active
source: hand-authored, drawn from structured-interview research + Amazon bar-raiser pattern
retrieved: 2026-04-26
---

# Recruiting Loop Design (HR-led, hiring-manager-defined)

A loop spec produces a `:::artifact` block tagged
`template: recruiting-loop-design` containing the ordered stages,
the signal each stage owns, the rubric per stage, the calibration
plan, and the debrief structure. The loop is calibrated to the
**level** of the role — a senior loop and a junior loop look
nothing alike.

## When to run

- Opening a new requisition.
- Re-opening a role that was closed without a hire — re-calibrate;
  do not re-run the same loop that produced no signal.
- A role's panel composition changed by ≥ 50% — re-calibrate
  before the next candidate.
- The hiring manager says "the loop isn't telling us anything" —
  audit and re-design.

## Multi-role contributions

| Slot | Contributor |
|---|---|
| Bona-fide qualifications, level expectations, signal weights | Hiring manager (CTO for eng, CMO for growth, CEO for exec) |
| Loop structure, rubric design, calibration plan, debrief format | HR (you) |
| Comp band (published in JD per pay-transparency law) | HR + CFO Advisor (band-vs-budget) |
| Final hire / no-hire decision | Hiring manager + bar raiser |

**Always handoff to the hiring manager peer first** to gather
bona-fide signals before designing the loop. If CTO has not
defined the engineering signals at the level, the loop has nothing
to calibrate against.

## Leveling rubric (loop calibrated to level)

Before composing the loop, agree on the level. The level
determines which signals matter and at what depth.

- **IC2 / Junior** — executes well-scoped work with guidance.
  Signal weights: coding mechanics, learning velocity, debugging
  basics. Lower weight on systems, lower on scope/judgment.
- **IC3 / Mid** — owns features end-to-end with light direction.
  Signal weights: coding, debugging, systems-at-feature-scope,
  collaboration. Mild weight on scope/judgment.
- **IC4 / Senior** — owns systems, mentors, drives scope across
  features. Signal weights: systems design, scope/judgment,
  collaboration, mentorship. Coding mechanics still required, but
  load-bearing signal shifts upward.
- **IC5 / Staff** — owns cross-team initiatives, sets technical
  direction. Heavy weight on systems, scope, influence,
  cross-functional judgment.
- **IC6 / Senior Staff and up** — owns org-level technical
  strategy. Loop becomes more about scope, judgment, vision, and
  partnership with leadership.

The loop's signal weights MUST match the level. A senior loop
that spends 80% of time on coding mechanics is mis-calibrated and
will either over-hire juniors or under-hire seniors who refuse to
solve a leetcode puzzle.

## Standard loop composition (IC3 / IC4 backend or full-stack)

1. **Recruiter phone screen (30 min)** — work-auth, comp
   expectation alignment, motivation, level confirmation. The
   recruiter does NOT score technical signal here.
2. **Hiring-manager screen (45 min)** — scope, motivation, recent
   work narrative, level confirmation. Owns the "is this the right
   level for the role" decision.
3. **Coding interview (60 min)** — practical coding against a
   problem the candidate could plausibly hit on the job. NOT
   leetcode-hard puzzles unless the role actually demands them.
   Pair-style; candidate writes code; interviewer probes design
   choices. Owns: coding mechanics + debugging.
4. **Systems / design interview (60 min)** — design a system at
   the level's scope. IC3: a feature. IC4: a service. IC5: a
   cross-service architecture. Owns: systems judgment +
   trade-off articulation.
5. **Behavioral / scope interview (45 min)** — STAR-format probes
   into past work. Owns: collaboration, scope/judgment,
   mentorship (level-dependent).
6. **Bar-raiser (45 min)** — outside-team interviewer auditing
   process integrity, plus one signal not yet covered (often
   communication or first-principles reasoning). Has veto.

Adjust by role family. A platform-engineering loop swaps
"coding" for "operational scenario." A growth/marketing loop
swaps coding for a portfolio-walkthrough + an analytical
exercise. A staff+ loop adds a cross-functional partnership
stage.

## Loop adjustments by role family

- **Backend / full-stack engineering** (CTO-defined signals):
  standard loop above.
- **Platform / SRE / DevOps** (CTO-defined): swap coding for an
  operational scenario; add an incident-walkthrough stage.
- **Growth / marketing leader** (CMO-defined): swap coding for
  a portfolio-walkthrough; add a positioning-critique stage; add
  an experiment-design exercise.
- **Sales / SDR** (CMO-defined): swap coding for a discovery-call
  role-play; add a deal-walkthrough stage.
- **Finance / ops** (CFO-defined): swap coding for a model-build
  exercise; add a board-presentation stage.

## Interview kit per role

The "kit" is the artifact pack the panel uses, version-controlled
in the ATS or a shared doc:

- **JD** (canonical version, not the public-facing variant if they
  differ).
- **Leveling rubric** — the level expectations and signal
  weights, signed off by the hiring manager.
- **Per-stage rubric** — see `interview-rubric.md`. One per stage.
- **Question bank** — anchor + probes per signal, per stage.
  ≥ 2 problems per stage so the same panelist doesn't run the same
  problem repeatedly (problem leaks; rotation protects integrity).
- **Calibration log** — the panel's calibration-session results
  before the loop opened. Re-calibrate every 3 months or after any
  panel-composition change.
- **Reference debrief template** — pre-fillable structure so
  panelists submit independent reads in the same shape.

The kit lives once per role family. Don't fork per requisition;
fork per role family and add team-specific notes as a delta layer.

## Debrief structure

The debrief is where bias most often re-enters a structured loop.
Defend it:

1. **Independent reads first.** Every panelist submits their
   scored rubric + recommendation BEFORE the debrief meeting. No
   comments on a shared doc until everyone has submitted.
   Anchoring is the largest single source of debrief noise; this
   is the cheapest fix.
2. **Recommendations are SH / H / LH / NH** (Strong Hire / Hire /
   Lean Hire (or "Lean No"; org choice) / No Hire). Avoid 3-point
   scales — the middle absorbs ambiguity.
3. **Read order in debrief**: scores first (round-robin), then
   evidence (round-robin), then discussion. Don't let one
   panelist monologue first.
4. **Rubric-anchored discussion only.** "I have a feeling about
   this one" is not admissible without rubric-anchored evidence.
5. **Bar raiser closes.** They speak last and audit whether the
   rubric was followed. They have veto.
6. **Decision logged with reasoning.** The decision and its
   rubric-anchored rationale go into the ATS so future panels
   can calibrate against past decisions.
7. **Hiring manager makes the call** — not HR, not the panel by
   vote. The hiring manager (CTO for eng, CMO for growth, CEO
   for exec) carries the rubric-anchored discussion and decides.
   HR audits the process.

## Output shape

```
:::artifact
template: recruiting-loop-design
date: <YYYY-MM-DD>
contributors: [hr, <hiring-manager-role>, cfo-advisor?]
role: <title + level>
hiring-manager: <ceo | cto | cmo>
bona-fide-signals: <list, source-tagged to hiring manager>
level-signal-weights: <map signal → weight per level>
loop-stages:
  - { id, owner, duration, signal, rubric-ref, problem-bank-ref }
calibration-plan:
  reference-candidate: <transcript or recorded loop ref>
  pre-launch-session: <date>
  re-calibrate-cadence: every 3 months | on panel change
debrief-structure: <independent-reads-first reference>
comp-band:
  source: <leveling-doc-link>
  range-base: <usd>
  publish-in-jd: true | false (with jurisdiction-justification)
:::
```

## Anti-patterns to refuse

- **"Sleep on it" decisions.** If the panel can't anchor a
  decision in the rubric same-day, the loop didn't gather enough
  signal. Schedule one more targeted stage rather than letting
  recency and rumination dominate.
- **Slack debriefs.** Async debriefs amplify whoever posts first.
  If async is unavoidable, enforce locked independent reads
  before any comment thread opens.
- **Replaying a candidate** with the same panel after a No. If a
  candidate is reconsidered, run a fresh loop with a fresh panel.
- **Off-loop signal**: someone "happens to know" the candidate.
  Move them off the loop or log the relationship as a
  conflict-of-interest disclosure.
- **Hiring-manager-by-default-bar-raiser.** The hiring manager
  has incentive asymmetry; they want to fill the role. Bar
  raiser is from outside the immediate team.

## Self-check before emitting the loop spec

- Level confirmed; signal weights match. ✅ / ❌
- Each stage owns a distinct signal; no double-counting. ✅ / ❌
- Bar raiser is from outside the immediate team. ✅ / ❌
- Independent-read-before-debrief enforced in the kit. ✅ / ❌
- Calibration session scheduled before first candidate. ✅ / ❌
- 4-point recommendation scale (SH/H/LH/NH). ✅ / ❌
- Comp band sourced + jurisdiction-publication checked. ✅ / ❌

## Source

Frank Schmidt & John Hunter (1998), "The Validity and Utility of
Selection Methods" — structured interviews ~2x predictive of
unstructured. Amazon bar-raiser pattern (process-integrity audit,
veto authority). Lou Adler (performance-based hiring,
bona-fide-qualifications discipline). Multi-role hiring-manager
handoff adapted for the startup-team runtime.
