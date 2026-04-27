---
capability: tech-debt-triage
status: active
source: hand-authored, drawn from Ward Cunningham (debt metaphor) + Fowler (refactoring) + cost-of-delay
retrieved: 2026-04-26
---

# Tech-Debt Triage (CTO-owned, CFO-priced)

A tech-debt triage produces a `:::artifact` block tagged
`template: tech-debt-triage` containing a scored register, a
quadrant placement, and a sprint allocation recommendation. Items
with material dollar cost get handed off to CFO Advisor for
payback math before they enter the register.

The point is to separate **debt that's slowing the business** from
**debt that's annoying the engineers**. Both are real; only the
first earns sprint time on its own merits.

## When to use

- Quarterly debt review. Rolls into OKR planning.
- After a major incident — the post-mortem will surface 2–5 debt
  items; route them through this template, do not just paste them
  into the backlog.
- When the team starts saying "we can't ship X because of Y" — Y
  is the debt; triage it before agreeing to a refactor sprint.
- When CFO Advisor flags rising infra spend without rising usage —
  hidden debt with a real dollar cost.

## Multi-role contributions

| Source | Contribution |
|---|---|
| CTO | inventory, impact-on-delivery, effort estimate |
| CFO Advisor | dollar cost (infra, cycle-time tax, opportunity cost) |
| CMO | customer-impact estimate (if the debt is user-visible: latency, errors, missing capability) |
| CEO | strategic priority weighting (does paying this debt unlock a strategic bet?) |

Each item starts CTO-only. **Hand off to CFO Advisor** when the
estimated dollar cost is non-trivial (>$5k/month infra, or
significant cycle-time tax across the team). **Hand off to CMO**
when customers can see it.

## Dimensions (score each item)

- **Impact (1–5)** — How much does this debt slow development,
  increase bugs, or reduce reliability? 1 = "annoys one engineer
  occasionally," 5 = "blocks the next planned feature."
- **Value (1–5)** — How much business value is unlocked by paying
  it down? 1 = "internal hygiene," 5 = "unblocks a customer
  commitment or revenue line."
- **Effort (S/M/L)** — Engineering time to fix. S ≤ 1 sprint, M = 1–2
  sprints, L = > 2 sprints (decompose).
- **Dollar cost (CFO-supplied, monthly)** — only filled when CFO
  Advisor has run the number. Empty otherwise.

## Quadrant placement

|  | High Value | Low Value |
|---|---|---|
| **High Impact** | **Do now** — schedule next sprint, allocate ≥ 20% capacity until burned down | **Schedule** — quarterly slot; do not let it grow |
| **Low Impact** | **Defer** — keep on register, revisit at the next quarter | **Ignore** — close the issue; do not back-burner forever |

A High-Impact + Low-Value item with a high CFO-supplied dollar cost
escalates to High-Value automatically — money the company is paying
to host debt is value.

## Allocation rule

- **10–20% of sprint capacity** to debt is healthy. Less starves
  the codebase; more starves features.
- **Never let debt exceed 30% of the open backlog** without an
  explicit decision-journal entry from the CEO. A backlog that's
  60% debt is a refactor sprint disguised as a backlog.
- **Refactor sprints are escalations, not defaults.** A full sprint
  off features requires a CEO sign-off via decision-journal because
  the opportunity cost is real and the operator owns it.

## Common antipatterns (refuse these)

- **"Refactor the entire X."** Decompose to L items at most; refuse
  to register a debt item that's bigger than 2 sprints without
  decomposition.
- **"It's annoying."** Annoyance ≠ impact. Push back; ask what
  delivery / reliability / cost outcome it produces.
- **"This is what I'd do if I were starting over."** Greenfield
  fantasy is not debt; it's preference. Debt is "code that costs us
  more to live with than to fix."
- **"It's blocking nothing right now but it will."** Forecast debt
  is real but lower-priority than shipped debt. Score it Low Impact
  until something it touches is on the next quarter's roadmap.
- **CFO-priced item used to override CTO judgment.** A high dollar
  cost is a strong signal but not a vote — CTO retains the
  technical-feasibility call.

## Output shape

```
:::artifact
template: tech-debt-triage
date: <YYYY-MM-DD>
contributors: [cto, cfo-advisor?, cmo?]
register:
  - id: TD-001
    title: <one line>
    description: <what's the debt, where does it live>
    impact: <1-5>
    value: <1-5>
    effort: S | M | L
    dollar-cost-monthly: <usd or null>
    quadrant: do-now | schedule | defer | ignore
    customer-visible: yes | no
    proposed-sprint: <YYYY-Wnn or null>
sprint-allocation:
  this-sprint-pct: <10-20>
  this-sprint-items: [<id>]
  decision-journal-required: yes | no
:::
```

## Escalation

- A debt item that requires a full refactor sprint → emit
  `:::handoff to: ceo` for a decision-journal entry. CEO + you
  weigh the opportunity cost.
- A debt item with material dollar cost where CTO and CFO Advisor
  disagree on the fix → emit `:::handoff to: ceo` for the call;
  do not paper over the disagreement.

## Source

Ward Cunningham (1992 debt metaphor — "shipping first-time code is
like going into debt"). Martin Fowler, *Refactoring* (catalog of
refactor moves, the "make the change easy then make the easy
change" rule). Cost-of-delay literature (Reinertsen, *Principles of
Product Development Flow*). Multi-role pricing adapted for the
startup-team runtime.
