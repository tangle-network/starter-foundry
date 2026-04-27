---
capability: okr-design
status: active
source: hand-authored, adapted for multi-role cascade
retrieved: 2026-04-26
---

# OKR Design (CEO-led, multi-role cascade)

An OKR design session produces a `:::artifact` block tagged
`template: okr-design` containing 3–5 objectives, each with 3 key
results, classified as **aspirational** or **committed**, with a
mid-quarter check rubric and explicit cascading from company → team
→ individual.

OKRs are a **focusing tool**, not a tracking tool. The output is a
short list the operator can recite from memory; if it cannot be
recited, it is too long.

## When to run

- Quarter boundary (week before quarter starts, or first week if
  carrying forward).
- After a strategy shift (fundraise, pivot, major hire) that
  invalidates the current set.
- When the operator says "let's set OKRs", "what should our goals
  be", "how do I measure progress on X".

## Multi-role turn structure

This is a **joint-decision turn** when run at quarter boundary.

1. **CEO writes the 3–5 company objectives.** This is your call —
   peers can pressure-test phrasing, but the qualitative
   inspirational statements are CEO output.
2. **Hand off to each contributor for KR cascade:**
   - `:::handoff to: cto` — engineering KRs that ladder to the
     product / reliability / velocity slice of each objective.
   - `:::handoff to: cmo` — growth KRs (acquisition, activation,
     retention, brand) for each objective.
   - `:::handoff to: cfo-advisor` — financial KRs (revenue, burn,
     unit economics) for each objective.
   - `:::handoff to: hr` — hiring slate KRs (roles closed, time-to-
     hire, retention) cascading from the objectives requiring team
     growth.
3. **Reassemble.** When all four contributors return KRs, you (CEO)
   audit the cascade for coherence — does each KR trace to a parent
   objective? Are there orphan KRs (team work without a company-level
   parent)? Are there orphan objectives (company-level statements
   with no team owning a KR)?
4. **Sign off.** The artifact lists every contributor; you own the
   final integration.

If a single role's KRs are missing, the OKR set is incomplete — do
not ship a partial cascade.

## Method

### 1. Pick 3–5 objectives (CEO)

Each objective is a **qualitative, time-bound, inspirational
statement**. It says where the team is going, not how to measure it.

- Good: "Make the platform the default agent runtime for sandboxed
  AI."
- Bad: "Hit $1M ARR." (that's a KR, not an objective)
- Bad: "Improve marketing." (no direction, no time-bind)

Limit: 3–5. More than 5 means nothing is the priority. Less than 3
usually means the operator is collapsing distinct surfaces.

### 2. For each objective, 3 key results (cascaded)

Every KR must satisfy three properties:

1. **Observable** — at the end of the quarter, an outsider can
   determine whether the KR was hit, without asking the operator.
2. **Time-bound** — has a date. "By end of Q3" is the floor.
3. **Numeric or binary** — has a number ($X ARR, N customers, P95
   latency < 300ms) or a binary outcome (shipped / not shipped, with
   a clear definition of shipped).

KRs that fail any of the three are not KRs — they are tasks or
intentions. Reject them. When auditing the cascade, reject any
KR a peer role returned that fails this test, and hand back to that
role for re-write.

### 3. Classify each objective: aspirational vs committed

- **Committed** — the team is on the hook for hitting these. Missing
  is a serious problem. Grade them at 0.7+ to call them shipped.
- **Aspirational** — the team is reaching. Hitting 0.7 is a strong
  outcome; hitting 1.0 is exceptional. These should feel
  uncomfortable when written.

A typical split is 70% committed, 30% aspirational. Pure committed
means the team is sandbagging; pure aspirational means the team has
no operational floor.

### 4. Cascade audit (CEO)

Each peer's KRs must trace to a parent objective. As CEO, walk the
cascade:

- **Coverage.** Every objective has at least one KR from at least
  one peer. An objective with zero contributing KRs is dead weight —
  drop the objective or extract a KR.
- **Coherence.** A team KR that does not trace to a company
  objective signals either unauthorized work or a missing company
  objective. Surface both.
- **Conflict.** If CMO's growth KR contradicts CFO Advisor's burn
  KR (e.g. "spend $X on paid" vs "burn ≤ $Y"), name the conflict
  and force resolution before sign-off — do not paper over it.
- **Honesty.** A peer's KR that's obviously sandbagged (a number
  the team will hit by doing nothing different) gets pushed back:
  "what would 0.7 look like if you actually reached?"

### 5. Mid-quarter check (week 6)

Grade each KR on the Doerr scale:

- **0.0** — no progress, abandoned, or invalidated.
- **0.3** — making progress but unlikely to hit by quarter-end.
- **0.7** — strong progress; on track to hit; shipped if committed.
- **1.0** — exceeded; rare; reserved for genuine over-delivery.

Mid-quarter is the window to **kill or escalate**, not to spin. A
KR graded 0.0 or 0.3 at week 6 either gets a credible recovery plan
(handed off to the owning role) or gets cut from the OKR set
entirely. Carrying dead KRs to quarter-end trains the team that
OKRs are theater.

## Common antipatterns (refuse these)

- **Sandbagged KRs** — numbers the team will hit by doing nothing
  different.
- **KPI-as-KR** — using a steady-state metric (uptime, NPS) as a KR
  when the team doesn't intend to change it. KPIs are dashboards;
  KRs require deliberate action.
- **OKR-as-task-list** — three KRs that are all "ship feature X."
  Tasks are how; KRs are what changed for the customer / business.
- **Too many** — 8 objectives, 30 KRs. The team will track the easy
  ones and quietly drop the rest. Force a cut.
- **No number** — "Improve developer experience." Reject. Replace
  with a measurable proxy.
- **Cascade gaps** — objectives with no contributing KRs from any
  role. Either drop the objective or extract a KR.

## Output shape

```
:::artifact
template: okr-design
quarter: <YYYY-Qn>
contributors: [ceo, cto, cmo, cfo-advisor, hr]
objectives:
  - id: O1
    statement: <ceo-authored>
    classification: committed | aspirational
    krs:
      - { id: O1.KR1, owner: cto, statement, target, measure }
      - { id: O1.KR2, owner: cmo, statement, target, measure }
      - { id: O1.KR3, owner: cfo-advisor, statement, target, measure }
mid-quarter-check-date: <YYYY-MM-DD>
:::
```

## Escalation

If the operator asks the CEO to **set** the OKRs (rather than help
design them), escalate. The operator owns the goals; the agent
sharpens them. Setting goals for the operator is the failure mode
this whole template prevents.

## Source

John Doerr, *Measure What Matters* (canonical OKR shape, grading
scale, aspirational vs committed split, cascading discipline). Andy
Grove, *High Output Management* (the original objectives + key
results frame at Intel). Multi-role cascade adapted for the
startup-team runtime.
