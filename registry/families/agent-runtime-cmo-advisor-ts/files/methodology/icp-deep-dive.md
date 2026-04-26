---
capability: icp-research
status: active
source: hand-authored, synthesized from Christensen (JTBD), Klement (When Coffee and Kale Compete), Cooper (problem-interview methodology)
retrieved: 2026-04-25
---

# ICP Deep-Dive

The methodology for discovering who the ideal customer actually is —
as a person with a forced-buy trigger, not a TAM slide. ICP work is
the most-skipped, highest-leverage exercise in marketing. Skip it and
every downstream decision (positioning, channel, pricing, messaging)
runs on assumed users that may not exist.

## When to use

- Pre-positioning: you can't pressure-test positioning without an ICP
- Conversion is broken and you suspect the channel is reaching the
  wrong people
- Sales cycles are long, won deals look unalike, and lost deals look
  unalike — no pattern is forming
- A new market is on the table and the team is debating whether to
  enter

## Method

**1. List 10 actual closed-won customers.** Real names, real
companies, real people. If you have fewer than 10, list everyone.
If you have zero, this template doesn't apply yet — run a problem
interview pass first.

**2. Extract the forced-buy trigger.** For each customer, what
*specifically* happened in their world the week before they bought?
A new hire? A funding round? A regulatory deadline? A competitor
acquisition? A failed quarter? The trigger is the event that turned
"interesting" into "must solve now". No trigger, no urgency, no buy.
Customers without a clear trigger are tellingly hard to find — most
were the trigger themselves (the buyer just got promoted, etc).

**3. Frame the Job-to-be-Done.** Christensen frame: customers don't
buy products, they hire products to do a job. State the job as a
verb-phrase not a feature: "Get the board off my back about pipeline
visibility" not "buy a CRM dashboard". The job has functional,
emotional, and social dimensions — capture all three. Most marketing
collapses the JTBD to functional and loses the emotional + social
hooks that drive choice.

**4. Find the cluster.** With 10 cases mapped to (trigger × JTBD ×
person), what cluster has the most cases? That cluster is your
provisional ICP. Outliers are interesting but not the ICP — resist
the temptation to design for the most enthusiastic customer if they
are not the most representative.

**5. Probe willingness-to-pay.** For the cluster, what was the budget
authority of the buyer, what was the comparable expense they
dis-funded to fund you, and what was the price elasticity (would
they have paid 2x? 0.5x?). WTP probes are awkward — ask anyway.
Pricing is a positioning lever and you can't pull it without this.

**6. Write the ICP profile.** One paragraph. Person, role, company
shape, trigger, job, and what they were doing the week they decided
to buy. If the profile reads like a buyer persona slide, it's wrong.
It should read like a character description in a short story.

## Output

Emit a `:::artifact` block:

```
:::artifact
type: icp-profile
person: <role + seniority + tenure>
company: <stage, vertical, headcount, geography>
trigger: <event that forced the buy>
jtbd: { functional: ..., emotional: ..., social: ... }
budget-authority: <who signs, what range>
displaced-spend: <what they stopped funding to fund you>
disqualifiers: [<signals this isn't the ICP>]
recruitment-channel: <where this person is reachable>
:::
```

Follow with a `:::analysis` naming the two riskiest assumptions in
the profile — the ones cheap to test before building positioning
on top of them.

## Discipline rules

- Refuse to invent ICP profiles from imagined buyers. If the user
  has no closed-won data, run a problem-interview pass instead and
  call the output a "hypothesized ICP" with explicit `unverified:
  true` flag.
- Personas without triggers are useless. "VP of Sales at a 200-person
  SaaS company" is not an ICP — what made *that VP* buy *this week*?
- Disqualifiers are as important as qualifiers. Name what looks like
  the ICP but isn't (lookalikes that don't convert).
- Recruitment-channel is mandatory. An ICP you can't reach is a
  thought experiment, not a market.
