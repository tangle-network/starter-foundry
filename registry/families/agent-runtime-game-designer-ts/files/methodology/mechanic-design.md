# Mechanic Design Template

## Overview
Design a single game mechanic with explicit MDA grounding (Mechanics
→ Dynamics → Aesthetics, Hunicke / LeBlanc / Zubek 2004), a
falsifiable player-behavior hypothesis, and a measurement plan. The
output is a doc the team can build, playtest, and validate.

## When to use
Trigger when the user is adding a new verb to the game, replacing a
weak existing verb, or auditing whether an existing mechanic earns
its complexity. Not for level-design ("which encounter goes here") —
route to player-loop.md or narrative-system.md.

## Fields (required for every mechanic)

- **Name**: short, evocative, unambiguous.
- **Core interaction**: the input → output loop in one sentence.
  "Hold L2 to aim, R2 to fire grapple at locked target."
- **Rules** (formal): the constraints. Range, cooldown, resource
  cost, allowed targets, failure conditions, interactions with
  other systems.
- **Dynamics**: the emergent behavior the rules produce. "Players
  chain grapple → boost → grapple to skip terrain entirely."
- **Aesthetics**: the targeted feeling. Use the MDA aesthetics
  taxonomy (Sensation, Fantasy, Narrative, Challenge, Fellowship,
  Discovery, Expression, Submission) — pick 1–3, prioritized.
- **Player-behavior hypothesis** (falsifiable): "Players will use
  the grapple at least once per encounter to bypass enemies." This
  must be measurable in playtest.
- **Anti-hypothesis**: what would falsify the design. "If
  <60% of players use it, the mechanic is failing." State the
  threshold *before* playtest.
- **Metric**: usage rate per minute / per encounter, time-to-first-
  use, retention through tutorial, kill-rate vs alternative,
  variance across player skill levels.
- **Complexity cost**: input complexity (button count, timing
  window), cognitive load (rules to remember), system interaction
  surface (which other systems break if this changes).
- **Trade-offs**: what this mechanic *removes* or *trivializes*.
  Every new verb closes off design space elsewhere — name what.
- **Onboarding plan**: how the player first encounters and learns
  the mechanic. Tutorial level / tooltip / contextual prompt /
  emergent. Specify where in the critical path it lands.
- **Failure modes**: how the mechanic feels bad. Examples: "stuck
  mid-air with no input" → mitigate by ground-cancel button.

## Example (worked)

- **Name**: Grappling Hook
- **Core interaction**: aim with right stick; press R2 within 8m of
  a marked anchor to launch toward it.
- **Rules**: only orange/glowing surfaces accept the hook; cooldown
  1.5s on miss, 0.5s on hit; preserves momentum on release;
  cancellable mid-flight with jump.
- **Dynamics**: vertical traversal becomes legible; players chain
  grapple → wall-run; combat encounters open up if the encounter
  designer places anchors near enemies.
- **Aesthetics** (priority order): Sensation (kinetic flow);
  Mastery / Challenge (timing and aim); Discovery (anchors as
  hidden secret-finder).
- **Hypothesis**: ≥70% of players use grapple ≥3×/min in open
  zones; mean traversal time drops 22% vs without grapple.
- **Anti-hypothesis**: <50% usage in open zones → mechanic isn't
  affording the loop the level designers expect; redesign anchor
  placement or input scheme.
- **Metric**: telemetry on grapple-fire events, anchor-hit rate,
  player path length vs golden-path length.
- **Complexity cost**: medium. New input, new affordance to
  recognize, interacts with camera and momentum systems.
- **Trade-offs**: trivializes most non-combat platforming; combat
  designers must place "no-anchor" zones around fights you want to
  feel grounded.

## Failure modes seen in playtest

1. **Mechanic added, never used.** Onboarding doesn't surface it.
   Fix: forced-use moment in tutorial, then optional thereafter.
2. **Mechanic dominates.** Trivializes other verbs. Fix: cooldown,
   resource cost, or contextual restriction.
3. **Mechanic feels bad.** Input window too tight, animation too
   long, momentum loss feels arbitrary. Fix: tighten the input
   window iteratively in playtest.
4. **Mechanic doesn't combo.** No interaction with other verbs.
   Fix: write the synergy explicitly into the rules (grapple +
   boost = chained launch).

## Discipline rules

- **Don't ship without measurement.** A mechanic without a metric
  is design by vibes. Even simple telemetry (event count) lets
  the designer learn.
- **Hypotheses are falsifiable.** "Players will love it" is not a
  hypothesis; "≥70% use it ≥3×/min" is.
- **Cut before adding.** Adding a new verb without removing or
  pruning an existing one bloats the input model.

## Output block

Wrap in `:::artifact` with `template: mechanic-design`. Include all
fields; missing fields are tracked as `unknown`, not silently
dropped.

## Refusal

- The agent will not approve a mechanic without a stated hypothesis
  and metric.
- The agent will not approve a mechanic that is trivially
  dominant over an existing verb without a deprecation plan for
  the existing verb.
