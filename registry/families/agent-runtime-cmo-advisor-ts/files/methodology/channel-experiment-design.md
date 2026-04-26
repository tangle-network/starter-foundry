---
capability: channel-experiment-design
status: active
source: hand-authored, synthesized from Weinberg & Mares (Traction), Croll & Yoskovitz (Lean Analytics), standard A/B-test rigor
retrieved: 2026-04-25
---

# Channel Experiment Design

The methodology for designing growth experiments that actually teach
something. Most channel "tests" fail not because the channel was wrong
but because the test was unfalsifiable — no hypothesis, no primary
metric, no kill criterion, no decision rule. This template forces the
shape that makes results readable.

## When to use

- Operator wants to "try" a new channel (paid social, SEO, partnerships,
  outbound, community, events)
- A channel that worked has plateaued and the team is tempted to "do
  more" of the same
- Resource allocation across channels needs a decision, not a vibe
- A vendor pitch promises a number and you need to know whether the
  number is reproducible

## Method

**1. Name the bullseye channel.** Traction frame: there are ~19
channels (SEO, SEM, social ads, content, email, viral, engineering-as-
marketing, partnerships, sales, affiliate, existing platforms, trade
shows, offline events, speaking, community, PR, unconventional PR,
business development, sales). Pick ONE for the experiment. Tests that
mix channels can't attribute outcomes.

**2. Write the hypothesis as a sentence.** Format:
"If we [action] for [audience] via [channel], then [primary metric]
will improve by [magnitude] within [time window], because [mechanism]."

If any slot is fuzzy, the experiment can't fail readably. Sharpen
until every slot is concrete.

**3. Pick the primary metric.** ONE metric. Pirate-funnel stage
(AARRR: acquisition / activation / retention / revenue / referral)
must be named explicitly — the metric must measure the *bottleneck
stage*, not the easiest-to-measure one. Vanity metrics (impressions,
clicks, "engagement") are banned unless the hypothesis is specifically
about top-of-funnel awareness.

**4. Estimate sample size.** Even rough: how many trials / users /
impressions does the test need to detect the hypothesized effect?
Use baseline conversion × MDE × power as a proxy. If sample-size to
detection exceeds the operator's budget or patience, the experiment
is unrunnable — kill it now or change the design.

**5. Set the kill criterion.** Before running. Format: "We kill this
test if [metric] is [worse than X] after [Y trials / Z days],
whichever comes first." A kill criterion the team can't articulate
is a kill criterion that will be rationalized away when results
arrive.

**6. Define the next-step rules.** Two branches: if the test wins,
what's the immediate scale-up plan and what's the new ceiling check?
If it loses, what does the loss tell you about the *channel* vs the
*creative* vs the *audience*? Pre-commit interpretation rules so
post-hoc storytelling doesn't override the data.

## Output

Emit a `:::artifact` block with the experiment plan:

```
:::artifact
type: channel-experiment
channel: <one of the 19>
hypothesis: <sentence form, all slots concrete>
audience: <segment, with size estimate>
primary-metric: <metric + funnel stage>
baseline: <current value>
mde: <minimum detectable effect>
sample-size: <trials needed>
duration: <time bound>
kill-criterion: <pre-committed>
budget: <dollars + hours>
win-action: <scale-up plan>
loss-action: <what we learned, what we try next>
:::
```

## Discipline rules

- Refuse to design experiments where the primary metric is
  "engagement", "awareness", or "buzz" without a precise definition.
- Refuse to design tests with budgets too small to reach detection.
  Underpowered tests waste money to produce noise.
- One channel per experiment. Cross-channel attribution is a separate
  problem and not solvable with the test the operator is asking for.
- Pre-commit kill criterion in writing. Verbal kill criteria don't
  bind.
- After every experiment, force a written readout (3 bullets max:
  what we tested, what we learned, what we do next). Experiments
  without readouts compound into noise.
