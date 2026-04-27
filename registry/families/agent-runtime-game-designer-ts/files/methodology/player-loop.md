# Player Loop Design Template

## Overview
Design a player loop — the cycle of action → feedback → progression
that defines moment-to-moment play. A game has nested loops at
different time scales (seconds, minutes, hours, sessions, weeks);
this template handles one loop at a time.

## When to use
Trigger when the user is auditing the core loop, designing a new
secondary loop, or diagnosing why play feels flat. For one-off
mechanics, use mechanic-design.md instead.

## Loop scales (pick the scale)

- **Micro / second-level**: input → animation → feedback. ~0.1–2s.
  (Press jump, character lifts, lands.)
- **Encounter / minute-level**: enter → resolve → reward. ~1–5min.
  (Combat encounter, puzzle room, conversation.)
- **Session / hour-level**: goal-set → progress → success. ~30min–2h.
  (Quest chain, mission, level.)
- **Campaign / week-level**: meta-progression. ~10+ hours.
  (Skill tree fill, faction rep maxed, completion arc.)

The loops must nest: micro feedback should feed encounter outcome
should feed session goal should feed campaign progression. A loop
that doesn't feed up is decorative.

## Fields

- **Loop Name** and **Type** (core / secondary / meta).
- **Scale**: which time scale per the taxonomy above.
- **Action**: the verb the player performs.
- **Feedback**:
  - **Sensory**: VFX, SFX, animation, controller rumble — landing
    confirmation in milliseconds.
  - **Mechanical**: state change, score, resource gain.
  - **Narrative**: dialogue change, world flag flipped, NPC
    reaction.
- **Progression**: how the loop evolves with repetition.
  Difficulty curve, new content unlocked, new mechanics layered,
  new strategic options revealed.
- **Reward**: extrinsic (XP, loot, currency) and intrinsic
  (mastery, expression, fellowship). Pure-extrinsic loops burn
  out fast; pure-intrinsic loops attract a narrower audience.
- **Duration**: typical iteration time, with min/max bounds.
  Loops that exceed 2× expected duration usually have an
  embedded sub-problem.
- **Motivation hypothesis** (Self-Determination Theory):
  autonomy, competence, relatedness — name which the loop is
  optimized for. Most loops fail because they over-index on
  competence (challenge) without autonomy or relatedness.
- **Engagement metric**: completion rate, retention through
  loop, session length, return rate at next-day, churn point.
- **Failure / death state**: what happens when the player loses
  the loop. Ramp-up to recovery, time penalty, narrative
  reframe. Hostile failure states drive churn.
- **Trade-offs**: what this loop costs in attention, fatigue,
  cognitive load, or audience appeal.

## Example (worked)

- **Name**: Combat Loop
- **Type**: Core / encounter-scale
- **Scale**: minute-level (30s–2min per encounter)
- **Action**: engage with weapons + abilities; choose target,
  ability, position.
- **Feedback**:
  - Sensory: hit-flash, sound layered with crit, screen shake on
    heavy.
  - Mechanical: HP/resource bars, XP, loot drop.
  - Narrative: nearby NPCs react, faction rep ticks.
- **Progression**: enemies layer mechanics every 10 hours
  (basic → armored → elite shielded → ranged casters); player
  unlocks tools that counter each layer.
- **Reward**: XP (extrinsic), gear (extrinsic), mastery
  (intrinsic — combo discovery), expression (intrinsic — build
  variety).
- **Duration**: 30s easy, 90s standard, 3min boss.
- **Motivation**: competence (skill expression), autonomy
  (build choice). Relatedness via co-op variant.
- **Metric**: encounters per session (target ≥8), completion
  rate ≥85% on standard difficulty, return-to-combat rate
  next session ≥70%.
- **Failure**: respawn at last checkpoint, no XP loss, retry
  the encounter.
- **Trade-offs**: combat-heavy alienates narrative-focused
  players; mitigated by skip / lower-difficulty options.

## Common loop failures

1. **No feedback hierarchy.** Big and small wins feel the same;
   players stop reading the signal.
2. **Loop too long.** A 7-minute "core" loop is actually a
   session goal, not a core loop. Shorten or recategorize.
3. **Reward inflation.** Every encounter rewards loot →
   meaningless. Stratify rewards (most encounters = currency,
   some = uniques).
4. **Punitive failure.** Death state takes 5 minutes to recover
   → players avoid risk → loop becomes stale.
5. **Loop doesn't nest.** The encounter doesn't feed a session
   goal; players don't see why they're doing it.
6. **One motivator only.** Pure-competence loops are exhausting;
   pure-autonomy loops can lack stakes; pure-relatedness loops
   need infrastructure (chat, party, guild).

## Designing the difficulty curve

The loop's progression is its difficulty curve. Use:
- **Flow-channel** model (Csikszentmihalyi): challenge slightly
  above skill. Below = boredom; above = anxiety.
- **Difficulty tiers** with player choice. Don't punish lower
  difficulty; reward exploration.
- **Failure-recovery time** as a difficulty axis distinct from
  challenge intensity.

## Output

```
:::artifact
template: player-loop
loop:
  name: "..."
  type: "core" | "secondary" | "meta"
  scale: "encounter"
  action: "..."
  feedback: { sensory: ..., mechanical: ..., narrative: ... }
  progression: "..."
  reward: { extrinsic: [...], intrinsic: [...] }
  duration-target: { min: ..., median: ..., max: ... }
  motivation: ["competence", "autonomy"]
  metric: { ... }
  failure-state: "..."
  trade-offs: [...]
:::
```

## Refusal

- The agent will not approve a loop without a metric or a
  duration target.
- The agent will not approve a loop whose extrinsic rewards
  scale faster than its content can sustain (treadmill warning).
