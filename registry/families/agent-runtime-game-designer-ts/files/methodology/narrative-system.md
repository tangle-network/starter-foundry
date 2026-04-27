# Narrative System Design Template

## Overview
Design a narrative system — the structure that turns scripted content
into a player-driven story. Branching dialogue, faction reputation,
emergent narrative, environmental storytelling, persistent world
state. The output is a system the writers, designers, and engineers
can build against.

## When to use
Trigger when the user is designing a story-delivery system rather
than authoring a single scene. For scene-level dialogue, route to a
writing or screenwriter bundle.

## Fields

- **System Name**: short and descriptive.
- **Narrative Core**: the engine. One of:
  - **Linear with side content** — main plot fixed, side content
    optional.
  - **Branching plot** — major story diverges; finite branches
    converge or fan out to distinct endings.
  - **Choice-and-consequence** — choices reshape later content
    (encounters, dialogue, NPCs alive/dead).
  - **Emergent narrative** — story is told by simulation; no
    authored plot (e.g., Dwarf Fortress).
  - **Faction / reputation** — player standing with groups gates
    content.
  - **Environmental** — story told via world state, not dialogue.
- **Player agency surface**: what the player can affect and at
  what scope (scene, arc, ending, world state, NPC fates).
- **Branching structure**: tree, web, time-gated, threshold-based,
  hub-and-spoke. Estimate authored content count
  (scenes / dialogue lines / endings) for each branch — this is
  where systems blow up the budget.
- **State model**: what variables the narrative system tracks
  (faction standing, world flags, NPC alive/dead, item ownership,
  character relationships). The state model is a database schema —
  treat it like one.
- **Consequence visibility**: how the player learns their choice
  mattered. Immediate (UI ping, dialogue change), short-term (next
  quest), long-term (ending). Latent consequences must surface
  somewhere or the player won't perceive agency.
- **Tone & theme**: pick 2–3 thematic anchors (loyalty, power,
  loss, identity). The system should make these legible through
  mechanics, not just dialogue.
- **Character roles**: name the structural roles (mentor, foil,
  rival, witness, betrayer). NPCs without a role are noise.
- **Pacing**: how narrative beats interleave with play. Density
  curve over the campaign.
- **Replay / new-game-plus**: what carries forward, what resets.
  Important for choice-and-consequence systems where the player
  wants to see the road not taken.
- **Trade-offs**: development cost (writers, VO, localization),
  testability (combinatorial branch coverage), player confusion
  (legibility of state), missability of authored content.

## Example (worked)

- **Name**: Faction Reputation
- **Narrative Core**: choice-and-consequence layered on faction
  reputation.
- **Agency surface**: standing with 3 factions changes available
  quests, available allies in combat, ending text.
- **Branching structure**: reputation has 5 bands per faction
  (-2 enemy, -1 hostile, 0 neutral, +1 friendly, +2 allied). Quest
  chains gate at each transition. 3 endings × 3 factions = 9
  ending-text variants; combat allies vary at runtime per
  reputation.
- **State model**: `{factionA: int, factionB: int, factionC: int,
  flags: {...}}`. Reputation updates ledgered (every change has a
  source quest + reason).
- **Consequence visibility**: immediate UI banner on reputation
  change ("Faction X: now Hostile"); short-term: NPC dialogue
  greetings shift each band; long-term: ending stitches faction
  states together.
- **Tone**: political intrigue, moral ambiguity — no faction is
  unambiguously good.
- **Character roles**: faction leaders as quest-givers + foils;
  shared neutral characters as witnesses to player choice.
- **Pacing**: ~1 reputation-relevant choice per 90 minutes of
  gameplay; 3 hard "you cannot please everyone" forks across the
  campaign.
- **Replay**: standalone factionAllied playthroughs unlock
  faction-specific epilogues.
- **Trade-offs**: 3× ending content; QA cost for cross-product of
  faction states; player confusion if reputation isn't surfaced.

## Designing the state model

A narrative system's state model is the single biggest determinant
of testability. Rules:

1. **Minimize state.** Each tracked variable doubles testing cost.
   If a variable doesn't gate visible content, it's vestigial.
2. **Make state legible.** A debug/cheat UI showing every flag
   helps QA + designers + speedrunners.
3. **Avoid hidden silent flags.** A flag set in scene 4 that
   changes scene 19 with no visible thread between them frustrates
   the player.
4. **Author for the most-likely path first.** Most players follow
   one branch; over-authoring rare branches is wasted effort.
   Track engagement metrics in playtest, expand authored content
   where players actually go.

## Common narrative-system failures

1. **Branch explosion.** Every choice doubles the tree; budget
   blows up. Use convergent design (branches reconverge) or
   threshold gating instead of pure branching.
2. **Fake choice.** All choices lead to the same outcome with
   minor cosmetic difference — players notice.
3. **Latent consequences invisible.** Player doesn't perceive
   their choice mattered → no agency felt.
4. **State leak across systems.** Combat AI doesn't know the
   player betrayed faction X; designer thinks it does. Cross-system
   state must be intentional.
5. **No room for redemption / change.** Locked-in early choices
   without recovery paths feel punitive.
6. **Endings disconnected from play.** The ending reads as a
   fixed slideshow; players read the agency as theater.

## Output block

Wrap in `:::artifact` with `template: narrative-system`. Include the
state model schema explicitly so engineering can implement against
it.

## Refusal

- The agent will not approve a system whose authored-content
  estimate exceeds the project budget without an explicit cut plan.
- The agent will not approve "every choice matters" framing if the
  state model can't actually distinguish — that's a marketing
  lie the player will detect.
