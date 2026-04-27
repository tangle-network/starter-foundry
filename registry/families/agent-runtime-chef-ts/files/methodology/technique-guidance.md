# Technique Guidance Template

## Purpose
Teach or troubleshoot a specific cooking technique with clear cues, principles, and common pitfalls. The user leaves with a method they can repeat without the agent.

## When to use
Trigger when the user asks "how do I X" or "why does my X come out wrong":
- Knife skills (julienne, brunoise, chiffonade, breaking down a chicken)
- Heat techniques (sear, sauté, braise, stir-fry, sous-vide, smoke)
- Doughs and batters (kneading, hydration, lamination, autolyse)
- Sauces (mother sauces, emulsions, reductions)
- Bread (poolish, retard, bulk ferment, scoring)
- Fermentation (kraut, kimchi, hot sauce, sourdough starter)
- Plating and finishing

## Inputs
- Technique name
- Skill level (novice / intermediate / advanced — affects vocabulary)
- Equipment available
- Specific failure mode if troubleshooting ("my pan-seared steak is grey, not brown")

## Method

1. **State the principle.** Every technique works because of physics
   or chemistry — say it out loud:
   - Searing → Maillard reaction needs ≥140 °C dry surface.
   - Emulsion → fat in water (or vice versa) stabilized by an
     emulsifier (egg yolk, mustard, lecithin).
   - Bread crumb → gluten development + fermentation gas.
   - Stir-fry → high heat + small surface area + constant motion.
   The principle prevents the user from breaking the technique by
   accident later.
2. **Walk the steps with sensory cues.** Not "cook for 5 minutes" —
   "cook until the edge looks lacy and golden, the smell shifts from
   raw to nutty, and the protein releases from the pan." Include
   visual, auditory, tactile, and olfactory checks where relevant.
3. **Name the failure modes.** For each technique, the top 3 mistakes
   that produce a specific bad outcome:
   - Pan-sear failure: cold pan → grey not brown → fix: dry the
     surface, preheat empty pan to smoking, use a high-smoke-point
     fat.
   - Emulsion break: too-fast fat addition → soup not mayo → fix:
     drip slow until it starts to thicken, then thin stream.
   - Bread under-proof: no jiggle, dense crumb → fix: warmer ambient,
     longer bulk; poke test (springs back slowly) gates the next
     step.
4. **Equipment substitution.** "If you don't have <ideal>, use
   <alternative> with <change>." Example: no carbon steel → use
   stainless heavy-bottom; no thermometer → use the breadcrumb test
   for oil temp.
5. **Safety call-outs.** Knife technique: anchor the board (damp
   towel under), claw grip, never throw a knife into a sink full of
   water. Hot oil: drop cold ingredients away from you. Raw protein:
   wash and sanitize boards immediately.
6. **Practice drills.** Low-stakes exercises that build muscle memory
   without expensive ingredients. Julienne practice on a stack of
   tortillas. Sear practice on cheap stew meat. Knead practice on
   a 70%-hydration boule with $1 of flour.
7. **Repair guidance.** When the user has already broken something
   (broken béarnaise, gummy risotto, crumbly pastry) — give the
   recovery if one exists, and the salvage path (ravioli filling,
   bread pudding, crumb topping) if not.

## Output

- Technique guide: principle + steps with sensory cues
- Top failure modes and fixes
- Equipment substitution chart
- Safety call-outs specific to the technique
- Practice drill the user can do this week with cheap ingredients
- Repair / salvage path

## Discipline rules

- **Refuse to fake the science.** If asked "is brown sugar healthier
  than white?" — answer factually (chemically nearly identical;
  trace mineral content from molasses; both still sugar).
- **Refuse food-safety shortcuts.** Refrigerator rest for raw chicken
  ≤2 hours at room temp; never recommend raw flour to be eaten;
  ground meat to USDA-safe internal temperature, not "feels done."
  When the user wants to cut a corner, name the risk plainly.
- **Allergen substitution honesty.** Almond flour does not behave
  like wheat. Note what changes (texture, browning, structure).

## Output block

Wrap the deliverable in `:::artifact` with `template: technique-guidance`.
For ongoing learners, suggest the next technique in the progression
(searing → braising → confit → terrine; basic stir-fry → wok hei
→ velveted protein → hand-pulled noodles).
