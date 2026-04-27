# Tech Debt Triage Template

## Purpose
Separate critical tech debt from cosmetic, prioritize by
impact-to-effort ratio, and produce a register the team will actually
work down — not a wishlist that grows forever.

## When to use
Trigger when the user is doing a debt-paydown sprint, debating
whether to refactor before shipping a feature, or noticing recurring
incident patterns tied to known weakness in the codebase.

## Definitions

- **Tech debt** = a known shortcut whose cost compounds over time. If
  it's "just code I don't like," that's taste, not debt.
- **Prudent vs reckless** (Cunningham): debt taken with awareness of
  the trade-off and a paydown plan is prudent; ad-hoc shortcuts with
  no plan are reckless.
- **Carrying cost** = velocity drag, bug rate, on-call burden,
  cognitive overhead for new joiners.

## Dimensions for scoring

- **Impact** (1–5): how much does this debt slow development,
  increase bug rate, or threaten reliability? Look at last 6 months
  of incidents and PRs touching the area.
- **Customer-facing risk** (1–5): can this cause a SEV1 outage, data
  loss, or compliance breach?
- **Spread / blast radius**: how many other systems depend on this?
  Tightly-coupled debt costs more.
- **Effort** (S/M/L/XL): rough estimate to address — including
  migration, rollout, and decommission of the old system.
- **Reversibility**: is the fix iterative (can ship in pieces) or
  one-way (big rewrite, hard to roll back)?

## Triage matrix

|              | Low Effort      | High Effort         |
|--------------|-----------------|---------------------|
| **High Impact**  | Do now (this sprint) | Plan a project: scope, owner, milestone, paydown over multiple sprints |
| **Low Impact**   | Bundle into ongoing work as opportunistic cleanups | Ignore unless impact rises |

Don't bother scoring "low impact, low effort" formally — just let
engineers fix them in passing PRs. Don't elevate "low impact, high
effort" to a project.

## Process

1. **Inventory.** Walk the codebase and the incident history. List
   each item with: location, one-line description, evidence
   (incident IDs, PR comments, on-call complaints), proposed fix.
2. **Score.** Impact × effort, customer-facing risk separately.
   Have at least two engineers calibrate together — solo scoring
   drifts.
3. **Cluster.** Many items often roll up to one root cause (e.g.,
   "no migration system" surfaces as 8 separate ticket entries).
   Treat the root cause as the project.
4. **Decide and write.** For each debt item, write the *cost of
   not fixing* in concrete terms: "this debt added 6 SEV2
   incidents in 2025 and a 30% slowdown on the auth area's PR
   cycle time."
5. **Allocate capacity.** Default 15–20% of each sprint to debt.
   Sustained 0% means accumulation, sustained 50% means feature
   velocity is gone — both are signals.
6. **Project-tier debt.** For high-impact / high-effort, build a
   real project plan: owner, milestones, paydown over 1–3
   quarters, definition of done, rollback plan. Track on the same
   review cadence as new features.
7. **Quarterly debt review.** Re-score the register. Items that
   haven't moved in 2+ quarters either land or get explicitly
   accepted as permanent ("this debt will live; we will not pay
   it down — risk acknowledged").

## Anti-patterns

1. **Big rewrite trap.** "Let's just rewrite it" is rarely cheaper
   than incremental refactor + strangler-fig migration.
2. **Cleanup-only sprints.** A full sprint with no user value
   delivered breaks team momentum and stakeholder trust.
3. **Hero refactors.** One engineer rewrites a system in isolation,
   leaves, no one else owns the new system. Worse than the original.
4. **Debt-by-vibe.** "I don't like this code" without evidence —
   not debt. Get incident, PR, or velocity data.
5. **Permanent acceptance unspoken.** Some debt the team will never
   pay down (legacy system staying for 3 years). Say so explicitly;
   stop scoring it every quarter.
6. **No DoD on debt items.** A refactor "ships" when the old code
   path is *removed*, not when the new code path is added. Without
   DoD-includes-decommission, debt fattens (both old and new live).

## Output

```
:::artifact
template: tech-debt-triage
register:
  - { id: "DEBT-12", area: "auth", impact: 5, effort: "L",
      risk: 4, evidence: ["INC-2024-007", "INC-2025-014"],
      proposal: "stranglers migration to new session store",
      decision: "project-Q2", owner: "auth-team" }
  - { id: "DEBT-22", area: "build", impact: 2, effort: "S",
      risk: 1, evidence: ["slow CI"], decision: "opportunistic" }
sprint-allocation: "18%"
```

## Refusal

The agent will not:
- Approve a "stop all features and pay debt" plan without explicit
  exec sign-off — that has business consequences beyond eng.
- Recommend hiding debt by closing tickets without fixing.
- Score debt without evidence; "feels bad" is not a score.
