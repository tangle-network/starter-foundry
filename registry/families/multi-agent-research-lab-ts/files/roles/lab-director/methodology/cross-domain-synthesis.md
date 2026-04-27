---
capability: cross-domain-synthesis
role: lab-director
status: active
source: hand-authored
retrieved: 2026-04-26
---

# Cross-Domain Synthesis

## Purpose

Aggregate the `:::contribution` blocks returned by the domain
researchers into a single `:::synthesis` block that the operator can
audit. Synthesis is the Director's most failure-prone job — the
common failure modes are **un-attributed claims**, **smoothed-over
contradictions**, and **dropped handoffs**. This methodology exists
to prevent each of them.

## Inputs

- The original operator question.
- The `:::artifact template: research-question-formulation` from
  intake.
- One `:::contribution` block per role that was dispatched or
  handed-off. (Including any `corpus did not surface a contribution`
  null contributions.)

## Output — the synthesis block

```
:::synthesis
question: [verbatim operator question]
formulated-as: [type, primary-domain, secondary-domains]
primary-role: [role-id]
contributing-roles: [list of role-ids who returned contributions]

Findings:
  1. [claim] [role: <role-id>, citation: <surname year>]
  2. [claim] [role: <role-id>, citation: <surname year>]
  ...

Contradictions resolved:
  - [name the disagreement] — [empirical crux that would resolve it,
    or "not resolvable from current corpus, would need <data type>"]

Unresolved questions (next-step delegation):
  - [role: <role-id>, future] [open question this role should pursue]

Confidence:
  - Findings 1, 2: high (multiple corroborating citations across
    roles).
  - Finding 3: medium (single citation, well-cited journal).
  - Finding 4: low (single preprint, no replication).
:::
```

## Step-by-step procedure

### Step 1 — confirm every dispatched / handed-off role replied

Walk the dispatch + handoff chain. Every `:::dispatch` and every
`:::handoff` must have a matching `:::contribution`. If a role is
silent, **stop synthesis** and re-dispatch with a clearer
sub-question. A synthesis that omits a role's contribution is silent
muffling.

### Step 2 — extract claims, attribute each one

For each `:::contribution`, extract the discrete claims. A claim is
the smallest unit you would want to defend in a peer review. Every
claim takes a `[role: <role-id>, citation: <surname year>]` tag.
Multiple citations per claim are fine; zero citations means the
claim is a hypothesis — move it to the unresolved-questions list.

### Step 3 — detect contradictions

Walk pairs of claims from different roles. A contradiction exists if:

- Two claims assign different values to the same observable (e.g.
  binding affinity 10 nM vs 100 nM).
- Two claims propose mutually exclusive mechanisms.
- One role's claim depends on a premise another role's claim
  refutes.

For each contradiction, name it explicitly and write the empirical
crux — the experiment or measurement that would resolve it. **Do
not** average the values or pick the more cited claim; the operator
needs to know the disagreement exists.

### Step 4 — confidence-tag each finding

For each finding, assign one of:

| Confidence | Trigger |
|---|---|
| **high** | Multiple citations from at least two roles, peer-reviewed primary literature, no contradictions. |
| **medium** | Single citation in peer-reviewed primary literature, no contradictions. |
| **low** | Preprint only, single citation, contradictions present, or one role disagreed. |

Confidence is for the operator's calibration, not for the Director to
hide behind. A "low" finding still ships if it answers the question
— but tagged.

### Step 5 — unresolved questions become next-step delegations

Any sub-question that remained unanswered, or any contradiction whose
crux requires a measurement the corpus does not contain, gets a
`[role: <role-id>, future]` tag. The role assigned is the one that
owns the corpus / methodology to pursue it next.

### Step 6 — sanity check

Before emitting, walk back through:

1. Every `:::contribution` is reflected in at least one finding or
   unresolved-question. (Nothing is dropped.)
2. Every finding has `[role: <id>, citation: <surname year>]`. (No
   floating claims.)
3. Every contradiction is named with an empirical crux. (No
   smoothing.)
4. Every escalation surfaced by a role is forwarded into the
   synthesis. (No quiet swallowing.)
5. The deliverable matches what the formulation asked for. (No
   off-spec ship.)

## Anti-patterns the methodology prevents

- **The smooth-but-wrong synthesis.** A synthesis that reads
  fluently but averages over two roles' disagreement. Step 3 +
  step 6 catch this.
- **The discipline-imperialist synthesis.** A synthesis that gives
  one role's claim authority over another's because that role
  "feels more rigorous". The role + citation tagging keeps every
  claim grounded; the contradiction step keeps every disagreement
  visible.
- **The dropped-handoff synthesis.** A synthesis that quietly omits
  a role whose contribution did not fit the narrative. Step 1 +
  step 6 (item 1) catch this.
- **The fabricated-citation synthesis.** A synthesis that invents a
  reference to bridge a gap. The contributions are the only
  citation source; the Director cannot author new citations.

## Source

Adapted from systematic-review synthesis methodology (PRISMA, GRADE
confidence assessment) and the "consilience" principle (Whewell, E.O.
Wilson) — converging evidence from independent disciplines is the
strongest claim a multi-domain lab can make, and naming the
non-converging disagreements is the second-strongest.
