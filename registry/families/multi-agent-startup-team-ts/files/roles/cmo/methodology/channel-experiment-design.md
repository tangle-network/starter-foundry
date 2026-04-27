---
capability: channel-experiment-design
status: active
source: hand-authored, synthesized from Weinberg & Mares (Traction) + Croll & Yoskovitz (Lean Analytics) + standard A/B-test rigor
retrieved: 2026-04-26
---

# Channel Experiment Design (CMO-led, CFO-priced)

The methodology for designing growth experiments that actually
teach something. Most channel "tests" fail not because the channel
was wrong but because the test was unfalsifiable — no hypothesis,
no primary metric, no kill criterion, no decision rule. This
template forces the shape that makes results readable.

## When to use

- Operator wants to "try" a new channel (paid social, SEO,
  partnerships, outbound, community, events).
- A channel that worked has plateaued and the team is tempted to
  "do more" of the same.
- Resource allocation across channels needs a decision, not a vibe.
- A vendor pitch promises a number and the operator needs to know
  whether the number is reproducible.
- CFO Advisor flags rising CAC without rising LTV — that's a
  channel-quality regression masquerading as a budget problem.

## Multi-role contributions

| Section | Contributor |
|---|---|
| Channel selection, hypothesis, audience, primary metric, kill criterion | CMO |
| Budget approval, CAC math, payback period, contribution margin under win-case | CFO Advisor (mandatory handoff before launch if budget > 1% of monthly burn) |
| Capability check ("does the funnel handle this volume") | CTO (handoff if the experiment depends on infra, e.g. surge load to a landing page) |
| Strategic fit ("does the channel match the company's bet") | CEO (handoff if the channel implies a market shift) |

The hard rule: **no channel experiment with a non-trivial budget
launches without CFO Advisor pricing it.** "Non-trivial" defaults
to >1% of monthly burn; the operator can adjust the threshold but
not the rule.

## Method

**1. Name the bullseye channel.** Traction frame: there are ~19
channels (SEO, SEM, social ads, content, email, viral, engineering-
as-marketing, partnerships, sales, affiliate, existing platforms,
trade shows, offline events, speaking, community, PR, unconventional
PR, business development, sales). Pick ONE for the experiment.
Tests that mix channels can't attribute outcomes.

**2. Write the hypothesis as a sentence.** Format:

"If we [action] for [audience] via [channel], then [primary
metric] will improve by [magnitude] within [time window], because
[mechanism]."

If any slot is fuzzy, the experiment can't fail readably. Sharpen
until every slot is concrete.

**3. Pick the primary metric.** ONE metric. Pirate-funnel stage
(AARRR: acquisition / activation / retention / revenue / referral)
must be named explicitly — the metric must measure the *bottleneck
stage*, not the easiest-to-measure one. Vanity metrics
(impressions, clicks, "engagement") are banned unless the
hypothesis is specifically about top-of-funnel awareness.

**4. Estimate sample size.** Even rough: how many trials / users /
impressions does the test need to detect the hypothesized effect?
Use baseline conversion × MDE × power as a proxy. If sample-size
to detection exceeds the operator's budget or patience, the
experiment is unrunnable — kill it now or change the design.

**5. Set the kill criterion.** Before running. Format: "We kill
this test if [metric] is [worse than X] after [Y trials / Z days],
whichever comes first." A kill criterion the team can't articulate
is a kill criterion that will be rationalized away when results
arrive.

**6. Hand off to CFO Advisor for pricing.** Required when budget
> 1% of monthly burn. Wait for CAC, payback, and margin numbers
before finalizing the artifact. If CFO returns "payback > 18
months on the win-case," the experiment fails its economics check
and the design changes — do not paper over.

**7. Define the next-step rules.** Two branches: if the test wins,
what's the immediate scale-up plan and what's the new ceiling
check? If it loses, what does the loss tell you about the
*channel* vs the *creative* vs the *audience*? Pre-commit
interpretation rules so post-hoc storytelling doesn't override
the data.

## Output

```
:::artifact
template: channel-experiment
date: <YYYY-MM-DD>
contributors: [cmo, cfo-advisor, cto?]
channel: <one of the 19>
hypothesis: <sentence form, all slots concrete>
audience: <segment, with size estimate>
primary-metric: <metric + AARRR funnel stage>
baseline: <current value>
mde: <minimum detectable effect>
sample-size: <trials needed>
duration: <time bound>
kill-criterion: <pre-committed>
budget:
  dollars: <usd>
  hours: <eng + marketing hours>
  pct-of-monthly-burn: <calculated by cfo-advisor>
cfo-pricing:
  expected-cac-win-case: <usd>
  payback-months-win-case: <int>
  margin-impact: <prose>
  go-no-go: green | yellow | red
win-action: <scale-up plan + new ceiling check>
loss-action: <what the loss tells us — channel vs creative vs audience>
:::
```

## Discipline rules

- Refuse to design experiments where the primary metric is
  "engagement", "awareness", or "buzz" without a precise
  definition.
- Refuse to design tests with budgets too small to reach
  detection. Underpowered tests waste money to produce noise.
- One channel per experiment. Cross-channel attribution is a
  separate problem and not solvable with the test the operator is
  asking for.
- Pre-commit kill criterion in writing. Verbal kill criteria don't
  bind.
- After every experiment, force a written readout (3 bullets max:
  what we tested, what we learned, what we do next). Experiments
  without readouts compound into noise.
- A "red" CFO go/no-go kills the experiment as designed; either
  re-design with a smaller budget / tighter audience or shelve.

## Escalation

- Vendor or platform requires regulatory disclosures (e.g. FTC
  endorsement guidelines, SEC for any token / security context) —
  emit `:::escalation` to outside counsel.
- Channel involves protected categories (e.g. ad-targeting in
  housing / employment / credit verticals where it's restricted) —
  emit `:::escalation`; do not design in this surface without
  legal sign-off.

## Source

Gabriel Weinberg & Justin Mares, *Traction* (the 19-channel
framework, bullseye method). Alistair Croll & Benjamin Yoskovitz,
*Lean Analytics* (one-metric-that-matters discipline, AARRR funnel).
Standard A/B testing rigor (baseline × MDE × power for sample
size). Multi-role pricing adapted for the startup-team runtime.
