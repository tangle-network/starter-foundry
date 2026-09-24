# Interview Loop Design

Methodology for composing a full interview loop for a leveled
technical role. A loop is the ordered sequence of stages, each with
a rubric, an interviewer, and a clear signal owned.

## Leveling rubric (what the loop is calibrated to)

Before composing the loop, agree on the level. The level determines
which signals matter and at what depth.

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
  cross-functional judgment. Coding mechanics still tested but as a
  floor, not the load-bearing signal.
- **IC6 / Senior Staff and up** — owns org-level technical strategy.
  Loop becomes more about scope, judgment, vision, and partnership
  with leadership. Coding becomes a "no surprises" check rather than
  a primary axis.

The loop's signal weights MUST match the level. A senior loop that
spends 80% of time on coding mechanics is mis-calibrated and will
either over-hire juniors or under-hire seniors who refuse to
solve a leetcode puzzle.

## Standard loop composition

For a typical IC3 / IC4 backend or full-stack role:

1. **Recruiter phone screen (30 min)** — work-auth, comp expectation
   alignment, motivation for the role, level confirmation. The
   recruiter does NOT score technical signal here.
2. **Hiring-manager screen (45 min)** — scope, motivation, recent
   work narrative, level confirmation. Owns the "is this the right
   level for the role" decision.
3. **Coding interview (60 min)** — practical coding against a
   problem the candidate could plausibly hit on the job. NOT
   leetcode-hard puzzles unless the role actually demands them.
   Pair-style, candidate writes code, interviewer probes design
   choices. Owns: coding mechanics + debugging.
4. **Systems / design interview (60 min)** — design a system at the
   level's scope. IC3: a feature. IC4: a service. IC5: a
   cross-service architecture. Owns: systems judgment +
   trade-off articulation.
5. **Behavioral / scope interview (45 min)** — STAR-format probes
   into past work. Owns: collaboration, scope/judgment,
   mentorship (level-dependent).
6. **Bar-raiser (45 min)** — outside-team interviewer auditing
   process integrity, plus one signal not yet covered (often
   communication or first-principles reasoning). Has veto.

Adjust by role and level. A platform-engineering loop swaps
"coding" for "operational scenario." A mobile loop adds a
device-specific systems segment. A staff+ loop adds a
cross-functional partnership stage.

## Interview kit per role

The "kit" is the artifact pack the panel uses, version-controlled
in the ATS or a shared doc:

- **JD** (the canonical version, not the public-facing variant if
  they differ).
- **Leveling rubric** — the level expectations and signal weights.
- **Per-stage rubric** — see `screening-rubric.md`. One per stage.
- **Question bank** — anchor + probes per signal, per stage. The
  bank should have ≥ 2 problems per stage so the same panelist
  doesn't run the same problem repeatedly (problem leaks; rotation
  protects integrity).
- **Calibration log** — the panel's calibration-session results
  before the loop opened. Re-calibrate every 3 months or after any
  panel-composition change.
- **Reference debrief template** — pre-fillable structure so
  panelists submit independent reads in the same shape.

The kit lives once per role family. Don't fork per requisition; fork
per role family (e.g. one kit for all "Senior Backend Engineer, IC4"
loops across teams) and add team-specific notes as a delta layer.

## Debrief structure

The debrief is where bias most often re-enters a structured loop.
Defend it:

1. **Independent reads first.** Every panelist submits their scored
   rubric + recommendation BEFORE the debrief meeting. No comments
   on a shared doc until everyone has submitted. Anchoring is the
   largest single source of debrief noise; this is the cheapest fix.
2. **Recommendations are SH / H / LH / NH** (Strong Hire / Hire /
   Lean Hire (or "Lean No"; org choice) / No Hire). Avoid 3-point
   scales — same reason as the 4-point rubric.
3. **Read order in debrief**: scores first (round-robin), then
   evidence (round-robin), then discussion. Don't let one panelist
   monologue first.
4. **Rubric-anchored discussion only.** "I have a feeling about
   this one" is not admissible without rubric-anchored evidence.
5. **Bar raiser closes.** They speak last and audit whether the
   rubric was followed. They have veto.
6. **Decision logged with reasoning.** The decision and its
   rubric-anchored rationale go into the ATS so future panels can
   calibrate against past decisions.

## Anti-patterns to refuse

- **"Sleep on it" decisions.** If the panel can't anchor a decision
  in the rubric same-day, the loop didn't gather enough signal.
  Schedule one more targeted stage rather than letting recency and
  rumination dominate.
- **Slack debriefs.** Async debriefs amplify whoever posts first. If
  async is unavoidable, enforce locked independent reads before any
  comment thread opens.
- **Replaying a candidate** with the same panel after a No. If a
  candidate is reconsidered, run a fresh loop with a fresh panel.
- **Off-loop signal**: someone "happens to know" the candidate.
  Move them off the loop or log the relationship as a
  conflict-of-interest disclosure.

## Self-check before emitting the loop spec

- Level confirmed; signal weights match. ✅ / ❌
- Each stage owns a distinct signal; no double-counting. ✅ / ❌
- Bar raiser is from outside the immediate team. ✅ / ❌
- Independent-read-before-debrief enforced in the kit. ✅ / ❌
- Calibration session scheduled before first candidate. ✅ / ❌
- 4-point recommendation scale (SH/H/LH/NH). ✅ / ❌
