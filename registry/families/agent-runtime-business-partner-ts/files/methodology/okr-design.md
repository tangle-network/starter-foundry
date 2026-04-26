---
capability: okr-design
status: active
source: hand-authored
retrieved: 2026-04-25
---

# OKR Design

An OKR design session produces a `:::artifact` block tagged
`template: okr-design` containing 3–5 objectives, each with 3 key
results, classified as **aspirational** or **committed**, with a
mid-quarter check rubric and explicit cascading from company → team →
individual.

OKRs are a **focusing tool**, not a tracking tool. The output is a
short list the operator can recite from memory; if it cannot be
recited, it is too long.

## When to use

- Quarter boundary (week before quarter starts, or first week if
  carrying forward).
- After a strategy shift (fundraise, pivot, major hire) that
  invalidates the current set.
- When the operator says "let's set OKRs", "what should our goals
  be", "how do I measure progress on X".

## Method

### 1. Pick 3–5 objectives

Each objective is a **qualitative, time-bound, inspirational
statement**. It says where the team is going, not how to measure it.

- Good: "Make Tangle the default agent runtime for sandboxed AI."
- Bad: "Hit $1M ARR." (that's a KR, not an objective)
- Bad: "Improve marketing." (no direction, no time-bind)

Limit: 3–5. More than 5 means nothing is the priority. Less than 3
usually means the operator is collapsing distinct surfaces.

### 2. For each objective, write 3 key results

Every KR must satisfy three properties:

1. **Observable** — at the end of the quarter, an outsider can
   determine whether the KR was hit, without asking the operator.
2. **Time-bound** — has a date. "By end of Q3" is the floor.
3. **Numeric or binary** — has a number ($X ARR, N customers, P95
   latency < 300ms) or a binary outcome (shipped / not shipped, with
   a clear definition of shipped).

KRs that fail any of the three are not KRs — they are tasks or
intentions. Reject them.

### 3. Classify each objective: aspirational vs committed

- **Committed** — the team is on the hook for hitting these. Missing
  is a serious problem. Grade them at 0.7+ to call them shipped.
- **Aspirational** — the team is reaching. Hitting 0.7 is a strong
  outcome; hitting 1.0 is exceptional. These should feel
  uncomfortable when written.

A typical split is 70% committed, 30% aspirational. Pure committed
means the team is sandbagging; pure aspirational means the team has
no operational floor.

### 4. Cascade

Company OKRs → team OKRs → individual OKRs. Each level's objectives
must trace to a parent KR or objective at the level above. If a team
OKR has no company-level parent, either the team is doing
unauthorized work or the company OKRs are missing a surface.

Cascading is **not** decomposing — a team's KRs are not just slices
of the company KRs. The team's KRs answer "what does my team need to
deliver such that the company KR can be hit?"

### 5. Mid-quarter check (week 6)

Grade each KR on the Doerr scale:

- **0.0** — no progress, abandoned, or invalidated.
- **0.3** — making progress but unlikely to hit by quarter-end.
- **0.7** — strong progress; on track to hit; shipped if committed.
- **1.0** — exceeded; rare; reserved for genuine over-delivery.

Mid-quarter is the window to **kill or escalate**, not to spin. A KR
graded 0.0 or 0.3 at week 6 either gets a credible recovery plan or
gets cut from the OKR set entirely. Carrying dead KRs to quarter-end
trains the team that OKRs are theater.

## Common antipatterns (refuse these)

- **Sandbagged KRs** — numbers the team will hit by doing nothing
  different. Push back: "What would 0.7 look like if we actually
  reached?"
- **KPI-as-KR** — using a steady-state metric (uptime, NPS) as a KR
  when the team doesn't intend to change it. KPIs are dashboards;
  KRs require deliberate action.
- **OKR-as-task-list** — three KRs that are all "ship feature X."
  Tasks are how; KRs are what changed for the customer / business.
- **Too many** — 8 objectives, 30 KRs. The team will track the easy
  ones and quietly drop the rest. Force a cut.
- **No number** — "Improve developer experience." Reject. Replace
  with a measurable proxy (P50 time-to-first-deploy, NPS from
  internal devs, etc.).

## Output shape

Wrap the entire OKR set in a `:::artifact` block tagged
`template: okr-design`, dated, with quarter named, objectives
numbered, KRs lettered, aspirational vs committed flagged on each
objective.

## Escalation

If the operator asks the agent to **set** the OKRs (rather than
help design them), escalate. The operator owns the goals; the agent
sharpens them. Setting goals for the operator is the failure mode
this whole template prevents.

## Source

John Doerr, *Measure What Matters* (canonical OKR shape, grading
scale, aspirational vs committed split, cascading discipline). Andy
Grove, *High Output Management* (the original objectives + key
results frame at Intel). Adapted with antipattern list drawn from
public OKR retrospectives at Google, LinkedIn, and Intuit.
